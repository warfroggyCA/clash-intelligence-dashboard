import type { Member } from '@/types';

export interface RosterApiResponse {
  success: boolean;
  data?: {
    clan?: {
      id?: string;
      tag: string;
      name?: string | null;
      logo_url?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    } | null;
    snapshot?: {
      id?: string;
      fetchedAt?: string | null;
      fetched_at?: string | null;
      memberCount?: number | null;
      member_count?: number | null;
      metadata?: Record<string, any> | null;
      payloadVersion?: string | null;
      payload_version?: string | null;
      ingestionVersion?: string | null;
      ingestion_version?: string | null;
      schemaVersion?: string | null;
      schema_version?: string | null;
      computedAt?: string | null;
      computed_at?: string | null;
      seasonId?: string | null;
      season_id?: string | null;
      seasonStart?: string | null;
      season_start?: string | null;
      seasonEnd?: string | null;
      season_end?: string | null;
    } | null;
    members?: Array<Record<string, any>>;
  };
  error?: string;
}

export interface RosterMember extends Omit<Member, 'tenure_as_of'> {
  tenureDays?: number | null;
  tenureAsOf?: string | null;
  tenure_as_of?: string | null | undefined; // Override to allow null
  lastWeekTrophies?: number | null;
  seasonTotalTrophies?: number | null;
  vip?: {
    score: number;
    rank: number;
    competitive_score: number;
    support_score: number;
    development_score: number;
    trend: 'up' | 'down' | 'stable';
    last_week_score?: number;
  } | null;
}

export interface RosterData {
  members: RosterMember[];
  clanName: string;
  clanTag: string;
  date: string | null;
  snapshotMetadata?: {
    snapshotDate: string | null;
    fetchedAt: string | null;
    memberCount: number;
    warLogEntries: number;
    capitalSeasons: number;
    version: string;
    payloadVersion?: string | null;
    ingestionVersion?: string | null;
    schemaVersion?: string | null;
    computedAt?: string | null;
    seasonId?: string | null;
    seasonStart?: string | null;
    seasonEnd?: string | null;
  };
  meta?: {
    clanName?: string | null;
    recentClans?: string[];
    memberCount?: number;
    payloadVersion?: string | null;
    ingestionVersion?: string | null;
    schemaVersion?: string | null;
    computedAt?: string | null;
    seasonId?: string | null;
    seasonStart?: string | null;
    seasonEnd?: string | null;
  };
}

function toRosterMember(raw: Record<string, any>): RosterMember {
  const tag = raw.tag ?? raw.playerTag ?? raw.player_tag ?? '';
  const heroLevels = raw.heroLevels ?? raw.hero_levels ?? {};
  const rankedLeague = raw.rankedLeague ?? raw.ranked_league ?? null;

  const tenureDays =
    raw.tenureDays ??
    raw.tenure_days ??
    (typeof raw.tenure === 'number' ? raw.tenure : null);
  const tenureAsOf = raw.tenureAsOf ?? raw.tenure_as_of ?? null;

  return {
    name: raw.name ?? tag ?? 'Unknown',
    tag,
    townHallLevel: raw.townHallLevel ?? raw.th ?? null,
    role: raw.role ?? null,
    trophies: raw.trophies ?? raw.leagueTrophies ?? null,
    donations: raw.donations ?? null,
    donationsReceived: raw.donationsReceived ?? raw.donations_received ?? null,
    rankedLeagueId:
      raw.rankedLeagueId ?? rankedLeague?.id ?? raw.leagueId ?? null,
    rankedLeagueName:
      raw.rankedLeagueName ?? rankedLeague?.name ?? raw.leagueName ?? null,
    rankedTrophies: raw.rankedTrophies ?? raw.battleModeTrophies ?? null,
    lastWeekTrophies: raw.lastWeekTrophies ?? null,
    seasonTotalTrophies: raw.seasonTotalTrophies ?? null,
    bk: raw.bk ?? heroLevels.bk ?? null,
    aq: raw.aq ?? heroLevels.aq ?? null,
    gw: raw.gw ?? heroLevels.gw ?? null,
    rc: raw.rc ?? heroLevels.rc ?? null,
    mp: raw.mp ?? heroLevels.mp ?? null,
    activity: raw.activity ?? null,
    activityScore: raw.activityScore ?? raw.activity?.score ?? null,
    tenure_days: tenureDays ?? undefined,
    tenureDays: tenureDays,
    tenure_as_of: tenureAsOf ?? undefined,
    tenureAsOf,
    extras: raw.extras ?? null,
    metrics: raw.metrics ?? undefined,
    leagueId: raw.leagueId ?? null,
    leagueName: raw.leagueName ?? null,
    leagueTrophies: raw.leagueTrophies ?? null,
    leagueIconSmall: raw.leagueIconSmall ?? null,
    leagueIconMedium: raw.leagueIconMedium ?? null,
    battleModeTrophies: raw.battleModeTrophies ?? null,
    rankedModifier: raw.rankedModifier ?? null,
    seasonResetAt: raw.seasonResetAt ?? null,
    recentClans: raw.recentClans ?? undefined,
    enriched: raw.enriched ?? null,
    vip: raw.vip ?? null,
  } as RosterMember;
}

