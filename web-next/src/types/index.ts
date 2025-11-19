/**
 * Centralized Type Definitions for Clash Intelligence Dashboard
 * 
 * This file contains all shared types and interfaces used across the application.
 * It eliminates duplicate type definitions and provides a single source of truth.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

// =============================================================================
// CORE CLAN DATA TYPES
// =============================================================================

/**
 * Core member data structure used throughout the application
 */
export interface Member {
  // Basic Info
  name: string;
  tag: string;
  
  // Enriched historical data (October 2025 rollout)
  enriched?: MemberEnriched | null;
  
  // Town Hall & Heroes
  townHallLevel?: number | null;
  th?: number; // Alias for townHallLevel
  bk?: number | null; // Barbarian King
  aq?: number | null; // Archer Queen
  gw?: number | null; // Grand Warden
  rc?: number | null; // Royal Champion
  mp?: number | null; // Master Builder (Pet House)
  
  // Stats
  trophies?: number;
  versusTrophies?: number;
  donations?: number;
  donationsReceived?: number;
  seasonTotalTrophies?: number | null;
  warStars?: number;
  clanCapitalContributions?: number;
  leagueId?: number;
  leagueName?: string;
  leagueTrophies?: number;
  leagueIconSmall?: string;
  leagueIconMedium?: string;
  battleModeTrophies?: number;
  rankedTrophies?: number;
  rankedLeagueId?: number;
  rankedLeagueName?: string;
  rankedModifier?: Record<string, any> | null;
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
  seasonResetAt?: string;
  equipmentFlags?: Record<string, any> | null;
  league?: (
    | {
        id?: number;
        name?: string;
        trophies?: number;
        iconUrls?: Record<string, string | null>;
      }
    | string
  ) | null;
  builderLeague?: (
    | {
        id?: number;
        name?: string;
        trophies?: number;
        iconUrls?: Record<string, string | null>;
      }
    | string
  ) | null;
  
  // Activity & Tenure
  tenure_days?: number; // Effective tenure for display
  tenure?: number;      // Alias for tenure_days
  tenure_as_of?: string; // Date tenure base was last set
  lastSeen?: string | number;
  lastWeekTrophies?: number | null;
  activityScore?: number | null;
  
  // Clan Info
  role?: string;
  recentClans?: string[];
  
  // Custom Fields
  manualActivityOverride?: ActivityOption;
  notes?: string;
  customFields?: Record<string, string>;
  extras?: Record<string, any>;
  metrics?: Record<string, {
    value: number;
    metadata?: Record<string, any> | null;
  }>;
  activity?: ActivityEvidence | null;
}

export interface MemberEnriched {
  petLevels?: Record<string, number> | null;
  builderHallLevel?: number | null;
  versusTrophies?: number | null;
  versusBattleWins?: number | null;
  builderLeagueId?: number | null;
  warStars?: number | null;
  attackWins?: number | null;
  defenseWins?: number | null;
  capitalContributions?: number | null;
  maxTroopCount?: number | null;
  maxSpellCount?: number | null;
  superTroopsActive?: string[] | null;
  achievementCount?: number | null;
  achievementScore?: number | null;
  expLevel?: number | null;
  bestTrophies?: number | null;
  bestVersusTrophies?: number | null;
  equipmentLevels?: Record<string, number> | null;
}

/**
 * Clan roster data structure
 */
