import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { transformRosterApiResponse, type RosterApiResponse, type RosterData } from './roster-transform';

export const ROSTER_REVALIDATE_SECONDS = 60;

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
  const baseUrl = resolveBaseUrl();
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
