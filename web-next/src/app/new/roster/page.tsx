import type { RosterData } from './types';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getCurrentRosterData } from '@/lib/roster-current';
import RosterClient from './RosterClient';

export const revalidate = 300;

export default async function NewRosterPage() {
  let initialRoster: RosterData | null = null;
  try {
    const tag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    initialRoster = await getCurrentRosterData(tag);
  } catch (err) {
    console.warn('[new/roster] initial fetch failed', err);
  }

  return <RosterClient initialRoster={initialRoster} />;
}
