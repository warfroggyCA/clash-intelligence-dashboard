import type { HeroCaps } from '@/types';

export const CANONICAL_MEMBER_SNAPSHOT_VERSION = 'canonical-member-snapshot/v1' as const;

export type CanonicalHeroLevels = Partial<Record<keyof HeroCaps, number | null>>;

export interface CanonicalMemberSnapshotV1 {
  schemaVersion: typeof CANONICAL_MEMBER_SNAPSHOT_VERSION;
  clanTag: string;
  clanName: string | null;
  playerTag: string;
  snapshotId: string;
  snapshotDate: string;
  fetchedAt: string;
  computedAt: string | null;
  roster: {
    memberCount: number;
    totalTrophies: number | null;
    totalDonations: number | null;
  };
  member: CanonicalMemberRecord;
}

export interface CanonicalMemberRecord {
  tag: string;
  name: string | null;
  role: string | null;
  townHallLevel: number | null;
  trophies: number | null;
  league: LeagueInfo | null;
  ranked: RankedInfo;
  donations: DonationInfo;
  activityScore: number | null;
  heroLevels: CanonicalHeroLevels | null;
  rushPercent: number | null;
  war: WarInfo;
  builderBase: BuilderBaseInfo;
  capitalContributions: number | null;
  pets: Record<string, number> | null;
  equipmentLevels: Record<string, number> | null;
  achievements: AchievementInfo;
  expLevel: number | null;
  bestTrophies: number | null;
  bestVersusTrophies: number | null;
  superTroopsActive: string[] | null;
  tenure: TenureInfo;
  metrics?: Record<string, { value: number; metadata?: Record<string, any> | null }>;
  extras?: Record<string, any> | null;
}

export interface LeagueInfo {
  id: number | null;
  name: string | null;
  trophies: number | null;
  iconSmall: string | null;
  iconMedium: string | null;
}

export interface RankedInfo {
  trophies: number | null;
  leagueId: number | null;
  leagueName: string | null;
  iconSmall: string | null;
  iconMedium: string | null;
}

export interface DonationInfo {
  given: number | null;
  received: number | null;
}

export interface WarInfo {
  stars: number | null;
  attackWins: number | null;
  defenseWins: number | null;
}

export interface BuilderBaseInfo {
  hallLevel: number | null;
  trophies: number | null;
  battleWins: number | null;
  leagueId: number | null;
}

export interface AchievementInfo {
  count: number | null;
  score: number | null;
}

export interface TenureInfo {
  days: number | null;
  asOf: string | null;
}
