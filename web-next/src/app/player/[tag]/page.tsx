import PlayerProfileClient from './PlayerProfileClient';
import { getInitialPlayerProfile } from './get-initial-profile';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';

interface PlayerPageProps {
  params: { tag: string };
}

// Force dynamic rendering to prevent stale data caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlayerPage({ params }: PlayerPageProps) {
  const tag = params?.tag ?? '';
  let initialProfile: SupabasePlayerProfilePayload | null = null;

  try {
    initialProfile = await getInitialPlayerProfile(tag);
  } catch (error) {
    console.error('[PlayerPage] Failed to load initial player profile', error);
  }

  return <PlayerProfileClient tag={tag} initialProfile={initialProfile} />;
}
