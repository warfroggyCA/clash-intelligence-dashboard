import { getInitialRosterData } from '@/app/(dashboard)/simple-roster/get-initial-roster';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import TableClient from './TableClient';

export const revalidate = 300;

export default async function NewRosterTablePage() {
  let initialRoster: RosterData | null = null;
  try {
    const tag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    initialRoster = await getInitialRosterData(tag);
  } catch (err) {
    console.warn('[new/roster/table] initial fetch failed', err);
  }

  return <TableClient initialRoster={initialRoster} />;
}
