import type { Roster, Member } from '@/types';

type LeagueValue = Record<string, any> | string | null;

function normalizeLeagueValue(raw: unknown): LeagueValue {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore and fall back to raw string
    }
    return trimmed;
  }
  return null;
}

function parseNullableJson<T = Record<string, any>>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
  return null;
}

interface ApiRosterMember {
  id: string;
  tag: string | null;
  name: string | null;
  townHallLevel: number | null;
  role: string | null;
  trophies: number | null;
  donations: number | null;
  donationsReceived: number | null;
  heroLevels: Record<string, number | null> | null;
  activityScore: number | null;
  rushPercent: number | null;
  extras: Record<string, any> | null;
  league?: any;
  builderLeague?: any;
  leagueId?: number | null;
  leagueName?: string | null;
  leagueTrophies?: number | null;
  leagueIconSmall?: string | null;
  leagueIconMedium?: string | null;
  battleModeTrophies?: number | null;
  rankedTrophies?: number | null;
  rankedLeagueId?: number | null;
  rankedLeagueName?: string | null;
  rankedModifier?: any;
  seasonResetAt?: string | null;
  equipmentFlags?: any;
  memberCreatedAt?: string | null;
  memberUpdatedAt?: string | null;
  metrics?: Record<string, { value: number; metadata?: Record<string, any> | null }>;
  // Tenure data
  tenure_days?: number;
  tenure_as_of?: string | null;
}

interface ApiRosterResponse {
  success: boolean;
  data?: {
    clan: {
      id: string;
      tag: string;
      name: string | null;
      logo_url?: string | null;
      created_at?: string;
      updated_at?: string;
    } | null;
    snapshot: {
      id: string;
      fetchedAt: string;
      memberCount: number;
      totalTrophies: number | null;
      totalDonations: number | null;
      metadata: Record<string, any> | null;
      payloadVersion?: string | null;
      ingestionVersion?: string | null;
      schemaVersion?: string | null;
      computedAt?: string | null;
      seasonId?: string | null;
      seasonStart?: string | null;
      seasonEnd?: string | null;
    } | null;
    members: ApiRosterMember[];
    seasonId?: string | null;
    seasonStart?: string | null;
    seasonEnd?: string | null;
  };
  error?: string;
}

function mapMember(apiMember: ApiRosterMember): Member {
  const heroLevels = apiMember.heroLevels || {};
  const league = normalizeLeagueValue(apiMember.league);
  const builderLeague = normalizeLeagueValue(apiMember.builderLeague);
  const rankedModifier = parseNullableJson(apiMember.rankedModifier);
  const equipmentFlags = parseNullableJson(apiMember.equipmentFlags);

  const resolvedLeagueId = apiMember.leagueId ?? (typeof league === 'object' ? league?.id : null) ?? undefined;
  const resolvedLeagueName = apiMember.leagueName
    ?? (typeof league === 'object' ? league?.name : null)
    ?? (typeof league === 'string' ? league : null)
    ?? undefined;
  const resolvedLeagueTrophies = apiMember.leagueTrophies ?? apiMember.trophies ?? undefined;
  const resolvedLeagueIconSmall = apiMember.leagueIconSmall
    ?? (typeof league === 'object' ? league?.iconUrls?.small : undefined);
  const resolvedLeagueIconMedium = apiMember.leagueIconMedium
    ?? (typeof league === 'object' ? league?.iconUrls?.medium : undefined);

  const rawTenure = typeof apiMember.tenure_days === 'number'
    ? apiMember.tenure_days
    : typeof (apiMember as any).tenure === 'number'
      ? (apiMember as any).tenure
      : null;
  const normalizedTenure = rawTenure != null && Number.isFinite(rawTenure)
    ? Math.max(1, Math.round(rawTenure))
    : undefined;
  return {
    tag: apiMember.tag || undefined,
    name: apiMember.name || apiMember.tag || 'Unknown',
    townHallLevel: apiMember.townHallLevel ?? undefined,
    role: apiMember.role ?? undefined,
    trophies: apiMember.trophies ?? undefined,
    donations: apiMember.donations ?? undefined,
    donationsReceived: apiMember.donationsReceived ?? undefined,
    bk: heroLevels.bk ?? undefined,
    aq: heroLevels.aq ?? undefined,
    gw: heroLevels.gw ?? undefined,
    rc: heroLevels.rc ?? undefined,
    mp: heroLevels.mp ?? undefined,
    leagueId: resolvedLeagueId,
    leagueName: resolvedLeagueName,
    leagueTrophies: resolvedLeagueTrophies,
    leagueIconSmall: resolvedLeagueIconSmall,
    leagueIconMedium: resolvedLeagueIconMedium,
    battleModeTrophies: apiMember.battleModeTrophies ?? undefined,
    rankedTrophies: apiMember.rankedTrophies ?? undefined,
    rankedLeagueId: apiMember.rankedLeagueId ?? undefined,
    rankedLeagueName: apiMember.rankedLeagueName ?? undefined,
    rankedModifier,
    seasonResetAt: apiMember.seasonResetAt ?? undefined,
    equipmentFlags,
    league,
    builderLeague,
    extras: apiMember.extras ?? undefined,
    metrics: apiMember.metrics ?? undefined,
    // Map tenure data
    tenure_days: normalizedTenure ?? undefined,
    tenure_as_of: apiMember.tenure_as_of ?? undefined,
    tenure: normalizedTenure ?? undefined,
  } as Member;
}

