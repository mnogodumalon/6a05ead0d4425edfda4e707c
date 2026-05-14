import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTaeglicherCheckIn } from '@/lib/enrich';
import type { EnrichedTaeglicherCheckIn } from '@/types/enriched';
import type { MeineGewohnheiten, TaeglicherCheckIn } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MeineGewohnheitenDialog } from '@/components/dialogs/MeineGewohnheitenDialog';
import { TaeglicherCheckInDialog } from '@/components/dialogs/TaeglicherCheckInDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconPencil, IconTrash,
  IconFlame, IconCalendarCheck, IconTarget, IconStar, IconChevronRight
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const APPGROUP_ID = '6a05ead0d4425edfda4e707c';
const REPAIR_ENDPOINT = '/claude/build/repair';

const MOOD_EMOJI: Record<string, string> = {
  super: '😊',
  gut: '🙂',
  okay: '😐',
  nicht_so_gut: '😕',
  schlecht: '😞',
};

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getStreak(checkIns: TaeglicherCheckIn[]): number {
  if (!checkIns.length) return 0;
  const sorted = [...checkIns]
    .filter(c => c.fields.datum)
    .sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''));
  const today = getTodayStr();
  let streak = 0;
  let current = today;
  for (const c of sorted) {
    if (c.fields.datum === current) {
      streak++;
      const d = new Date(current);
      d.setDate(d.getDate() - 1);
      current = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}

function getLast7Days(checkIns: TaeglicherCheckIn[]): { tag: string; erledigt: number }[] {
  const days: { tag: string; erledigt: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const ci = checkIns.find(c => c.fields.datum === dateStr);
    days.push({
      tag: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      erledigt: ci?.fields.anzahl_erledigt ?? 0,
    });
  }
  return days;
}

// Parse multipleapplookup field — it can be a string (single URL) or array of URLs
function parseMultiAppLookup(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string') as string[];
  if (typeof val === 'string') return val.split('\n').map(s => s.trim()).filter(Boolean);
  return [];
}

export default function DashboardOverview() {
  const {
    meineGewohnheiten, taeglicherCheckIn,
    meineGewohnheitenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedTaeglicherCheckIn = enrichTaeglicherCheckIn(taeglicherCheckIn, { meineGewohnheitenMap });

  // All hooks BEFORE early returns
  const [showGewohnheitDialog, setShowGewohnheitDialog] = useState(false);
  const [editGewohnheit, setEditGewohnheit] = useState<MeineGewohnheiten | null>(null);
  const [deleteGewohnheitTarget, setDeleteGewohnheitTarget] = useState<MeineGewohnheiten | null>(null);

  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [editCheckIn, setEditCheckIn] = useState<EnrichedTaeglicherCheckIn | null>(null);
  const [deleteCheckInTarget, setDeleteCheckInTarget] = useState<EnrichedTaeglicherCheckIn | null>(null);

  const [activeTab, setActiveTab] = useState<'heute' | 'verlauf' | 'gewohnheiten'>('heute');

  const today = getTodayStr();

  const todayCheckIn = useMemo(
    () => enrichedTaeglicherCheckIn.find(c => c.fields.datum === today) ?? null,
    [enrichedTaeglicherCheckIn, today]
  );

  const activeGewohnheiten = useMemo(
    () => meineGewohnheiten.filter(g => g.fields.gewohnheit_aktiv !== false),
    [meineGewohnheiten]
  );

  const completedTodayIds = useMemo(() => {
    if (!todayCheckIn) return new Set<string>();
    const urls = parseMultiAppLookup(todayCheckIn.fields.erledigte_gewohnheiten);
    const ids = new Set<string>();
    urls.forEach(url => {
      const id = extractRecordId(url);
      if (id) ids.add(id);
    });
    return ids;
  }, [todayCheckIn]);

  const streak = useMemo(() => getStreak(taeglicherCheckIn), [taeglicherCheckIn]);
  const chartData = useMemo(() => getLast7Days(taeglicherCheckIn), [taeglicherCheckIn]);

  const recentCheckIns = useMemo(
    () => [...enrichedTaeglicherCheckIn]
      .filter(c => c.fields.datum)
      .sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''))
      .slice(0, 10),
    [enrichedTaeglicherCheckIn]
  );

  const totalCheckIns = taeglicherCheckIn.length;
  const avgErledigt = totalCheckIns > 0
    ? Math.round(taeglicherCheckIn.reduce((s, c) => s + (c.fields.anzahl_erledigt ?? 0), 0) / totalCheckIns)
    : 0;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  async function handleToggleGewohnheit(g: MeineGewohnheiten) {
    if (!todayCheckIn) {
      // Erstelle neuen Check-in für heute mit dieser Gewohnheit
      const urls = [createRecordUrl(APP_IDS.MEINE_GEWOHNHEITEN, g.record_id)];
      await LivingAppsService.createTaeglicherCheckInEntry({
        datum: today,
        erledigte_gewohnheiten: urls as unknown as string,
        anzahl_erledigt: 1,
      });
    } else {
      const currentUrls = parseMultiAppLookup(todayCheckIn.fields.erledigte_gewohnheiten);
      const thisUrl = createRecordUrl(APP_IDS.MEINE_GEWOHNHEITEN, g.record_id);
      let newUrls: string[];
      if (completedTodayIds.has(g.record_id)) {
        newUrls = currentUrls.filter(u => extractRecordId(u) !== g.record_id);
      } else {
        newUrls = [...currentUrls, thisUrl];
      }
      await LivingAppsService.updateTaeglicherCheckInEntry(todayCheckIn.record_id, {
        erledigte_gewohnheiten: newUrls as unknown as string,
        anzahl_erledigt: newUrls.length,
      });
    }
    fetchAll();
  }

  async function handleDeleteGewohnheit() {
    if (!deleteGewohnheitTarget) return;
    await LivingAppsService.deleteMeineGewohnheitenEntry(deleteGewohnheitTarget.record_id);
    setDeleteGewohnheitTarget(null);
    fetchAll();
  }

  async function handleDeleteCheckIn() {
    if (!deleteCheckInTarget) return;
    await LivingAppsService.deleteTaeglicherCheckInEntry(deleteCheckInTarget.record_id);
    setDeleteCheckInTarget(null);
    fetchAll();
  }

  function getCheckInDefaultValues(checkIn: EnrichedTaeglicherCheckIn | null) {
    if (!checkIn) return undefined;
    return {
      ...checkIn.fields,
      stimmung: checkIn.fields.stimmung,
    };
  }

  const completionPct = activeGewohnheiten.length > 0
    ? Math.round((completedTodayIds.size / activeGewohnheiten.length) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gewohnheitstracker</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => { setEditCheckIn(todayCheckIn); setShowCheckInDialog(true); }}>
            <IconCalendarCheck size={15} className="mr-1.5 shrink-0" />
            {todayCheckIn ? 'Check-in bearbeiten' : 'Check-in starten'}
          </Button>
          <Button size="sm" onClick={() => { setEditGewohnheit(null); setShowGewohnheitDialog(true); }}>
            <IconPlus size={15} className="mr-1.5 shrink-0" />
            Gewohnheit
          </Button>
        </div>
      </div>

      {/* KPI Zeile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Streak"
          value={`${streak} Tage`}
          description="In Folge"
          icon={<IconFlame size={18} className="text-orange-500" />}
        />
        <StatCard
          title="Heute"
          value={`${completedTodayIds.size} / ${activeGewohnheiten.length}`}
          description="Erledigt"
          icon={<IconCheck size={18} className="text-green-500" />}
        />
        <StatCard
          title="Check-ins"
          value={String(totalCheckIns)}
          description="Gesamt"
          icon={<IconCalendarCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Ø pro Tag"
          value={String(avgErledigt)}
          description="Gewohnheiten"
          icon={<IconTarget size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'heute', label: 'Heute' },
          { key: 'verlauf', label: 'Verlauf' },
          { key: 'gewohnheiten', label: 'Meine Gewohnheiten' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Heute */}
      {activeTab === 'heute' && (
        <div className="space-y-4">
          {/* Fortschrittsbalken */}
          {activeGewohnheiten.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Heutiger Fortschritt</span>
                <span className="text-2xl font-bold text-primary">{completionPct}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              {todayCheckIn?.fields.stimmung && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Stimmung:</span>
                  <span className="text-base">{MOOD_EMOJI[todayCheckIn.fields.stimmung.key ?? ''] ?? '—'}</span>
                  <span className="text-foreground font-medium">{todayCheckIn.fields.stimmung.label}</span>
                </div>
              )}
              {todayCheckIn?.fields.motto && (
                <p className="text-sm italic text-muted-foreground border-l-2 border-primary pl-3">
                  „{todayCheckIn.fields.motto}"
                </p>
              )}
            </div>
          )}

          {/* Gewohnheiten-Checklist */}
          {activeGewohnheiten.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-4 text-center">
              <IconStar size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">Noch keine Gewohnheiten</p>
                <p className="text-sm text-muted-foreground">Lege deine erste Gewohnheit an und starte deinen Streak!</p>
              </div>
              <Button size="sm" onClick={() => { setEditGewohnheit(null); setShowGewohnheitDialog(true); }}>
                <IconPlus size={15} className="mr-1.5" /> Gewohnheit anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeGewohnheiten.map(g => {
                const done = completedTodayIds.has(g.record_id);
                return (
                  <button
                    key={g.record_id}
                    onClick={() => handleToggleGewohnheit(g)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      done
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      done ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {done && <IconCheck size={13} className="text-primary-foreground" stroke={2.5} />}
                    </div>
                    <span className="text-lg shrink-0">{g.fields.gewohnheit_icon || '✨'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {g.fields.gewohnheit_name || 'Unbenannt'}
                      </p>
                      {g.fields.gewohnheit_kategorie && (
                        <p className="text-xs text-muted-foreground truncate">{g.fields.gewohnheit_kategorie}</p>
                      )}
                    </div>
                    {done && <IconCheck size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {todayCheckIn?.fields.notizen && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notizen & Reflexion</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{todayCheckIn.fields.notizen}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Verlauf */}
      {activeTab === 'verlauf' && (
        <div className="space-y-4">
          {/* Balkendiagramm letzte 7 Tage */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground mb-4">Letzte 7 Tage</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="tag" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                  formatter={(v: number) => [v, 'Erledigt']}
                />
                <Bar dataKey="erledigt" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Check-in Liste */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Check-in Verlauf</p>
              <Button size="sm" variant="outline" onClick={() => setShowCheckInDialog(true)}>
                <IconPlus size={14} className="mr-1 shrink-0" /> Neuer Check-in
              </Button>
            </div>
            {recentCheckIns.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-center">
                <IconCalendarCheck size={40} className="text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">Noch keine Check-ins. Starte heute!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCheckIns.map(ci => (
                  <div key={ci.record_id} className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{formatDate(ci.fields.datum)}</span>
                        {ci.fields.stimmung && (
                          <span className="text-base" title={ci.fields.stimmung.label}>
                            {MOOD_EMOJI[ci.fields.stimmung.key ?? ''] ?? ''}
                          </span>
                        )}
                        {(ci.fields.anzahl_erledigt ?? 0) > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {ci.fields.anzahl_erledigt} erledigt
                          </span>
                        )}
                      </div>
                      {ci.fields.notizen && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ci.fields.notizen}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => { setEditCheckIn(ci); setShowCheckInDialog(true); }}
                        className="h-7 w-7 p-0">
                        <IconPencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteCheckInTarget(ci)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Meine Gewohnheiten */}
      {activeTab === 'gewohnheiten' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Alle Gewohnheiten ({meineGewohnheiten.length})</p>
            <Button size="sm" onClick={() => { setEditGewohnheit(null); setShowGewohnheitDialog(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" /> Neu
            </Button>
          </div>
          {meineGewohnheiten.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-4 text-center">
              <IconStar size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">Noch keine Gewohnheiten</p>
                <p className="text-sm text-muted-foreground">Beginne mit einer einfachen täglichen Routine.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {meineGewohnheiten.map(g => (
                <div key={g.record_id} className={`flex items-center gap-3 p-3.5 rounded-xl border bg-card ${
                  g.fields.gewohnheit_aktiv === false ? 'opacity-50' : 'border-border'
                }`}>
                  <span className="text-xl shrink-0">{g.fields.gewohnheit_icon || '✨'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{g.fields.gewohnheit_name || 'Unbenannt'}</p>
                    {g.fields.gewohnheit_kategorie && (
                      <p className="text-xs text-muted-foreground truncate">{g.fields.gewohnheit_kategorie}</p>
                    )}
                    {g.fields.gewohnheit_aktiv === false && (
                      <span className="text-xs text-muted-foreground">Inaktiv</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setEditGewohnheit(g); setShowGewohnheitDialog(true); }}
                      className="h-7 w-7 p-0">
                      <IconPencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteGewohnheitTarget(g)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                      <IconTrash size={14} />
                    </Button>
                  </div>
                  <IconChevronRight size={14} className="text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <MeineGewohnheitenDialog
        open={showGewohnheitDialog}
        onClose={() => { setShowGewohnheitDialog(false); setEditGewohnheit(null); }}
        onSubmit={async (fields) => {
          if (editGewohnheit) {
            await LivingAppsService.updateMeineGewohnheitenEntry(editGewohnheit.record_id, fields);
          } else {
            await LivingAppsService.createMeineGewohnheitenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editGewohnheit?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['MeineGewohnheiten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['MeineGewohnheiten']}
      />

      <TaeglicherCheckInDialog
        open={showCheckInDialog}
        onClose={() => { setShowCheckInDialog(false); setEditCheckIn(null); }}
        onSubmit={async (fields) => {
          if (editCheckIn) {
            await LivingAppsService.updateTaeglicherCheckInEntry(editCheckIn.record_id, fields);
          } else {
            await LivingAppsService.createTaeglicherCheckInEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editCheckIn ? getCheckInDefaultValues(editCheckIn) : (todayCheckIn && !editCheckIn ? undefined : undefined)}
        meine_gewohnheitenList={meineGewohnheiten}
        enablePhotoScan={AI_PHOTO_SCAN['TaeglicherCheckIn']}
        enablePhotoLocation={AI_PHOTO_LOCATION['TaeglicherCheckIn']}
      />

      <ConfirmDialog
        open={!!deleteGewohnheitTarget}
        title="Gewohnheit löschen"
        description={`„${deleteGewohnheitTarget?.fields.gewohnheit_name}" wirklich löschen?`}
        onConfirm={handleDeleteGewohnheit}
        onClose={() => setDeleteGewohnheitTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteCheckInTarget}
        title="Check-in löschen"
        description={`Check-in vom ${formatDate(deleteCheckInTarget?.fields.datum)} wirklich löschen?`}
        onConfirm={handleDeleteCheckIn}
        onClose={() => setDeleteCheckInTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
