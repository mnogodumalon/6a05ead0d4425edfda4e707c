import type { TaeglicherCheckIn } from './app';

export type EnrichedTaeglicherCheckIn = TaeglicherCheckIn & {
  erledigte_gewohnheitenName: string;
};
