import type { ActivityEvidence, MemberEnriched, Roster, Member } from '@/types';

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
  warStars: number | null;
  attackWins: number | null;
  defenseWins: number | null;
  lastSeen: string | number | null;
  activity?: ActivityEvidence | null;
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
  tenure_days?: number | null;
  tenure_as_of?: string | null;
  lastWeekTrophies?: number | null;
  seasonTotalTrophies?: number | null;
  metrics?: Record<string, { value: number; metadata?: Record<string, any> | null }>;
  // Oct 2025 optional fields
  rankedLeague?: { id?: number; name?: string; tier?: number } | null;
  leagueFloor?: { th: number; id?: number; name?: string } | null;
  tournamentStats?: {
    seasonId: string;
    attacksUsed: number;
    attacksMax: number;
    offTrophies: number;
    defTrophies: number;
    offAvgDestruction?: number;
    defAvgDestruction?: number;
    rank?: number;
    promotion?: 'promoted' | 'retained' | 'demoted' | 'decay';
  } | null;
  shieldStatus?: {
    type: 'none' | 'magic' | 'legend';
    durationHours: number;
    lootProtected: boolean;
    revengeAvailable: boolean;
  } | null;
  enriched?: MemberEnriched | null;
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
  const league = normalizeLeagueValue(apiMember.league);
  const builderLeague = normalizeLeagueValue(apiMember.builderLeague);
  const rankedModifier = parseNullableJson(apiMember.rankedModifier);
  const equipmentFlags = parseNullableJson(apiMember.equipmentFlags);

  const resolvedLeagueId = apiMember.leagueId ?? (typeof league === 'object' ? league?.id : null) ?? null;
  const resolvedLeagueName = apiMember.leagueName
    ?? (typeof league === 'object' ? league?.name : null)
    ?? (typeof league === 'string' ? league : null)
    ?? null;
  const resolvedLeagueTrophies = apiMember.leagueTrophies ?? apiMember.trophies ?? null;
  const resolvedLeagueIconSmall = apiMember.leagueIconSmall
    ?? (typeof league === 'object' ? league?.iconUrls?.small : null);
  const resolvedLeagueIconMedium = apiMember.leagueIconMedium
    ?? (typeof league === 'object' ? league?.iconUrls?.medium : null);

  const rawTenure = typeof apiMember.tenure_days === 'number'
    ? apiMember.tenure_days
    : typeof (apiMember as any).tenure === 'number'
      ? (apiMember as any).tenure
      : null;
  const normalizedTenure = rawTenure != null && Number.isFinite(rawTenure)
    ? Math.max(1, Math.round(rawTenure))
    : null;

  const heroLevels = apiMember.heroLevels || {};

  return {
    tag: apiMember.tag || null,
    name: apiMember.name || apiMember.tag || 'Unknown',
    townHallLevel: apiMember.townHallLevel ?? null,
    role: apiMember.role ?? null,
    trophies: apiMember.trophies ?? null,
    donations: apiMember.donations ?? null,
    donationsReceived: apiMember.donationsReceived ?? null,
    warStars: apiMember.warStars ?? null,
    attackWins: apiMember.attackWins ?? null,
    defenseWins: apiMember.defenseWins ?? null,
    lastSeen: apiMember.lastSeen ?? null,
    activity: apiMember.activity ?? null,
    activityScore:
      typeof apiMember.activityScore === 'number'
        ? apiMember.activityScore
        : apiMember.activity?.score ?? null,
    // Hero levels
    bk: heroLevels.bk ?? null,
    aq: heroLevels.aq ?? null,
    gw: heroLevels.gw ?? null,
    rc: heroLevels.rc ?? null,
    mp: heroLevels.mp ?? null,
    leagueId: resolvedLeagueId,
    leagueName: resolvedLeagueName,
    leagueTrophies: resolvedLeagueTrophies,
    leagueIconSmall: resolvedLeagueIconSmall,
    leagueIconMedium: resolvedLeagueIconMedium,
    battleModeTrophies: apiMember.battleModeTrophies ?? null,
    rankedTrophies: apiMember.rankedTrophies ?? null,
    rankedLeagueId: apiMember.rankedLeagueId ?? null,
    rankedLeagueName: apiMember.rankedLeagueName ?? null,
    rankedLeague: apiMember.rankedLeague ?? null,
    leagueFloor: apiMember.leagueFloor ?? null,
    tournamentStats: apiMember.tournamentStats ?? null,
    shieldStatus: apiMember.shieldStatus ?? null,
    rankedModifier,
    seasonResetAt: apiMember.seasonResetAt ?? null,
    equipmentFlags,
    league,
    builderLeague,
    extras: apiMember.extras ?? null,
    metrics: apiMember.metrics ?? null,
    lastWeekTrophies: apiMember.lastWeekTrophies ?? null,
    seasonTotalTrophies: apiMember.seasonTotalTrophies ?? null,
    enriched: apiMember.enriched ?? null,
    // Map tenure data
    tenure_days: normalizedTenure ?? null,
    tenure_as_of: apiMember.tenure_as_of ?? null,
    tenure: normalizedTenure ?? null,
  } as Member;
}

