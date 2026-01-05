import type {
  PlayerHistoryRecordSupabase,
  PlayerLeadershipBundle,
  PlayerLeadershipNote,
  PlayerWarningRecord,
  PlayerTenureActionRecord,
  PlayerDepartureActionRecord,
  PlayerEvaluationRecord,
  PlayerJoinerEventRecord,
  PlayerSummarySupabase,
  PlayerTimelinePoint,
  SupabasePlayerProfilePayload,
} from '@/types/player-profile-supabase';
import { fetchWithRetry } from '@/lib/api/retry';

interface PlayerProfileApiResponse {
  success: boolean;
  data?: {
    summary: PlayerSummarySupabase;
    timeline: PlayerTimelinePoint[];
    history: any;
    leadership: {
      notes?: any[];
      warnings?: any[];
      tenureActions?: any[];
      departureActions?: any[];
    };
    evaluations?: any[];
    joinerEvents?: any[];
  };
  error?: string;
}

interface PlayerProfileV2Response {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

function mapHistory(record: any): PlayerHistoryRecordSupabase | null {
  if (!record) return null;

  const movements = Array.isArray(record.movements) ? record.movements : [];
  const aliases = Array.isArray(record.aliases) ? record.aliases : [];
  const notes = Array.isArray(record.notes) ? record.notes : [];

  return {
    clanTag: record.clan_tag ?? '',
    playerTag: record.player_tag ?? '',
    primaryName: record.primary_name ?? '',
    status: record.status ?? 'applicant',
    totalTenure: typeof record.total_tenure === 'number' ? record.total_tenure : 0,
    currentStint: record.current_stint ?? null,
    movements,
    aliases,
    notes,
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
  };
}

function mapNotes(rows: any[] | undefined): PlayerLeadershipNote[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at ?? null,
    note: row.note ?? '',
    customFields: (row.custom_fields ?? null) as Record<string, string> | null,
    createdBy: row.created_by ?? null,
  }));
}

function mapWarnings(rows: any[] | undefined): PlayerWarningRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at ?? null,
    warningNote: row.warning_note ?? '',
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ?? null,
  }));
}

function mapTenureActions(rows: any[] | undefined): PlayerTenureActionRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at ?? null,
    action: row.action ?? '',
    reason: row.reason ?? null,
    grantedBy: row.granted_by ?? null,
    createdBy: row.created_by ?? null,
  }));
}

function mapDepartureActions(rows: any[] | undefined): PlayerDepartureActionRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at ?? null,
    reason: row.reason ?? null,
    departureType: row.departure_type ?? null,
    recordedBy: row.recorded_by ?? null,
    createdBy: row.created_by ?? null,
  }));
}

function mapEvaluations(rows: any[] | undefined): PlayerEvaluationRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    status: row.status ?? null,
    score: typeof row.score === 'number' ? row.score : row.score != null ? Number(row.score) : null,
    recommendation: row.recommendation ?? null,
    rushPercent:
      typeof row.rush_percent === 'number'
        ? row.rush_percent
        : row.rush_percent != null
          ? Number(row.rush_percent)
          : null,
    evaluation: row.evaluation ?? null,
    applicant: (row.applicant ?? null) as Record<string, unknown> | null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}

function mapJoinerEvents(rows: any[] | undefined): PlayerJoinerEventRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id),
    detectedAt: row.detected_at ?? null,
    status: row.status ?? '',
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
      string,
      unknown
    >,
  }));
}

function mapLeadership(bundle: any): PlayerLeadershipBundle {
  if (!bundle || typeof bundle !== 'object') {
    return { notes: [], warnings: [], tenureActions: [], departureActions: [] };
  }
  return {
    notes: mapNotes(bundle.notes),
    warnings: mapWarnings(bundle.warnings),
    tenureActions: mapTenureActions(bundle.tenureActions),
    departureActions: mapDepartureActions(bundle.departureActions),
  };
}

