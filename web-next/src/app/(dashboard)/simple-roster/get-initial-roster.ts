import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getRequestOrigin } from '@/lib/app-origin';
import { transformRosterApiResponse } from './roster-transform';
import type { RosterApiResponse, RosterData } from '@/types/roster';

export const ROSTER_REVALIDATE_SECONDS = 60;

function buildRosterUrl(baseUrl: string, clanTag: string | null): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const params = new URLSearchParams();
  if (clanTag) {
    params.set('clanTag', clanTag);
  }
  const query = params.toString();
  return query ? `${normalizedBase}/api/v2/roster?${query}` : `${normalizedBase}/api/v2/roster`;
}

export async function getInitialRosterData(requestedClanTag?: string): Promise<RosterData> {
  const defaultTag = cfg.homeClanTag ?? '';
  const normalizedTag = normalizeTag(requestedClanTag ?? defaultTag) ?? '';
  const baseUrl = await getRequestOrigin();
  const url = buildRosterUrl(baseUrl, normalizedTag || null);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store', // Always fetch fresh data to prevent stale data issues
    next: {
      tags: normalizedTag
        ? ['roster', `roster:${normalizedTag}`]
        : ['roster'],
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load roster: ${response.status}`);
  }

  const payload = (await response.json()) as RosterApiResponse;
  return transformRosterApiResponse(payload);
}
