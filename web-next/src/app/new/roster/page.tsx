import type { RosterData } from './types';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getCurrentRosterData } from '@/lib/roster-current';
import RosterUnifiedClient from './RosterUnifiedClient';

export const revalidate = 300;

export default async function NewRosterPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  let initialRoster: RosterData | null = null;
  try {
    const tag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    initialRoster = await getCurrentRosterData(tag);
  } catch (err) {
    console.warn('[new/roster] initial fetch failed', err);
  }

  const viewParam = sp.view;
  const initialView = viewParam === 'table'
    ? 'table'
    : viewParam === 'cards' || viewParam === 'card'
      ? 'cards'
      : 'auto';
  return <RosterUnifiedClient initialRoster={initialRoster} initialView={initialView} />;
}