export function mapV2Summary(
  data: Record<string, any>,
  fallbackTag: string,
  clanTag?: string | null
): PlayerSummarySupabase {
  const league = data.league && typeof data.league === 'object' ? data.league : {};
  const rankedLeague = data.rankedLeague && typeof data.rankedLeague === 'object' ? data.rankedLeague : {};
  const donationsGiven = typeof data.donations === 'number' ? data.donations : data.donations ?? null;
  const donationsReceived =
    typeof data.donationsReceived === 'number'
      ? data.donationsReceived
      : data.donationsReceived ?? null;
  const donationBalance =
    donationsGiven != null && donationsReceived != null ? donationsGiven - donationsReceived : null;

  return {
    name: data.name ?? null,
    tag: data.tag ?? fallbackTag,
    clanName: data.clan?.name ?? null,
    clanTag: clanTag ?? null,
    role: data.role ?? null,
    townHallLevel: data.townHallLevel ?? null,
    trophies: data.resolvedTrophies ?? data.rankedTrophies ?? data.trophies ?? null,
    rankedTrophies: data.rankedTrophies ?? null,
    seasonTotalTrophies: data.seasonTotalTrophies ?? null,
    lastWeekTrophies: data.lastWeekTrophies ?? null,
    rushPercent: data.rushPercent ?? null,
    league: {
      id: league.id ?? data.leagueId ?? null,
      name: league.name ?? data.leagueName ?? null,
      trophies: league.trophies ?? data.leagueTrophies ?? null,
      iconSmall: league.iconSmall ?? league.icon_small ?? null,
      iconMedium: league.iconMedium ?? league.icon_medium ?? null,
    },
    rankedLeague: {
      id: rankedLeague.id ?? data.rankedLeagueId ?? null,
      name: rankedLeague.name ?? data.rankedLeagueName ?? null,
      trophies: rankedLeague.trophies ?? data.rankedTrophies ?? null,
      iconSmall: rankedLeague.iconSmall ?? rankedLeague.icon_small ?? null,
      iconMedium: rankedLeague.iconMedium ?? rankedLeague.icon_medium ?? null,
    },
    battleModeTrophies: data.battleModeTrophies ?? null,
    donations: {
      given: donationsGiven,
      received: donationsReceived,
      balance: donationBalance,
    },
    war: {
      stars: data.enriched?.warStars ?? null,
      attackWins: data.enriched?.attackWins ?? null,
      defenseWins: data.enriched?.defenseWins ?? null,
      preference: null,
    },
    builderBase: {
      hallLevel: data.enriched?.builderHallLevel ?? null,
      trophies: data.enriched?.versusTrophies ?? null,
      battleWins: data.enriched?.versusBattleWins ?? null,
      leagueId: data.enriched?.builderLeagueId ?? null,
      leagueName: null,
    },
    capitalContributions: data.enriched?.capitalContributions ?? null,
    activityScore: data.activityScore ?? data.activity?.score ?? null,
    activity: data.activity ?? null,
    lastSeen: null,
    tenureDays: data.tenureDays ?? null,
    tenureAsOf: data.tenureAsOf ?? null,
    heroLevels: data.heroLevels ?? null,
    heroPower: data.heroPower ?? null,
    bestTrophies: data.enriched?.bestTrophies ?? null,
    bestVersusTrophies: data.enriched?.bestVersusTrophies ?? null,
    pets: data.enriched?.petLevels ?? null,
    superTroopsActive: data.enriched?.superTroopsActive ?? null,
    equipmentLevels: data.enriched?.equipmentLevels ?? null,
    achievements: {
      count: data.enriched?.achievementCount ?? null,
      score: data.enriched?.achievementScore ?? null,
    },
    expLevel: data.enriched?.expLevel ?? null,
  };
}

export async function fetchPlayerProfileSupabase(
  tag: string,
  clanTag?: string | null,
  init?: RequestInit,
): Promise<SupabasePlayerProfilePayload> {
  if (!tag) {
    throw new Error('Player tag is required');
  }

  // Get clanTag from parameter or from query params if provided, or from store
  const urlParams = new URLSearchParams();
  if (clanTag) {
    urlParams.set('clanTag', clanTag);
  } else if (init?.headers && 'x-clan-tag' in init.headers) {
    urlParams.set('clanTag', init.headers['x-clan-tag'] as string);
  }
  const queryString = urlParams.toString();
  const legacyUrl = `/api/player/${encodeURIComponent(tag)}/profile${queryString ? `?${queryString}` : ''}`;
  const v2Url = `/api/v2/player/${encodeURIComponent(tag)}${queryString ? `?${queryString}` : ''}`;

  const [legacyResponse, v2Response] = await Promise.all([
    fetchWithRetry(
      legacyUrl,
      {
        ...init,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: init?.headers,
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000
      }
    ),
    fetchWithRetry(
      v2Url,
      {
        ...init,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: init?.headers,
      },
      {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 3000
      }
    ).catch(() => null),
  ]);

  let payload: PlayerProfileApiResponse;
  try {
    payload = (await legacyResponse.json()) as PlayerProfileApiResponse;
  } catch (error) {
    throw new Error(`Failed to parse player profile response: ${(error as Error).message}`);
  }

  if (!legacyResponse.ok || !payload?.success || !payload.data) {
    const error: any = new Error(payload?.error || `Failed to fetch player profile (${legacyResponse.status})`);
    error.status = legacyResponse.status;
    throw error;
  }

  let v2Payload: PlayerProfileV2Response | null = null;
  if (v2Response) {
    try {
      v2Payload = (await v2Response.json()) as PlayerProfileV2Response;
    } catch {
      v2Payload = null;
    }
  }

  const { timeline, history, leadership, evaluations, joinerEvents, clanHeroAverages, vip } = payload.data as any;
  const v2Summary =
    v2Payload?.success && v2Payload.data
      ? mapV2Summary(v2Payload.data, tag, clanTag ?? null)
      : null;

  return {
    summary: v2Summary ?? (payload.data as any).summary,
    timeline: Array.isArray(timeline) ? timeline : [],
    history: mapHistory(history),
    leadership: mapLeadership(leadership),
    evaluations: mapEvaluations(evaluations),
    joinerEvents: mapJoinerEvents(joinerEvents),
    clanHeroAverages: clanHeroAverages || {},
    vip: vip || { current: null, history: [] },
  };
}
