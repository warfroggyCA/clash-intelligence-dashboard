import { normalizeTag } from '@/lib/tags';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';

export const PLAYER_PROFILE_REVALIDATE_SECONDS = 60;

function resolveBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length > 0) {
    const raw = candidates[0]!;
    return raw.startsWith('http') ? raw : `https://${raw}`;
  }

  return 'http://localhost:5050';
}

function buildPlayerProfileUrl(baseUrl: string, playerTag: string, clanTag?: string | null): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const encodedTag = encodeURIComponent(playerTag);
  const queryParams = clanTag ? `?clanTag=${encodeURIComponent(clanTag)}` : '';
  return `${normalizedBase}/api/player/${encodedTag}/profile${queryParams}`;
}

interface PlayerProfileApiResponse {
  success: boolean;
  data?: SupabasePlayerProfilePayload;
  error?: string;
}

export async function getInitialPlayerProfile(playerTag: string, clanTag?: string | null): Promise<SupabasePlayerProfilePayload> {
  const normalizedTag = normalizeTag(playerTag);
  if (!normalizedTag) {
    throw new Error('Player tag is required');
  }

  const baseUrl = resolveBaseUrl();
  const normalizedClanTag = clanTag ? normalizeTag(clanTag) : null;
  const url = buildPlayerProfileUrl(baseUrl, normalizedTag, normalizedClanTag);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store', // Always fetch fresh data to prevent stale data issues
    next: {
      tags: ['player-profile', `player-profile:${normalizedTag}`],
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load player profile: ${response.status}`);
  }

  const payload = (await response.json()) as PlayerProfileApiResponse;
  
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || 'Invalid player profile response');
  }

  return payload.data;
}


