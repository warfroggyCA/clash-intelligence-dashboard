import { getInitialPlayerProfile } from '@/app/(dashboard)/player/[tag]/get-initial-profile';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import PlayerProfileClient from './PlayerProfileClient';
import { cookies } from 'next/headers';
import { normalizeTag } from '@/lib/tags';

export const revalidate = 300;

export default async function NewPlayerPage({ params }: { params: { tag: string } }) {
  const rawParam = params?.tag ?? '';
  const decodedParam = decodeURIComponent(rawParam);
  const tag = normalizeTag(decodedParam || '') || decodedParam || '';
  let initialProfile: SupabasePlayerProfilePayload | null = null;

  try {
    const cookieStore = await cookies();
    const cookieClanTag = cookieStore.get('currentClanTag')?.value;
    initialProfile = await getInitialPlayerProfile(tag, cookieClanTag);
  } catch (err) {
    console.warn('[new/player] initial profile fetch failed', err);
  }

  return <PlayerProfileClient tag={tag} initialProfile={initialProfile} />;
}
