import { cookies } from 'next/headers';
import PlayerProfileClient from './PlayerProfileClient';
import { getInitialPlayerProfile } from './get-initial-profile';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';

interface PlayerPageProps {
  params: Promise<{ tag: string }>;
}

// Force dynamic rendering to prevent stale data caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { tag } = await params;
  let initialProfile: SupabasePlayerProfilePayload | null = null;

  try {
    // Try to read clanTag from cookie for server-side rendering
    const cookieStore = await cookies();
    const cookieClanTag = cookieStore.get('currentClanTag')?.value;
    initialProfile = await getInitialPlayerProfile(tag, cookieClanTag);
  } catch (error) {
    console.error('[PlayerPage] Failed to load initial player profile', error);
  }

  return <PlayerProfileClient tag={tag} initialProfile={initialProfile} />;
}
