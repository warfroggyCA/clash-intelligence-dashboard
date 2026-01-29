import type { RosterData } from '../types';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getCurrentRosterData } from '@/lib/roster-current';
import TableClient from './TableClient';

export const revalidate = 300;

export default async function NewRosterTablePage() {
  let initialRoster: RosterData | null = null;
  try {
    const tag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    initialRoster = await getCurrentRosterData(tag);
  } catch (err) {
    console.warn('[new/roster/table] initial fetch failed', err);
  }

  return <TableClient initialRoster={initialRoster} />;
}