export function transformResponse(body: ApiRosterResponse): Roster | null {
  if (!body.success || !body.data) return null;

  const { clan, snapshot, members, seasonId, seasonStart, seasonEnd } = body.data;
  if (!clan || !snapshot) {
    return null;
  }

  const snapshotAny = snapshot as Record<string, any>;
  const rawMetadata = snapshotAny?.metadata ?? (snapshotAny as any)?.Metadata ?? {};
  const metadata =
    rawMetadata && typeof rawMetadata === 'object'
      ? (rawMetadata as Record<string, any>)
      : {};

  const coalesceString = (...values: Array<unknown>): string | null => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  };

  const coalesceNumber = (...values: Array<unknown>): number | null => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };

  const toIsoString = (value: string | null): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
      return null;
    }
    return parsed.toISOString();
  };

  const mappedMembers = (members || []).map(mapMember);
  const apiData = body.data as Record<string, any>;
  const memberCount =
    coalesceNumber(
      snapshotAny?.memberCount,
      snapshotAny?.member_count,
      metadata?.memberCount,
      metadata?.member_count,
    ) ?? mappedMembers.length;
  const payloadVersion = coalesceString(
    snapshotAny?.payloadVersion,
    snapshotAny?.payload_version,
    metadata?.payloadVersion,
    metadata?.payload_version,
  );
  const ingestionVersion = coalesceString(
    snapshotAny?.ingestionVersion,
    snapshotAny?.ingestion_version,
    metadata?.ingestionVersion,
    metadata?.ingestion_version,
  );
  const schemaVersion = coalesceString(
    snapshotAny?.schemaVersion,
    snapshotAny?.schema_version,
    metadata?.schemaVersion,
    metadata?.schema_version,
  );
  const fetchedAtIso = toIsoString(
    coalesceString(
      snapshotAny?.fetchedAt,
      snapshotAny?.fetched_at,
      metadata?.fetchedAt,
      metadata?.fetched_at,
      metadata?.computedAt,
      metadata?.computed_at,
    ),
  );
  const computedAtIso =
    toIsoString(
      coalesceString(
        snapshotAny?.computedAt,
        snapshotAny?.computed_at,
        metadata?.computedAt,
        metadata?.computed_at,
      ),
    ) ?? fetchedAtIso;
  const snapshotDate =
    coalesceString(
      snapshotAny?.snapshotDate,
      snapshotAny?.snapshot_date,
      metadata?.snapshotDate,
      metadata?.snapshot_date,
      fetchedAtIso ? fetchedAtIso.slice(0, 10) : null,
    ) ?? (fetchedAtIso ? fetchedAtIso.slice(0, 10) : null);
  const resolvedSnapshotDetails =
    metadata?.snapshotDetails ?? metadata?.snapshot_details ?? null;
  const resolvedSeasonId = seasonId
    ?? apiData?.season_id
    ?? snapshotAny?.seasonId
    ?? snapshotAny?.season_id
    ?? metadata?.seasonId
    ?? metadata?.season_id
    ?? null;
  const resolvedSeasonStart = seasonStart
    ?? apiData?.season_start
    ?? snapshotAny?.seasonStart
    ?? snapshotAny?.season_start
    ?? metadata?.seasonStart
    ?? metadata?.season_start
    ?? null;
  const resolvedSeasonEnd = seasonEnd
    ?? apiData?.season_end
    ?? snapshotAny?.seasonEnd
    ?? snapshotAny?.season_end
    ?? metadata?.seasonEnd
    ?? metadata?.season_end
    ?? null;

  return {
    source: 'snapshot',
    date: snapshotDate ?? undefined,
    clanName: clan.name ?? undefined,
    clanTag: clan.tag,
    members: mappedMembers,
    seasonId: resolvedSeasonId,
    seasonStart: resolvedSeasonStart,
    seasonEnd: resolvedSeasonEnd,
    meta: {
      clanName: clan.name ?? undefined,
      memberCount,
      payloadVersion: payloadVersion ?? null,
      ingestionVersion: ingestionVersion ?? null,
      schemaVersion: schemaVersion ?? null,
      computedAt: computedAtIso ?? null,
      seasonId: resolvedSeasonId,
      seasonStart: resolvedSeasonStart,
      seasonEnd: resolvedSeasonEnd,
    },
    snapshotMetadata: {
      snapshotDate: snapshotDate ?? '',
      fetchedAt: fetchedAtIso,
      memberCount,
      warLogEntries: metadata.warLogEntries ?? metadata.war_log_entries ?? 0,
      capitalSeasons: metadata.capitalSeasons ?? metadata.capital_seasons ?? 0,
      version: metadata.version ?? 'data-spine',
      payloadVersion: payloadVersion ?? null,
      ingestionVersion: ingestionVersion ?? null,
      schemaVersion: schemaVersion ?? null,
      computedAt: computedAtIso ?? null,
      seasonId: resolvedSeasonId,
      seasonStart: resolvedSeasonStart,
      seasonEnd: resolvedSeasonEnd,
      defenseSnapshotTimestamp: metadata.defenseSnapshotTimestamp ?? null,
      defenseSnapshotLayoutId: metadata.defenseSnapshotLayoutId ?? null,
    },
    snapshotDetails: resolvedSnapshotDetails,
  } satisfies Roster;
}

export async function fetchRosterFromDataSpine(clanTag: string): Promise<Roster | null> {
  try {
    const params = new URLSearchParams();
    if (clanTag) params.set('clanTag', clanTag);
    
    // SSR needs absolute URL - construct from env or fallback
    const baseUrl = typeof window === 'undefined'
      ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5050')
      : '';
    const url = `${baseUrl}/api/v2/roster?${params.toString()}`;
    
    const res = await fetch(url, {
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
