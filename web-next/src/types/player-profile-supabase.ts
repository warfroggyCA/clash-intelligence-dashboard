export interface PlayerSummarySupabase {
  name: string | null;
  tag: string;
  clanName: string | null;
  clanTag: string | null;
  role: string | null;
  townHallLevel: number | null;
  trophies: number | null;
  rankedTrophies: number | null;
  league: {
    name: string | null;
    trophies: number | null;
    iconSmall: string | null;
    iconMedium: string | null;
  };
  rankedLeague: {
    id: number | null;
    name: string | null;
  };
  battleModeTrophies: number | null;
  donations: {
    given: number | null;
    received: number | null;
    balance: number | null;
  };
  war: {
    stars: number | null;
    attackWins: number | null;
    defenseWins: number | null;
  };
  activityScore: number | null;
  lastSeen: string | null;
  tenureDays: number | null;
  tenureAsOf: string | null;
  heroLevels: Record<string, unknown> | null;
  bestTrophies: number | null;
  bestVersusTrophies: number | null;
}

export interface PlayerTimelinePoint {
  snapshotDate: string | null;
  trophies: number | null;
  rankedTrophies: number | null;
  donations: number | null;
  donationsReceived: number | null;
  activityScore: number | null;
  heroLevels: Record<string, unknown> | null;
  warStars: number | null;
  attackWins: number | null;
  defenseWins: number | null;
}

export interface PlayerHistoryRecordSupabase {
  clanTag: string;
  playerTag: string;
  primaryName: string;
  status: string;
  totalTenure: number;
  currentStint: { startDate: string; isActive: boolean } | null;
  movements: Array<{
    type: 'joined' | 'departed' | 'returned';
    date: string;
    reason?: string;
    tenureAtDeparture?: number;
    notes?: string;
  }>;
  aliases: Array<{
    name: string;
    firstSeen: string;
    lastSeen: string;
  }>;
  notes: Array<{
    timestamp: string;
    note: string;
    customFields?: Record<string, string>;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlayerLeadershipNote {
  id: string;
  createdAt: string | null;
  note: string;
  customFields: Record<string, string> | null;
  createdBy: string | null;
}

export interface PlayerWarningRecord {
  id: string;
  createdAt: string | null;
  warningNote: string;
  isActive: boolean;
  createdBy: string | null;
}

export interface PlayerTenureActionRecord {
  id: string;
  createdAt: string | null;
  action: string;
  reason: string | null;
  grantedBy: string | null;
  createdBy: string | null;
}

export interface PlayerDepartureActionRecord {
  id: string;
  createdAt: string | null;
  reason: string | null;
  departureType: string | null;
  recordedBy: string | null;
  createdBy: string | null;
}

export interface PlayerEvaluationRecord {
  id: string;
  status: string | null;
  score: number | null;
  recommendation: string | null;
  rushPercent: number | null;
  evaluation: string | null;
  applicant: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlayerJoinerEventRecord {
  id: string;
  detectedAt: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

export interface PlayerLeadershipBundle {
  notes: PlayerLeadershipNote[];
  warnings: PlayerWarningRecord[];
  tenureActions: PlayerTenureActionRecord[];
  departureActions: PlayerDepartureActionRecord[];
}

export interface SupabasePlayerProfilePayload {
  summary: PlayerSummarySupabase;
  timeline: PlayerTimelinePoint[];
  history: PlayerHistoryRecordSupabase | null;
  leadership: PlayerLeadershipBundle;
  evaluations: PlayerEvaluationRecord[];
  joinerEvents: PlayerJoinerEventRecord[];
}
