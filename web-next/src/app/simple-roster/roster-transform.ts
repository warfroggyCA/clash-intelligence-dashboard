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
      snapshotDate?: string | null;
      snapshot_date?: string | null;
    } | null;
    members?: Array<Record<string, any>>;
    dateInfo?: {
      currentDate: string;
      snapshotDate: string | null;
      isStale: boolean;
    };
    clanHeroAverages?: Record<string, number | { average: number; count: number }>;
  };
  error?: string;
}

export interface RosterMember extends Omit<Member, 'tenure_as_of'> {
  tenureDays?: number | null;
  tenureAsOf?: string | null;
  tenure_as_of?: string | null | undefined; // Override to allow null
  lastWeekTrophies?: number | null;
  seasonTotalTrophies?: number | null;
  cumulativeDonationsGiven?: number | null;
  cumulativeDonationsReceived?: number | null;
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
  lastUpdated?: string | null; // Date when the snapshot was last updated
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
  clanHeroAverages?: Record<string, number | { average: number; count: number }>;
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
    // API returns: donations: member.donations || 0, donationsReceived: member.donations_received || 0
    // So these are always numbers (never null/undefined)
    donations: typeof raw.donations === 'number' ? raw.donations : (raw.donations ?? 0),
    donationsReceived: typeof raw.donationsReceived === 'number' 
      ? raw.donationsReceived 
      : (typeof raw.donations_received === 'number' ? raw.donations_received : (raw.donationsReceived ?? raw.donations_received ?? 0)),
    // Cumulative donations (accumulate over tenure, reset on leave/rejoin)
    cumulativeDonationsGiven: typeof raw.cumulative_donations_given === 'number' ? raw.cumulative_donations_given : (raw.cumulativeDonationsGiven ?? 0),
    cumulativeDonationsReceived: typeof raw.cumulative_donations_received === 'number' ? raw.cumulative_donations_received : (raw.cumulativeDonationsReceived ?? 0),
    warStars: raw.warStars ?? raw.war_stars ?? raw.enriched?.warStars ?? null,
    clanCapitalContributions: raw.clanCapitalContributions ?? raw.capitalContributions ?? raw.capital_contributions ?? raw.enriched?.capitalContributions ?? null,
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
  if (!response?.success || !response.data) {
    throw new Error('Invalid API response format: missing success or data');
  }
  
  // Handle case where clan might be null or missing
  if (!response.data.clan) {
    throw new Error('Invalid API response format: missing clan data');
  }
  
  // Ensure members is an array (default to empty array if missing)
  const members = Array.isArray(response.data.members) ? response.data.members : [];

  const snapshot = response.data.snapshot ?? {};
  const metadata = snapshot.metadata ?? {};

  const snapshotDate =
    (metadata as any).snapshotDate ?? (metadata as any).snapshot_date ?? (snapshot as any).snapshotDate ?? (snapshot as any).snapshot_date ?? null;
  const fetchedAt =
    snapshot.fetchedAt ?? snapshot.fetched_at ?? (metadata as any).fetchedAt ?? (metadata as any).fetched_at ?? null;
  const memberCount =
    snapshot.memberCount ??
    snapshot.member_count ??
    (metadata as any).memberCount ??
    (metadata as any).member_count ??
    members.length ?? 0;

  const normalizedMetadata = {
    snapshotDate,
    fetchedAt,
    memberCount,
    warLogEntries: (metadata as any).warLogEntries ?? (metadata as any).war_log_entries ?? 0,
    capitalSeasons: (metadata as any).capitalSeasons ?? (metadata as any).capital_seasons ?? 0,
    version: (metadata as any).version ?? (snapshot as any).version ?? 'data-spine',
    payloadVersion: snapshot.payloadVersion ?? snapshot.payload_version ?? (metadata as any).payloadVersion ?? (metadata as any).payload_version ?? null,
    ingestionVersion: snapshot.ingestionVersion ?? snapshot.ingestion_version ?? (metadata as any).ingestionVersion ?? (metadata as any).ingestion_version ?? null,
    schemaVersion: snapshot.schemaVersion ?? snapshot.schema_version ?? (metadata as any).schemaVersion ?? (metadata as any).schema_version ?? null,
    computedAt: snapshot.computedAt ?? snapshot.computed_at ?? (metadata as any).computedAt ?? (metadata as any).computed_at ?? null,
    seasonId: snapshot.seasonId ?? snapshot.season_id ?? (metadata as any).seasonId ?? (metadata as any).season_id ?? null,
    seasonStart: snapshot.seasonStart ?? snapshot.season_start ?? (metadata as any).seasonStart ?? (metadata as any).season_start ?? null,
    seasonEnd: snapshot.seasonEnd ?? snapshot.season_end ?? (metadata as any).seasonEnd ?? (metadata as any).season_end ?? null,
  } as RosterData['snapshotMetadata'];

  const rosterMembers = members.map((member) => toRosterMember(member));

  // Use snapshotDate as lastUpdated if available, otherwise use fetchedAt
  const lastUpdated = snapshotDate || fetchedAt || null;

  return {
    members: rosterMembers,
    clanName: response.data.clan?.name ?? 'Unknown Clan',
    clanTag: response.data.clan?.tag ?? '#UNKNOWN',
    date: fetchedAt,
    lastUpdated,
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
    clanHeroAverages: response.data.clanHeroAverages ?? {},
  } satisfies RosterData;
}

