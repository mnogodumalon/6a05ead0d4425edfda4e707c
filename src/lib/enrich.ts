import type { EnrichedTaeglicherCheckIn } from '@/types/enriched';
import type { MeineGewohnheiten, TaeglicherCheckIn } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface TaeglicherCheckInMaps {
  meineGewohnheitenMap: Map<string, MeineGewohnheiten>;
}

export function enrichTaeglicherCheckIn(
  taeglicherCheckIn: TaeglicherCheckIn[],
  maps: TaeglicherCheckInMaps
): EnrichedTaeglicherCheckIn[] {
  return taeglicherCheckIn.map(r => ({
    ...r,
    erledigte_gewohnheitenName: resolveDisplay(r.fields.erledigte_gewohnheiten, maps.meineGewohnheitenMap, 'gewohnheit_name'),
  }));
}