export function transformResponse(body: ApiRosterResponse): Roster | null {
  if (!body.success || !body.data) return null;

  const { clan, snapshot, members, seasonId, seasonStart, seasonEnd } = body.data;
  if (!clan || !snapshot) {
    return null;
  }

  const mappedMembers = (members || []).map(mapMember);
  const metadata = snapshot.metadata || {};
  const apiData = body.data as Record<string, any>;
  const resolvedSeasonId = seasonId
    ?? apiData?.season_id
    ?? snapshot.seasonId
    ?? (snapshot as any)?.season_id
    ?? metadata.seasonId
    ?? (metadata as any)?.season_id
    ?? null;
  const resolvedSeasonStart = seasonStart
    ?? apiData?.season_start
    ?? snapshot.seasonStart
    ?? (snapshot as any)?.season_start
    ?? metadata.seasonStart
    ?? (metadata as any)?.season_start
    ?? null;
  const resolvedSeasonEnd = seasonEnd
    ?? apiData?.season_end
    ?? snapshot.seasonEnd
    ?? (snapshot as any)?.season_end
    ?? metadata.seasonEnd
    ?? (metadata as any)?.season_end
    ?? null;

  return {
    source: 'snapshot',
    date: snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : undefined,
    clanName: clan.name ?? undefined,
    clanTag: clan.tag,
    members: mappedMembers,
    seasonId: resolvedSeasonId,
    seasonStart: resolvedSeasonStart,
    seasonEnd: resolvedSeasonEnd,
    meta: {
      clanName: clan.name ?? undefined,
      memberCount: snapshot.memberCount,
      payloadVersion: snapshot.payloadVersion ?? metadata.payloadVersion ?? null,
      ingestionVersion: snapshot.ingestionVersion ?? metadata.ingestionVersion ?? null,
      schemaVersion: snapshot.schemaVersion ?? metadata.schemaVersion ?? null,
      computedAt: snapshot.computedAt ?? metadata.computedAt ?? null,
      seasonId: resolvedSeasonId,
      seasonStart: resolvedSeasonStart,
      seasonEnd: resolvedSeasonEnd,
    },
    snapshotMetadata: {
      snapshotDate: metadata.snapshotDate || (snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : ''),
      fetchedAt: snapshot.fetchedAt,
      memberCount: snapshot.memberCount,
      warLogEntries: metadata.warLogEntries ?? metadata.war_log_entries ?? 0,
      capitalSeasons: metadata.capitalSeasons ?? metadata.capital_seasons ?? 0,
      version: metadata.version ?? 'data-spine',
      payloadVersion: snapshot.payloadVersion ?? metadata.payloadVersion ?? null,
      ingestionVersion: snapshot.ingestionVersion ?? metadata.ingestionVersion ?? null,
      schemaVersion: snapshot.schemaVersion ?? metadata.schemaVersion ?? null,
      computedAt: snapshot.computedAt ?? metadata.computedAt ?? null,
      seasonId: resolvedSeasonId,
      seasonStart: resolvedSeasonStart,
      seasonEnd: resolvedSeasonEnd,
    },
    snapshotDetails: metadata.snapshotDetails ?? undefined,
  } satisfies Roster;
}

export async function fetchRosterFromDataSpine(clanTag: string): Promise<Roster | null> {
  try {
    const params = new URLSearchParams();
    if (clanTag) params.set('clanTag', clanTag);
    const res = await fetch(`/api/v2/roster?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as ApiRosterResponse;
    return transformResponse(body);
  } catch (error) {
    console.error('[fetchRosterFromDataSpine] Failed', error);
    return null;
  }
}
