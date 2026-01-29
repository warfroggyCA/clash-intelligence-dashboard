import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import PlayerProfileClient from './PlayerProfileClient';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getCurrentRosterData } from '@/lib/roster-current';
import { buildInitialPlayerProfileFromRoster } from '@/lib/new/player-initial-profile';

export const revalidate = 300;

export default async function NewPlayerPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawParam } = await params;
  const decodedParam = decodeURIComponent(rawParam);
  const tag = normalizeTag(decodedParam || '') || decodedParam || '';
  let initialProfile: SupabasePlayerProfilePayload | null = null;

  try {
    const clanTag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || undefined;
    const roster = await getCurrentRosterData(clanTag);
    initialProfile = buildInitialPlayerProfileFromRoster(roster, tag);
  } catch (err) {
    console.warn('[new/player] initial profile build failed', err);
  }

  return <PlayerProfileClient tag={tag} initialProfile={initialProfile} />;
}
