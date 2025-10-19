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

export async function fetchPlayerProfileSupabase(
  tag: string,
  init?: RequestInit,
): Promise<SupabasePlayerProfilePayload> {
  if (!tag) {
    throw new Error('Player tag is required');
  }

  const response = await fetch(`/api/player/${encodeURIComponent(tag)}/profile`, {
    ...init,
    cache: 'no-store',
  });

  let payload: PlayerProfileApiResponse;
  try {
    payload = (await response.json()) as PlayerProfileApiResponse;
  } catch (error) {
    throw new Error(`Failed to parse player profile response: ${(error as Error).message}`);
  }

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || `Failed to fetch player profile (${response.status})`);
  }

  const { summary, timeline, history, leadership, evaluations, joinerEvents, clanHeroAverages } = payload.data;

  return {
    summary,
    timeline: Array.isArray(timeline) ? timeline : [],
    history: mapHistory(history),
    leadership: mapLeadership(leadership),
    evaluations: mapEvaluations(evaluations),
    joinerEvents: mapJoinerEvents(joinerEvents),
    clanHeroAverages: clanHeroAverages || {},
  };
}
