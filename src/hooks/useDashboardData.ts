import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MeineGewohnheiten, TaeglicherCheckIn } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [meineGewohnheiten, setMeineGewohnheiten] = useState<MeineGewohnheiten[]>([]);
  const [taeglicherCheckIn, setTaeglicherCheckIn] = useState<TaeglicherCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [meineGewohnheitenData, taeglicherCheckInData] = await Promise.all([
        LivingAppsService.getMeineGewohnheiten(),
        LivingAppsService.getTaeglicherCheckIn(),
      ]);
      setMeineGewohnheiten(meineGewohnheitenData);
      setTaeglicherCheckIn(taeglicherCheckInData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [meineGewohnheitenData, taeglicherCheckInData] = await Promise.all([
          LivingAppsService.getMeineGewohnheiten(),
          LivingAppsService.getTaeglicherCheckIn(),
        ]);
        setMeineGewohnheiten(meineGewohnheitenData);
        setTaeglicherCheckIn(taeglicherCheckInData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const meineGewohnheitenMap = useMemo(() => {
    const m = new Map<string, MeineGewohnheiten>();
    meineGewohnheiten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [meineGewohnheiten]);

  return { meineGewohnheiten, setMeineGewohnheiten, taeglicherCheckIn, setTaeglicherCheckIn, loading, error, fetchAll, meineGewohnheitenMap };
}