export interface Roster {
  source: "live" | "fallback" | "snapshot";
  date?: string;
  clanName?: string;
  clanTag?: string;
  members: Member[];
  seasonId?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  meta?: {
    clanName?: string;
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
  // Enhanced snapshot metadata
  snapshotMetadata?: {
    snapshotDate: string;
    fetchedAt: string;
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
    // Ranked defense freeze metadata (if provided)
    defenseSnapshotTimestamp?: string | null;
    defenseSnapshotLayoutId?: string | null;
  };
  snapshotDetails?: {
    currentWar?: {
      state: string;
      teamSize: number;
      opponent?: {
        name: string;
        tag: string;
      };
      attacksPerMember?: number;
      startTime?: string;
      endTime?: string;
    };
    warLog?: Array<{
      result: string;
      opponent: {
        name: string;
        tag: string;
      };
      endTime: string;
      teamSize: number;
      attacksPerMember: number;
    }>;
    capitalRaidSeasons?: Array<{
      capitalHallLevel: number;
      state: string;
      endTime: string;
      offensiveLoot: number;
      defensiveLoot: number;
    }>;
  };
}

/**
 * Hero level caps for each Town Hall level
 */
export type HeroCaps = Partial<Record<"bk" | "aq" | "gw" | "rc" | "mp", number>>;

/**
 * Town Hall level type
 */
export type TownHallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

// =============================================================================
// ACTIVITY & EVENTS
// =============================================================================

/**
 * Activity levels for member tracking
 */
export type ActivityLevel = 'Very Active' | 'Active' | 'Moderate' | 'Low' | 'Inactive';

/**
 * Manual activity override options
 */
export const ACTIVITY_OPTIONS = [
  "Today",
  "1-2 days", 
  "3-5 days",
  "1 week",
  "2 weeks", 
  "3 weeks",
  "1 month",
  "1+ months",
  "Inactive"
] as const;

export type ActivityOption = typeof ACTIVITY_OPTIONS[number];

/**
 * Player event types for tracking significant changes
 */
export type PlayerEventType = 
  | 'th_upgrade'
  | 'role_change'
  | 'trophy_milestone'
  | 'hero_upgrade'
  | 'donation_milestone'
  | 'name_change'
  | 'clan_join'
  | 'clan_leave';

/**
 * Individual player event
 */
export interface PlayerEvent {
  id: string;
  playerTag: string;
  playerName: string;
  eventType: PlayerEventType;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Event history mapping
 */
export type EventHistory = Record<string, PlayerEvent[]>; // playerTag -> events[]

/**
 * Activity evidence for tracking member activity
 */
export interface ActivityBreakdown {
  realtime: number;
  war: number;
  donations: number;
  capital: number;
  builder: number;
  upgrades: number;
  lab: number;
  achievements: number;
  trophies: number;
  heroProgress: number;
  role: number;
  superTroops: number;
  other: number;
}

export interface ActivityMetrics {
  lookbackDays: number;
  timelineSampleSize: number;
  realTimeScore: number;
  warStarsDelta: number;
  attackWinsDelta: number;
  defenseWinsDelta: number;
  capitalContributionDelta: number;
  builderWinsDelta: number;
  builderHallDelta: number;
  donationDelta: number;
  donationReceivedDelta: number;
  trophyDelta: number;
  rankedTrophyDelta: number;
  heroUpgrades: number;
  petUpgrades: number;
  equipmentUpgrades: number;
  labUpgradeDelta: number;
  achievementDelta: number;
  expLevelDelta: number;
  superTroopsActivated: number;
}

export interface ActivityEvidence {
  last_active_at: string;
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  indicators: string[];
  score: number;
  level: ActivityLevel;
  breakdown?: ActivityBreakdown;
  metrics?: ActivityMetrics;
  lookbackDays?: number;
  evidence?: string[];
  priority?: number;
  activity_level?: ActivityLevel | 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive';
  days_since_activity?: number;
}

export interface PlayerActivityTimelineEvent {
  date: string | null;
  trophies: number;
  rankedTrophies: number | null;
  donations: number;
  donationsReceived: number;
  activityScore: number | null;
  trophyDelta: number;
  rankedTrophyDelta: number;
  donationsDelta: number;
  donationsReceivedDelta: number;
  heroUpgrades: Array<{ hero: keyof HeroCaps; from: number | null; to: number }>;
  petUpgrades: Array<{ pet: string; from: number | null; to: number }>;
  equipmentUpgrades: Array<{ equipment: string; from: number | null; to: number }>;
  superTroopsActivated: string[];
  superTroopsDeactivated: string[];
  warStars: number;
  warStarsDelta: number;
  attackWins: number;
  attackWinsDelta: number;
  defenseWins: number;
  defenseWinsDelta: number;
  capitalContributions: number;
  capitalContributionDelta: number;
  builderHallLevel: number | null;
  builderHallDelta: number;
  versusBattleWins: number;
  versusBattleWinsDelta: number;
  maxTroopCount: number | null;
  maxTroopDelta: number;
  maxSpellCount: number | null;
  maxSpellDelta: number;
  achievementCount: number | null;
  achievementDelta: number;
  expLevel: number | null;
  expLevelDelta: number;
  summary: string;
  eventTypes?: string[];
}

export interface ActivityEnabledMember extends Member {
  activity?: ActivityEvidence | null;
  enriched?: MemberEnriched | null;
}

// =============================================================================
// LEADERSHIP & ACCESS CONTROL
// =============================================================================

/**
 * Clan roles in Clash of Clans
 */
export type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member';

/**
 * Access levels for the dashboard
 */
export type AccessLevel = 'viewer' | 'member' | 'elder' | 'coleader' | 'leader';

/**
 * Leadership check result
 */
export interface LeadershipCheck {
  isLeader: boolean;
  isCoLeader: boolean;
  isElder: boolean;
  isMember: boolean;
  role: ClanRole;
}

/**
 * Role permissions interface
 */
export interface RolePermissions {
  canViewSensitiveData: boolean;
  canModifyClanData: boolean;
  canAccessDiscordPublisher: boolean;
  canGenerateCoachingInsights: boolean;
  canManageChangeDashboard: boolean;
  canViewLeadershipFeatures: boolean;
  canManageAccess: boolean;
  canViewWarPrep: boolean;
  canManageWarPlans: boolean;
  canRunWarAnalysis: boolean;
}

/**
 * Access member for the access management system
 */
export interface AccessMember {
  id: string;
  name: string;
  accessLevel: AccessLevel;
  cocPlayerTag?: string;
  email?: string;
  notes?: string;
  addedBy?: string;
  createdAt: string;
  lastAccessed?: string;
  isActive: boolean;
}

/**
 * Clan access configuration
 */
export interface ClanAccessConfig {
  clanTag: string;
  clanName: string;
  accessMembers: AccessMember[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// DEPARTURES & NOTIFICATIONS
// =============================================================================

/**
 * Departure record for tracking members who left
 */
export interface DepartureRecord {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason?: string;
  notes?: string;
  addedBy?: string;
  lastSeen?: string;
  lastRole?: string;
  lastTownHall?: number;
  lastTrophies?: number;
}

/**
 * Rejoin notification for members who return
 */
export interface RejoinNotification {
  memberTag: string;
  memberName: string;
  rejoinDate: string;
  previousDeparture: DepartureRecord;
  daysAway: number;
  notes?: string;
}

/**
 * Departure notifications container
 */
export interface DepartureNotifications {
  rejoins: RejoinNotification[];
  activeDepartures: DepartureRecord[];
  totalCount: number;
  hasNotifications: boolean;
}

/**
 * Joiner notification for a single player
 */
export interface JoinerNotification {
  id: string;
  playerTag: string;
  playerName: string | null;
  detectedAt: string;
  metadata: {
    hasPreviousHistory: boolean;
    hasNameChange: boolean;
    previousName: string | null;
    notesCount: number;
    warningsCount: number;
    totalTenure: number;
    lastDepartureDate: string | null;
    notificationPriority: 'low' | 'medium' | 'high' | 'critical';
  };
  history: any | null;
  notes: any[];
  warnings: any[];
}

/**
 * Joiner notifications container
 */
export interface JoinerNotifications {
  critical: JoinerNotification[]; // Has warnings - HIGHEST PRIORITY
  high: JoinerNotification[]; // Has notes or name change
  medium: JoinerNotification[]; // Has previous history
  low: JoinerNotification[]; // New player
  totalCount: number;
  hasNotifications: boolean;
}

// =============================================================================
// INSIGHTS & ANALYTICS
// =============================================================================

/**
 * Coaching insight structure
*/
export interface CoachingInsight {
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  playerTag?: string;
  playerName?: string;
}

/**
 * Snapshot summary analysis
*/
export interface SnapshotSummaryAnalysis {
  type: 'change_summary' | 'full_analysis' | 'performance_review';
  content: string;
  keyInsights: string[];
  recommendations: string[];
  timestamp: string;
  clanTag: string;
}

/**
 * Player DNA insights for advanced analytics
 */
export interface PlayerDNAInsights {
  playerTag: string;
  playerName: string;
  leadership: number;      // 0-100
  performance: number;     // 0-100
  generosity: number;      // 0-100
  archetype: PlayerArchetype;
  strengths: string[];
  improvements: string[];
}

/**
 * Player archetypes based on DNA analysis
 */
export type PlayerArchetype = 
  | 'Balanced Titan'      // Perfect leadership + performance + generosity combo
  | 'Alpha Donor'         // Leader who gives massive donations
  | 'War Machine'         // High performance, low donations
  | 'Social Connector'    // High donations, moderate performance
  | 'Rising Star'         // High performance, low leadership
  | 'Veteran Leader'      // High leadership, moderate performance
  | 'Casual Player'       // Moderate across all dimensions
  | 'Inactive Member'     // Low across all dimensions
  | 'Unknown';            // Insufficient data

/**
 * Clan DNA insights
 */
export interface ClanDNAInsights {
  overallHealth: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  memberArchetypes: Record<PlayerArchetype, number>;
}

/**
 * Cached smart insights payload
 */
export interface InsightsBundle {
  timestamp: string;
  clanTag: string;
  coachingInsights: CoachingInsight[];
  summaryAnalysis?: SnapshotSummaryAnalysis;
  playerDNAInsights: PlayerDNAInsights[];
  clanDNAInsights?: ClanDNAInsights;
}

// =============================================================================
// SNAPSHOTS & CHANGES
// =============================================================================

/**
 * Daily snapshot data
 */
export interface DailySnapshot {
  date: string; // YYYY-MM-DD format
  clanTag: string;
  members: Member[];
  memberCount: number;
  createdAt: string;
}

/**
 * Change types for tracking member changes
 */
export type ChangeType = 
  | 'new_member'
  | 'left_member' 
  | 'role_change'
  | 'th_upgrade'
  | 'hero_upgrade'
  | 'trophy_change'
  | 'donation_change'
  | 'name_change'
  | 'activity_change';

/**
 * Member change record
 */
export interface MemberChange {
  type: ChangeType;
  member: {
    tag: string;
    name: string;
  };
  description: string;
  timestamp: string;
  previousValue?: any;
  newValue?: any;
  hero?: string | null;
  heroKey?: string | null;
}

/**
 * Change summary for daily snapshots
 */
export interface ChangeSummary {
  date: string;
  clanTag: string;
  changes: MemberChange[];
  summary: string;
  unread: boolean;
  actioned: boolean;
  createdAt: string;
  gameChatMessages?: string[];
}

export interface ClanGamesSeasonEntry {
  id: string;
  clanTag: string;
  seasonId: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  totalPoints: number;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
}

// =============================================================================
// UI & COMPONENT TYPES
// =============================================================================

/**
 * Sort keys for roster table
 */
export type SortKey = 
  | "name"
  | "th"
  | "bk"
  | "aq"
  | "gw"
  | "rc"
  | "mp"
  | "rush"
  | "ace"
  | "trophies"
  | "season"
  | "donations"
  | "donationsReceived"
  | "donationBalance"
  | "participation"
  | "tenure"
  | "activity"
  | "warEfficiency"
  | "warConsistency"
  | "role"
  | "actions";

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Tab types for navigation
 */
export type TabType = 
  | "roster" 
  | "changes" 
  | "snapshots"
  | "analytics"
  | "database" 
  | "coaching" 
  | "events" 
  | "applicants" 
  | "intelligence" 
  | "discord"
  | "warplanning"
  | "waranalytics"
  | "capitalanalytics"
  | "leadership";

/**
 * Status types for async operations
 */
export type Status = "idle" | "loading" | "success" | "error";

/**
 * War analytics for performance tracking
 */
export interface WarAnalytics {
  attackEfficiencyIndex: number; // Average stars per attack
  contributionConsistency: number; // Performance steadiness (0-100)
  cleanupEfficiency: number; // Cleanup success rate (0-100)
  defensiveHoldRate: number; // Defensive success rate (0-100)
  performanceTrend: 'improving' | 'stable' | 'declining';
  lastWarPerformance?: {
    stars: number;
    attacks: number;
    efficiency: number;
  };
}

/**
 * War performance data
 */
export interface WarPerformanceData {
  member: Member;
  analytics: WarAnalytics;
  historicalData: Array<{
    date: string;
    stars: number;
    attacks: number;
    efficiency: number;
    cleanupAttempts: number;
    cleanupSuccess: boolean;
    defensiveAttempts: number;
    defensiveSuccess: boolean;
  }>;
}

// =============================================================================
// API & DATA TYPES
// =============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  // Correlates requests in logs and responses
  requestId?: string;
}

// =============================================================================
// REGISTRATION TYPES
// =============================================================================

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface PendingRegistration {
  id: string;
  clanTag: string;
  playerTag: string;
  verificationCode: string;
  status: RegistrationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
}

/**
 * Player note for database
 */
export interface PlayerNote {
  timestamp: string;
  note: string;
  addedBy?: string;
}

/**
 * Player record for database
 */
export interface PlayerRecord {
  tag: string;
  name: string;
  notes: PlayerNote[];
  customFields: Record<string, string>;
  lastUpdated: string;
  status?: 'active' | 'departed'; // Track player departure status
}

/**
 * CoC API player type
 */
export interface CoCPlayer {
  tag: string;
  name: string;
  townHallLevel?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  attackWins?: number;
  defenseWins?: number;
  versusBattleWins?: number;
  versusTrophies?: number;
  builderBaseTrophies?: number;
  builderHallLevel?: number;
  warStars?: number;
  league?: {
    id: number;
    name: string;
    iconUrls: {
      small: string;
      tiny: string;
      medium: string;
    };
  };
  heroes?: Array<{
    name: string;
    level?: number;
    currentLevel?: number;
    maxLevel?: number;
    village?: string;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default page size for pagination
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Hero minimum Town Hall requirements
 */
export const HERO_MIN_TH = {
  bk: 7,  // Barbarian King unlocks at TH7
  aq: 9,  // Archer Queen unlocks at TH9
  gw: 11, // Grand Warden unlocks at TH11
  rc: 13, // Royal Champion unlocks at TH13
  mp: 9   // Master Builder unlocks at TH9 (Builder Base)
} as const;

/**
 * Maximum hero levels for each Town Hall (updated 2024)
 */
export const HERO_MAX_LEVELS: Record<number, HeroCaps> = {
  7: { bk: 5 },
  8: { bk: 10 },
  9: { bk: 30, aq: 30, mp: 5 },
  10: { bk: 40, aq: 40, mp: 10 },
  11: { bk: 50, aq: 50, gw: 20, mp: 15 },
  12: { bk: 65, aq: 65, gw: 40, mp: 65 }, // Fixed: MP max is 65 at TH12, not 20
  13: { bk: 75, aq: 75, gw: 50, rc: 25, mp: 75 }, // Fixed: MP max is 75 at TH13, not 50
  // Oct 2025: BK/AQ/GW +5 moved down to TH14
  14: { bk: 85, aq: 85, gw: 60, rc: 30, mp: 80 }, // Fixed: MP max is 80 at TH14, not 55
  15: { bk: 85, aq: 85, gw: 60, rc: 35, mp: 90 }, // Fixed: MP max is 90 at TH15, not 60
  16: { bk: 90, aq: 90, gw: 65, rc: 40, mp: 95 }, // Fixed: MP max is 95 at TH16, not 65
  // TH17 max levels (updated based on actual game data)
  17: { bk: 100, aq: 100, gw: 90, rc: 75, mp: 100 },
  // TH18 max levels (November 2025)
  18: { bk: 105, aq: 105, gw: 80, rc: 55, mp: 95 },
};

/**
 * Maximum equipment levels (estimated based on typical Clash of Clans equipment caps)
 * These are rough estimates and may need adjustment based on actual game data
 */
export const EQUIPMENT_NAME_ALIASES: Record<string, string> = {
  "Henchmen Puppet": "Hog Rider Puppet",
};

export const EQUIPMENT_MAX_LEVELS: Record<string, number> = {
  "Action Figure": 27,
  "Archer Puppet": 18,
  "Barbarian Puppet": 18,
  "Dark Crown": 27,
  "Dark Orb": 18,
  "Earthquake Boots": 18,
  "Electro Boots": 27,
  "Eternal Tome": 18,
  "Fireball": 18,
  "Frozen Arrow": 27,
  "Giant Arrow": 18,
  "Giant Gauntlet": 27,
  "Healer Puppet": 18,
  "Healing Tome": 18,
  "Heroic Torch": 18,
  "Hog Rider Puppet": 18,
  "Invisibility Vial": 18,
  "Life Gem": 18,
  "Metal Pants": 18,
  "Noble Iron": 18,
  "Rage Gem": 18,
  "Rage Vial": 18,
  "Rocket Spear": 27,
  "Royal Gem": 18,
  "Seeking Shield": 18,
  "Spiky Ball": 27,
  "Vampstache": 18,
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Make all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Make all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/**
 * Extract keys from type
 */
export type KeysOf<T> = keyof T;

/**
 * Extract values from type
 */
export type ValuesOf<T> = T[keyof T];

/**
 * Component props with children
 */
export interface ComponentWithChildren {
  children: React.ReactNode;
}

/**
 * Component props with className
 */
export interface ComponentWithClassName {
  className?: string;
}

/**
 * Component props with both children and className
 */
export interface ComponentWithChildrenAndClassName extends ComponentWithChildren, ComponentWithClassName {}
