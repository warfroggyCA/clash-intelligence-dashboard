import { normalizeTag } from '@/lib/tags';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import { mapV2Summary } from '@/lib/player-profile-supabase';
import { getRequestOrigin } from '@/lib/app-origin';

export const PLAYER_PROFILE_REVALIDATE_SECONDS = 60;

function buildPlayerProfileUrl(baseUrl: string, playerTag: string, clanTag?: string | null): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const encodedTag = encodeURIComponent(playerTag);
  const queryParams = clanTag ? `?clanTag=${encodeURIComponent(clanTag)}` : '';
  return `${normalizedBase}/api/player/${encodedTag}/profile${queryParams}`;
}

function buildPlayerProfileV2Url(baseUrl: string, playerTag: string, clanTag?: string | null): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const encodedTag = encodeURIComponent(playerTag);
  const queryParams = clanTag ? `?clanTag=${encodeURIComponent(clanTag)}` : '';
  return `${normalizedBase}/api/v2/player/${encodedTag}${queryParams}`;
}

interface PlayerProfileApiResponse {
  success: boolean;
  data?: SupabasePlayerProfilePayload;
  error?: string;
}

interface PlayerProfileV2Response {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

export async function getInitialPlayerProfile(playerTag: string, clanTag?: string | null): Promise<SupabasePlayerProfilePayload> {
  const normalizedTag = normalizeTag(playerTag);
  if (!normalizedTag) {
    throw new Error('Player tag is required');
  }

  const baseUrl = await getRequestOrigin();
  const normalizedClanTag = clanTag ? normalizeTag(clanTag) : null;
  const url = buildPlayerProfileUrl(baseUrl, normalizedTag, normalizedClanTag);
  const v2Url = buildPlayerProfileV2Url(baseUrl, normalizedTag, normalizedClanTag);

  // Add timeout to prevent hanging (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const [response, v2Response] = await Promise.all([
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store', // Always fetch fresh data to prevent stale data issues
        signal: controller.signal,
        next: {
          tags: ['player-profile', `player-profile:${normalizedTag}`],
        },
      }),
      fetch(v2Url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => null),
    ]);

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to load player profile: ${response.status}`);
    }

    const payload = (await response.json()) as PlayerProfileApiResponse;
    
    if (!payload.success || !payload.data) {
      throw new Error(payload.error || 'Invalid player profile response');
    }

    let v2Payload: PlayerProfileV2Response | null = null;
    if (v2Response) {
      try {
        v2Payload = (await v2Response.json()) as PlayerProfileV2Response;
      } catch {
        v2Payload = null;
      }
    }

    if (v2Payload?.success && v2Payload.data) {
      payload.data.summary = mapV2Summary(v2Payload.data, normalizedTag, normalizedClanTag ?? null);
    }

    return payload.data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Player profile request timed out after 30 seconds');
    }
    throw error;
  }
}
