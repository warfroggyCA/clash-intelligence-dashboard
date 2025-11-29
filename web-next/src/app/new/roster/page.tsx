import { getInitialRosterData } from '@/app/(dashboard)/simple-roster/get-initial-roster';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import RosterClient from './RosterClient';

export const revalidate = 300;

export default async function NewRosterPage() {
  let initialRoster: RosterData | null = null;
  try {
    const tag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    initialRoster = await getInitialRosterData(tag);
  } catch (err) {
    console.warn('[new/roster] initial fetch failed', err);
  }

  return <RosterClient initialRoster={initialRoster} />;
}