export function transformRosterApiResponse(response: RosterApiResponse): RosterData {
  if (!response?.success || !response.data || !response.data.clan || !Array.isArray(response.data.members)) {
    throw new Error('Invalid API response format');
  }

  const snapshot = response.data.snapshot ?? {};
  const metadata = snapshot.metadata ?? {};

  const snapshotDate =
    metadata.snapshotDate ?? metadata.snapshot_date ?? snapshot.snapshotDate ?? snapshot.snapshot_date ?? null;
  const fetchedAt =
    snapshot.fetchedAt ?? snapshot.fetched_at ?? metadata.fetchedAt ?? metadata.fetched_at ?? null;
  const memberCount =
    snapshot.memberCount ??
    snapshot.member_count ??
    metadata.memberCount ??
    metadata.member_count ??
    response.data.members.length ?? 0;

  const normalizedMetadata = {
    snapshotDate,
    fetchedAt,
    memberCount,
    warLogEntries: metadata.warLogEntries ?? metadata.war_log_entries ?? 0,
    capitalSeasons: metadata.capitalSeasons ?? metadata.capital_seasons ?? 0,
    version: metadata.version ?? snapshot.version ?? 'data-spine',
    payloadVersion: snapshot.payloadVersion ?? snapshot.payload_version ?? metadata.payloadVersion ?? metadata.payload_version ?? null,
    ingestionVersion: snapshot.ingestionVersion ?? snapshot.ingestion_version ?? metadata.ingestionVersion ?? metadata.ingestion_version ?? null,
    schemaVersion: snapshot.schemaVersion ?? snapshot.schema_version ?? metadata.schemaVersion ?? metadata.schema_version ?? null,
    computedAt: snapshot.computedAt ?? snapshot.computed_at ?? metadata.computedAt ?? metadata.computed_at ?? null,
    seasonId: snapshot.seasonId ?? snapshot.season_id ?? metadata.seasonId ?? metadata.season_id ?? null,
    seasonStart: snapshot.seasonStart ?? snapshot.season_start ?? metadata.seasonStart ?? metadata.season_start ?? null,
    seasonEnd: snapshot.seasonEnd ?? snapshot.season_end ?? metadata.seasonEnd ?? metadata.season_end ?? null,
  } as RosterData['snapshotMetadata'];

  const rosterMembers = response.data.members.map((member) => toRosterMember(member));

  return {
    members: rosterMembers,
    clanName: response.data.clan?.name ?? 'Unknown Clan',
    clanTag: response.data.clan?.tag ?? '#UNKNOWN',
    date: fetchedAt,
    snapshotMetadata: normalizedMetadata,
    meta: {
      clanName: response.data.clan?.name ?? null,
      memberCount,
      payloadVersion: normalizedMetadata?.payloadVersion ?? null,
      ingestionVersion: normalizedMetadata?.ingestionVersion ?? null,
      schemaVersion: normalizedMetadata?.schemaVersion ?? null,
      computedAt: normalizedMetadata?.computedAt ?? null,
      seasonId: normalizedMetadata?.seasonId ?? null,
      seasonStart: normalizedMetadata?.seasonStart ?? null,
      seasonEnd: normalizedMetadata?.seasonEnd ?? null,
    },
  } satisfies RosterData;
}
