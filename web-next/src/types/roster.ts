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
    members?: ReadonlyArray<Record<string, any>>;
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
  rushPercent?: number | null;
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
  lastUpdated?: string | null;
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
