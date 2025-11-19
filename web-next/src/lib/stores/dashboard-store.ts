/**
 * Dashboard State Management with Zustand
 * 
 * This file contains the centralized state management for the dashboard,
 * replacing the scattered useState hooks with a clean, predictable state store.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { flushSync } from 'react-dom';
import {
  Member,
  Roster,
  SortKey,
  SortDirection,
  TabType,
  Status,
  ClanRole,
  AccessMember,
  DepartureNotifications,
  JoinerNotifications,
  EventHistory,
  PlayerEvent,
  ChangeSummary,
} from '@/types';
import type { RolePermissions } from '@/lib/leadership';
import { ACCESS_LEVEL_PERMISSIONS, type AccessLevel } from '@/lib/access-management';
import { cfg } from '@/lib/config';
import { CURRENT_PIPELINE_SCHEMA_VERSION } from '@/lib/pipeline-constants';
import { buildRosterFetchPlan } from '@/lib/data-source-policy';
import { showToast } from '@/lib/toast';
import { normalizeTag } from '@/lib/tags';
import type { SmartInsightsPayload, SmartInsightsHeadline } from '@/lib/smart-insights';
import { clearSmartInsightsPayload, loadSmartInsightsPayload, saveSmartInsightsPayload } from '@/lib/smart-insights-cache';
import { fetchRosterFromDataSpine, transformResponse } from '@/lib/data-spine-roster';
import type { UserRoleRecord, ClanRoleName } from '@/lib/auth/roles';

// =============================================================================
// UTILITIES
// =============================================================================

function normalizeIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function calculateSeasonInfo(timestampIso: string) {
  const date = new Date(timestampIso);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    const seasonId = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 5, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 4, 59, 59));
    return {
      seasonId,
      seasonStart: start.toISOString(),
      seasonEnd: end.toISOString(),
    };
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based (0=Jan, 1=Feb, etc.)
  
  // Handle October 2025 special case first
  if (year === 2025 && month === 9) { // October is month 9 in 0-based
    return {
      seasonId: '2025-10',
      seasonStart: new Date(Date.UTC(2025, 9, 1, 5, 0, 0)).toISOString(),
      seasonEnd: new Date(Date.UTC(2025, 9, 6, 5, 0, 0)).toISOString(),
      isSpecialSeason: true,
      note: 'Extended season - final Legend League before ranked system'
    };
  }
  
  // Season starts first of current month at 5:00 UTC
  const seasonStart = new Date(Date.UTC(year, month, 1, 5, 0, 0));
  
  // Find LAST Monday of CURRENT month at 5:00 UTC
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)); // Gets last day of current month
  const lastDay = lastDayOfMonth.getUTCDate();
  const lastDayWeekday = lastDayOfMonth.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, etc.
  
  // Calculate how many days to go back to reach the last Monday
  let daysBack;
  if (lastDayWeekday === 1) {
    // Last day is already Monday
    daysBack = 0;
  } else if (lastDayWeekday === 0) {
    // Last day is Sunday, so last Monday was 6 days ago
    daysBack = 6;
  } else {
    // For Tuesday(2) through Saturday(6), calculate days back to Monday
    daysBack = lastDayWeekday - 1;
  }
  
  const lastMondayDate = lastDay - daysBack;
  const seasonEnd = new Date(Date.UTC(year, month, lastMondayDate, 5, 0, 0));
  
  return {
    seasonId: `${year}-${String(month + 1).padStart(2, '0')}`,
    seasonStart: seasonStart.toISOString(),
    seasonEnd: seasonEnd.toISOString(),
    isSpecialSeason: false
  };
}
import { getMemberAceScore } from '@/lib/business/calculations';
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';
import type { AceScoreResult } from '@/lib/ace-score';

function normalizeRosterSeasonFields(roster: Roster | null): Roster | null {
  if (!roster) return roster;

  const normalizedMembers = Array.isArray(roster.members)
    ? roster.members.map((member) => {
        const rawTenure = typeof member.tenure_days === 'number'
          ? member.tenure_days
          : typeof (member as any).tenure === 'number'
            ? (member as any).tenure
            : null;
        if (rawTenure != null && Number.isFinite(rawTenure)) {
          const adjustedTenure = Math.max(1, Math.round(rawTenure));
          if (adjustedTenure !== rawTenure || member.tenure === undefined) {
            return {
              ...member,
              tenure_days: adjustedTenure,
              tenure: adjustedTenure,
            };
          }
          return member;
        }
        return {
          ...member,
          tenure_days: undefined,
          tenure: undefined,
        };
      })
    : roster.members;

  const metaSeasonId = roster.meta?.seasonId ?? null;
  const snapshotSeasonId = roster.snapshotMetadata?.seasonId ?? null;
  const rootSeasonId = roster.seasonId ?? null;

  const metaSeasonStart = roster.meta?.seasonStart ?? null;
  const metaSeasonEnd = roster.meta?.seasonEnd ?? null;
  const snapshotSeasonStart = roster.snapshotMetadata?.seasonStart ?? null;
  const snapshotSeasonEnd = roster.snapshotMetadata?.seasonEnd ?? null;
  const rootSeasonStart = roster.seasonStart ?? null;
  const rootSeasonEnd = roster.seasonEnd ?? null;

  let resolvedSeasonId = rootSeasonId ?? snapshotSeasonId ?? metaSeasonId ?? null;
  let resolvedSeasonStart = normalizeIso(rootSeasonStart) ?? normalizeIso(snapshotSeasonStart) ?? normalizeIso(metaSeasonStart);
  let resolvedSeasonEnd = normalizeIso(rootSeasonEnd) ?? normalizeIso(snapshotSeasonEnd) ?? normalizeIso(metaSeasonEnd);

  if ((!resolvedSeasonId || !resolvedSeasonStart || !resolvedSeasonEnd)) {
    const fallbackTimestamp = roster.snapshotMetadata?.computedAt
      ?? roster.snapshotMetadata?.fetchedAt
      ?? roster.meta?.computedAt
      ?? roster.meta?.seasonStart
      ?? null;

    if (fallbackTimestamp) {
      const seasonInfo = calculateSeasonInfo(fallbackTimestamp);
      resolvedSeasonId = resolvedSeasonId ?? seasonInfo.seasonId;
      resolvedSeasonStart = resolvedSeasonStart ?? seasonInfo.seasonStart;
      resolvedSeasonEnd = resolvedSeasonEnd ?? seasonInfo.seasonEnd;
    }
  }

  const nextMeta = { ...(roster.meta ?? {}) } as NonNullable<Roster['meta']>;
  if (resolvedSeasonId !== null) nextMeta.seasonId = resolvedSeasonId;
  if (resolvedSeasonStart !== null) nextMeta.seasonStart = resolvedSeasonStart;
  if (resolvedSeasonEnd !== null) nextMeta.seasonEnd = resolvedSeasonEnd;
  if (nextMeta.memberCount == null) {
    nextMeta.memberCount = roster.members?.length ?? roster.meta?.memberCount ?? 0;
  }
  if (nextMeta.payloadVersion == null && (roster.snapshotMetadata as any)?.payloadVersion) {
    nextMeta.payloadVersion = (roster.snapshotMetadata as any)?.payloadVersion;
  }
  if (nextMeta.ingestionVersion == null && (roster.snapshotMetadata as any)?.ingestionVersion) {
    nextMeta.ingestionVersion = (roster.snapshotMetadata as any)?.ingestionVersion;
  }
  if (nextMeta.schemaVersion == null && (roster.snapshotMetadata as any)?.schemaVersion) {
    nextMeta.schemaVersion = (roster.snapshotMetadata as any)?.schemaVersion;
  }
  if (!nextMeta.computedAt) {
    nextMeta.computedAt = roster.snapshotMetadata?.computedAt ?? roster.snapshotMetadata?.fetchedAt ?? nextMeta.seasonStart ?? null;
  }

  const nextSnapshotMetadata = { ...(roster.snapshotMetadata ?? {}) } as NonNullable<Roster['snapshotMetadata']>;
  nextSnapshotMetadata.snapshotDate = nextSnapshotMetadata.snapshotDate
    ?? (roster.date ?? (resolvedSeasonStart ? resolvedSeasonStart.slice(0, 10) : ''));
  const fallbackFetchedAt = normalizeIso(
    nextSnapshotMetadata.fetchedAt
      ?? roster.snapshotMetadata?.fetchedAt
      ?? roster.snapshotMetadata?.computedAt
      ?? roster.meta?.computedAt
      ?? roster.meta?.seasonStart
      ?? resolvedSeasonStart
  ) ?? new Date().toISOString();
  nextSnapshotMetadata.fetchedAt = fallbackFetchedAt;
  nextSnapshotMetadata.memberCount = nextSnapshotMetadata.memberCount ?? nextMeta.memberCount ?? roster.members?.length ?? 0;
  nextSnapshotMetadata.warLogEntries = nextSnapshotMetadata.warLogEntries ?? 0;
  nextSnapshotMetadata.capitalSeasons = nextSnapshotMetadata.capitalSeasons ?? 0;
  nextSnapshotMetadata.version = nextSnapshotMetadata.version ?? 'data-spine';
  nextSnapshotMetadata.payloadVersion = nextSnapshotMetadata.payloadVersion ?? nextMeta.payloadVersion ?? null;
  nextSnapshotMetadata.ingestionVersion = nextSnapshotMetadata.ingestionVersion ?? nextMeta.ingestionVersion ?? null;
  nextSnapshotMetadata.schemaVersion = nextSnapshotMetadata.schemaVersion ?? nextMeta.schemaVersion ?? null;
  nextSnapshotMetadata.computedAt = normalizeIso(
    nextSnapshotMetadata.computedAt
      ?? roster.snapshotMetadata?.computedAt
      ?? roster.meta?.computedAt
      ?? fallbackFetchedAt
  );
  nextSnapshotMetadata.seasonId = resolvedSeasonId ?? nextSnapshotMetadata.seasonId ?? null;
  nextSnapshotMetadata.seasonStart = resolvedSeasonStart ?? normalizeIso(nextSnapshotMetadata.seasonStart) ?? null;
  nextSnapshotMetadata.seasonEnd = resolvedSeasonEnd ?? normalizeIso(nextSnapshotMetadata.seasonEnd) ?? null;

  const nextRoster: Roster = {
    ...roster,
    seasonId: resolvedSeasonId ?? null,
    seasonStart: resolvedSeasonStart ?? null,
    seasonEnd: resolvedSeasonEnd ?? null,
    members: normalizedMembers ?? roster.members,
    meta: nextMeta,
    snapshotMetadata: nextSnapshotMetadata,
  };

  return nextRoster;
}

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

const EMPTY_HEADLINES: readonly SmartInsightsHeadline[] = Object.freeze([] as SmartInsightsHeadline[]);
const ROSTER_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const isDataStale = (timestamp: string | null | undefined): boolean => {
  if (!timestamp) return true;
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return true;
  return Date.now() - parsed >= STALE_THRESHOLD_MS;
};

export interface HistoryCacheEntry {
  items: ChangeSummary[];
  status: HistoryStatus;
  error?: string | null;
  lastFetched?: number;
  isRefreshing?: boolean;
}

export interface IngestionPhaseSummary {
  name: string;
  success: boolean;
  durationMs: number | null;
  rowDelta: number | null;
  errorMessage: string | null;
  metadata?: Record<string, any> | null;
}

export interface IngestionHealthSummary {
  jobId: string;
  clanTag: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number | null;
  phases: IngestionPhaseSummary[];
  anomalies: Array<{ phase: string; message: string }>;
  stale: boolean;
  logs?: Array<Record<string, any>>;
  payloadVersion?: string | null;
  ingestionVersion?: string | null;
  schemaVersion?: string | null;
  snapshotId?: string | null;
  fetchedAt?: string | null;
  computedAt?: string | null;
  seasonId?: string | null;
}


// =============================================================================
// STORE INTERFACES
// =============================================================================

interface DashboardState {
  // Core Data
  roster: Roster | null;
  clanTag: string;
  homeClan: string | null;
  hasAutoLoadedHomeClan: boolean;
  message: string;
  status: Status;
  
  // Snapshot Metadata
  snapshotMetadata: {
    snapshotDate: string;
    fetchedAt: string;
    memberCount: number;
    warLogEntries: number;
    capitalSeasons: number;
    version: string;
    seasonId?: string | null;
    seasonStart?: string | null;
    seasonEnd?: string | null;
    payloadVersion?: string | null;
    ingestionVersion?: string | null;
    schemaVersion?: string | null;
    computedAt?: string | null;
  } | null;
  snapshotDetails: {
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
  } | null;
  
  // UI State
  activeTab: TabType;
  sortKey: SortKey;
  sortDir: SortDirection;
  pageSize: number;
  page: number;
  recentClanFilter: string;
  
  // Leadership & Access
  userRole: ClanRole;
  isHydrated: boolean;
  currentAccessMember: AccessMember | null;
  accessPermissions: RolePermissions;
  needsOnboarding: boolean;
  setNeedsOnboarding: (needs: boolean) => void;
  sessionStatus: 'idle' | 'loading' | 'ready' | 'error';
  sessionError: string | null;
  
  // Modals & UI
  showAccessManager: boolean;
  showAccessSetup: boolean;
  showAccessLogin: boolean;
  showDepartureManager: boolean;
  showJoinerManager: boolean;
  showDepartureModal: boolean;
  showPlayerProfile: boolean;
  showSettings: boolean;
  showIngestionMonitor: boolean;
  ingestionJobId: string | null;
  selectedMember: Member | null;
  selectedPlayer: Member | null;
  
  // Notifications
  departureNotifications: number;
  departureNotificationsData: DepartureNotifications | null;
  dismissedNotifications: Set<string>;
  joinerNotifications: number;
  joinerNotificationsData: JoinerNotifications | null;
  dismissedJoinerNotifications: Set<string>;
  
  // Snapshots & History
  historyByClan: Record<string, HistoryCacheEntry>;
  availableSnapshots: Array<{ date: string; memberCount: number }>;
  selectedSnapshot: string;
  playerNameHistory: Record<string, Array<{ name: string; timestamp: string }>>;
  eventHistory: EventHistory;
  eventFilterPlayer: string;

  // Dev status info
  lastLoadInfo?: {
    source: 'live' | 'snapshot' | 'fallback';
    ms: number;
    tenureMatches: number;
    total: number;
  };
  
  // Data freshness info
  dataFetchedAt?: string;
  dataAge?: number;
  smartInsights: SmartInsightsPayload | null;
  smartInsightsStatus: 'idle' | 'loading' | 'success' | 'error';
  smartInsightsError: string | null;
  smartInsightsClanTag: string | null;
  smartInsightsFetchedAt?: number;
  latestSnapshotVersion: string | null;
  latestSnapshotId?: string | null;
  lastSnapshotFetchedAt?: string | null;
  lastKnownIngestionVersion: string | null;
  // auto-refresh removed

  currentUser: { id: string; email?: string | null; name?: string | null } | null;
  userRoles: UserRoleRecord[];
  impersonatedRole?: ClanRoleName | null;
  rosterViewMode: 'table' | 'cards';
  ingestionHealth: IngestionHealthSummary | null;
  isTriggeringIngestion: boolean;
  ingestionRunError: string | null;
  isRefreshingData: boolean;

  canManageAccess: () => boolean;
  canManageClanData: () => boolean;
  canSeeLeadershipFeatures: () => boolean;
  canPublishDiscord: () => boolean;
  // auto-refresh removed

  // Actions
  setRoster: (roster: Roster | null) => void;
  setClanTag: (tag: string) => void;
  setHomeClan: (tag: string | null) => void;
  setMessage: (message: string) => void;
  setStatus: (status: Status) => void;
  
  // Snapshot metadata actions
  setSnapshotMetadata: (metadata: DashboardState['snapshotMetadata']) => void;
  setSnapshotDetails: (details: DashboardState['snapshotDetails']) => void;
  clearSnapshotData: () => void;
  
  setActiveTab: (tab: TabType) => void;
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: SortDirection) => void;
  setPageSize: (size: number) => void;
  setPage: (page: number) => void;
  setRecentClanFilter: (filter: string) => void;
  
  setUserRole: (role: ClanRole) => void;
  setHydrated: (hydrated: boolean) => void;
  setCurrentAccessMember: (member: AccessMember | null) => void;
  setAccessPermissions: (permissions: Partial<RolePermissions> | null) => void;
  
  setShowAccessManager: (show: boolean) => void;
  setShowAccessSetup: (show: boolean) => void;
  setShowAccessLogin: (show: boolean) => void;
  setShowDepartureManager: (show: boolean) => void;
  setShowJoinerManager: (show: boolean) => void;
  setShowDepartureModal: (show: boolean) => void;
  setShowPlayerProfile: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowIngestionMonitor: (show: boolean, options?: { jobId?: string | null }) => void;
  setIngestionJobId: (jobId: string | null) => void;
  setSelectedMember: (member: Member | null) => void;
  setSelectedPlayer: (member: Member | null) => void;
  updateRosterMemberTenure: (playerTag: string, tenureDays: number, tenureAsOf?: string | null) => void;
  
  setDepartureNotifications: (count: number) => void;
  setDepartureNotificationsData: (data: DepartureNotifications | null) => void;
  setDismissedNotifications: (notifications: Set<string>) => void;
  setJoinerNotifications: (count: number) => void;
  setJoinerNotificationsData: (data: JoinerNotifications | null) => void;
  setDismissedJoinerNotifications: (notifications: Set<string>) => void;
  
  setAvailableSnapshots: (snapshots: Array<{ date: string; memberCount: number }>) => void;
  setSelectedSnapshot: (snapshot: string) => void;
  setPlayerNameHistory: (history: Record<string, Array<{ name: string; timestamp: string }>>) => void;
  setEventHistory: (history: EventHistory) => void;
  setEventFilterPlayer: (player: string) => void;
  loadHistory: (clanTag: string, options?: { force?: boolean; ttlMs?: number }) => Promise<void>;
  mutateHistoryItems: (clanTag: string, mutator: (items: ChangeSummary[]) => ChangeSummary[]) => void;

  setLastLoadInfo: (info: DashboardState['lastLoadInfo']) => void;
  setDataFetchedAt: (timestamp: string) => void;
  setDataAge: (age: number) => void;
  setSmartInsights: (payload: SmartInsightsPayload | null) => void;
  setCurrentUser: (user: DashboardState['currentUser']) => void;
  setUserRoles: (roles: UserRoleRecord[]) => void;
  
  // Complex Actions
  resetDashboard: () => void;
  loadRoster: (clanTag: string, options?: { mode?: 'snapshot' | 'live'; force?: boolean }) => Promise<void>;
  loadIngestionHealth: (clanTag: string) => Promise<void>;
  triggerIngestion: (clanTag: string) => Promise<void>;
  loadSmartInsights: (clanTag: string, options?: { force?: boolean; ttlMs?: number }) => Promise<void>;
  refreshData: () => Promise<void>;
  checkDepartureNotifications: () => Promise<void>;
  dismissAllNotifications: () => void;
  checkJoinerNotifications: () => Promise<void>;
  dismissAllJoinerNotifications: () => void;
  hydrateRosterFromCache: () => boolean;
  hydrateSession: () => Promise<void>;
  autoLoadHomeClanIfNeeded: () => Promise<void>;
  setImpersonatedRole: (role: ClanRoleName | null) => void;
  setRosterViewMode: (mode: 'table' | 'cards') => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const DEFAULT_ACCESS_LEVEL: AccessLevel = 'leader';
const DEFAULT_CLAN_TAG = cfg.homeClanTag;
const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours cache for change history
const SMART_INSIGHTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache for smart insights
// auto-refresh removed

const DEFAULT_IMPERSONATED_ROLE: ClanRoleName | null = null;

const initialState = {
  // Core Data
  roster: null,
  clanTag: DEFAULT_CLAN_TAG,
  homeClan: DEFAULT_CLAN_TAG,
  hasAutoLoadedHomeClan: false,
  message: '',
  status: 'idle' as Status,
  
  // Snapshot Metadata
  snapshotMetadata: null,
  snapshotDetails: null,
  
  // UI State
  activeTab: 'roster' as TabType,
  sortKey: 'trophies' as SortKey,
  sortDir: 'desc' as SortDirection,
  pageSize: 50,
  page: 1,
  recentClanFilter: '',
  
  // Leadership & Access
  userRole: 'member' as ClanRole,
  isHydrated: false,
  currentAccessMember: null,
  accessPermissions: ACCESS_LEVEL_PERMISSIONS[DEFAULT_ACCESS_LEVEL],
  needsOnboarding: false,
  setNeedsOnboarding: () => {},
  
  // Modals & UI
  showAccessManager: false,
  showAccessSetup: false,
  showAccessLogin: false,
  showDepartureManager: false,
  showJoinerManager: false,
  showDepartureModal: false,
  showPlayerProfile: false,
  showSettings: false,
  showIngestionMonitor: false,
  ingestionJobId: null,
  selectedMember: null,
  selectedPlayer: null,
  
  // Notifications
  departureNotifications: 0,
  departureNotificationsData: null,
  dismissedNotifications: new Set<string>(),
  joinerNotifications: 0,
  joinerNotificationsData: null,
  dismissedJoinerNotifications: new Set<string>(),
  
  // Snapshots & History
  historyByClan: {} as Record<string, HistoryCacheEntry>,
  availableSnapshots: [],
  selectedSnapshot: 'latest', // Always use snapshot data for roster
  playerNameHistory: {},
  eventHistory: {},
  eventFilterPlayer: '',
  lastLoadInfo: undefined,
  dataFetchedAt: undefined,
  dataAge: undefined,
  smartInsights: null,
  smartInsightsStatus: 'idle' as const,
  smartInsightsError: null,
  smartInsightsClanTag: null,
  smartInsightsFetchedAt: undefined,
  latestSnapshotVersion: null,
  latestSnapshotId: null,
  lastSnapshotFetchedAt: null,
  lastKnownIngestionVersion: null,
  currentUser: null,
  userRoles: [],
  impersonatedRole: DEFAULT_IMPERSONATED_ROLE,
  rosterViewMode: 'cards' as const,
  ingestionHealth: null,
  isTriggeringIngestion: false,
  ingestionRunError: null,
  isRefreshingData: false,
  sessionStatus: 'idle' as const,
  sessionError: null as string | null,
};

// =============================================================================
// STORE CREATION
// =============================================================================

export const useDashboardStore = create<DashboardState>()(
  // TEMPORARILY DISABLED: devtools middleware might be causing React Error #185
  // devtools(
    subscribeWithSelector((baseSet, get) => {
      const set: typeof baseSet = (partial: any, replace?: any) => {
        if (process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true') {
          try {
            const depthKey = '__dsSetDepth';
            const w: any = typeof window !== 'undefined' ? window : {};
            w[depthKey] = (w[depthKey] || 0) + 1;
            const keys = typeof partial === 'function' ? ['fn'] : Object.keys(partial || {});
            // eslint-disable-next-line no-console
            console.log('[DashboardStore.set depth=%d keys=%s]', w[depthKey], keys.join(','));
            const result = baseSet(partial as any, replace);
            w[depthKey] -= 1;
            return result;
          } catch {
            return baseSet(partial as any, replace);
          }
        }
        return baseSet(partial as any, replace);
      };
      return ({
        ...initialState,

        // =============================================================================
        // BASIC SETTERS
        // =============================================================================
      setRoster: (roster) => {
        const normalizedRoster = normalizeRosterSeasonFields(roster);
        const previousRoster = get().roster;
        if (normalizedRoster && Array.isArray(normalizedRoster.members) && previousRoster?.members?.length) {
          const previousByTag = new Map<string | undefined, typeof previousRoster.members[number]>();
          for (const member of previousRoster.members) {
            previousByTag.set(member.tag, member);
          }
          normalizedRoster.members = normalizedRoster.members.map((member) => {
            const prev = previousByTag.get(member.tag);
            const currentTenure = typeof member.tenure_days === 'number' ? member.tenure_days : (typeof (member as any).tenure === 'number' ? (member as any).tenure : null);
            const prevTenure = prev && (typeof prev.tenure_days === 'number' ? prev.tenure_days : (typeof (prev as any).tenure === 'number' ? (prev as any).tenure : null));
            if ((currentTenure == null || currentTenure < 1) && prevTenure && prevTenure > 0) {
              return {
                ...member,
                tenure_days: prevTenure,
                tenure: prevTenure,
              };
            }
            return member;
          });
        }
        const payloadVersion = normalizedRoster?.meta?.payloadVersion ?? normalizedRoster?.snapshotMetadata?.payloadVersion ?? null;
        const snapshotId = (normalizedRoster?.snapshotMetadata as any)?.snapshotId ?? null;
        const fetchedAt = normalizedRoster?.snapshotMetadata?.fetchedAt ?? normalizedRoster?.meta?.computedAt ?? null;
        set({
          roster: normalizedRoster,
          snapshotMetadata: normalizedRoster?.snapshotMetadata ?? null,
          snapshotDetails: normalizedRoster?.snapshotDetails ?? null,
          latestSnapshotVersion: payloadVersion,
          latestSnapshotId: snapshotId,
          lastSnapshotFetchedAt: fetchedAt ?? null,
          lastKnownIngestionVersion: payloadVersion ?? get().lastKnownIngestionVersion ?? null,
        });
        try {
          if (typeof window !== 'undefined' && normalizedRoster && Array.isArray(normalizedRoster.members)) {
            const tag = (normalizedRoster.clanTag || get().clanTag || get().homeClan || '').toString();
            if (tag) {
              const schemaVersion = normalizedRoster.meta?.schemaVersion ?? normalizedRoster.snapshotMetadata?.schemaVersion ?? null;
              const ingestionVersion = normalizedRoster.meta?.ingestionVersion ?? normalizedRoster.snapshotMetadata?.ingestionVersion ?? null;
              const computedAt = normalizedRoster.meta?.computedAt ?? normalizedRoster.snapshotMetadata?.computedAt ?? null;
              const cacheEntry = {
                version: payloadVersion,
                schemaVersion,
                ingestionVersion,
                computedAt,
                snapshotId,
                storedAt: Date.now(),
                roster: normalizedRoster,
              };
              localStorage.setItem(`lastRoster:v3:${tag}`, JSON.stringify(cacheEntry));
            }
          }
        } catch {}
      },
      setClanTag: (clanTag) => set({ clanTag }),
      setHomeClan: (homeClan) => {
        const normalized = homeClan ? (normalizeTag(homeClan) || homeClan) : null;
        set({ homeClan: normalized, hasAutoLoadedHomeClan: false });
        if (normalized) {
          void get().autoLoadHomeClanIfNeeded();
        }
      },
      setMessage: (message) => set({ message }),
      setStatus: (status) => set({ status }),
      
      // Snapshot metadata actions
      setSnapshotMetadata: (snapshotMetadata) => set({ snapshotMetadata }),
      setSnapshotDetails: (snapshotDetails) => set({ snapshotDetails }),
      clearSnapshotData: () => set({
        snapshotMetadata: null,
        snapshotDetails: null,
        latestSnapshotVersion: null,
        latestSnapshotId: null,
        lastSnapshotFetchedAt: null,
      }),
      
      setActiveTab: (activeTab) => set({ activeTab }),
      setSortKey: (sortKey) => set({ sortKey }),
      setSortDir: (sortDir) => set({ sortDir }),
      setPageSize: (pageSize) => set({ pageSize, page: 1 }), // Reset to first page
      setPage: (page) => set({ page }),
      setRecentClanFilter: (recentClanFilter) => set({ recentClanFilter }),
      
      setUserRole: (userRole) => set({ userRole }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      setCurrentAccessMember: (currentAccessMember) => set({ currentAccessMember }),
      setAccessPermissions: (accessPermissions) => set({ 
        accessPermissions: accessPermissions ? { ...ACCESS_LEVEL_PERMISSIONS[DEFAULT_ACCESS_LEVEL], ...accessPermissions } : ACCESS_LEVEL_PERMISSIONS[DEFAULT_ACCESS_LEVEL] 
      }),
      
      setShowAccessManager: (showAccessManager) => set({ showAccessManager }),
      setShowAccessSetup: (showAccessSetup) => set({ showAccessSetup }),
      setShowAccessLogin: (showAccessLogin) => set({ showAccessLogin }),
      setShowDepartureManager: (showDepartureManager) => set({ showDepartureManager }),
      setShowJoinerManager: (showJoinerManager) => set({ showJoinerManager }),
      setShowDepartureModal: (showDepartureModal) => set({ showDepartureModal }),
      setShowPlayerProfile: (showPlayerProfile) => set({ showPlayerProfile }),
      setShowSettings: (showSettings) => set({ showSettings }),
      setShowIngestionMonitor: (showIngestionMonitor, options = {}) => set((state) => ({
        showIngestionMonitor,
        ingestionJobId: options.jobId !== undefined ? options.jobId : state.ingestionJobId,
      })),
      setIngestionJobId: (ingestionJobId) => set({ ingestionJobId }),
      setSelectedMember: (selectedMember) => set({ selectedMember }),
      setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
      updateRosterMemberTenure: (playerTag, tenureDays, tenureAsOf) =>
        set((state) => {
          if (!state.roster?.members?.length) {
            return {};
          }
          const normalized = normalizeTag(playerTag) ?? playerTag;
          const members = state.roster.members.map((member) => {
            if ((normalizeTag(member.tag) ?? member.tag) !== normalized) {
              return member;
            }
            const nextTenure = Math.max(0, Math.round(tenureDays));
            return {
              ...member,
              tenure_days: nextTenure,
              tenure: nextTenure,
              tenure_as_of: tenureAsOf ?? member.tenure_as_of ?? null,
            };
          });
          return {
            roster: {
              ...state.roster,
              members,
            },
          } as Partial<DashboardState>;
        }),
      
      setDepartureNotifications: (departureNotifications) => set({ departureNotifications }),
      setDepartureNotificationsData: (departureNotificationsData) => set({ departureNotificationsData }),
      setDismissedNotifications: (dismissedNotifications) => set({ dismissedNotifications }),
      setJoinerNotifications: (joinerNotifications) => set({ joinerNotifications }),
      setJoinerNotificationsData: (joinerNotificationsData) => set({ joinerNotificationsData }),
      setDismissedJoinerNotifications: (dismissedJoinerNotifications) => set({ dismissedJoinerNotifications }),
      
      setAvailableSnapshots: (availableSnapshots) => set({ availableSnapshots }),
      setSelectedSnapshot: (selectedSnapshot) => set({ selectedSnapshot }),
      setPlayerNameHistory: (playerNameHistory) => set({ playerNameHistory }),
      setEventHistory: (eventHistory) => set({ eventHistory }),
      setEventFilterPlayer: (eventFilterPlayer) => set({ eventFilterPlayer }),

      setLastLoadInfo: (lastLoadInfo) => set({ lastLoadInfo }),
      setDataFetchedAt: (dataFetchedAt) => set({ dataFetchedAt }),
      setDataAge: (dataAge) => set({ dataAge }),
      setSmartInsights: (payload) => {
        if (!payload) {
          set({
            smartInsights: null,
            smartInsightsStatus: 'idle',
            smartInsightsError: null,
            smartInsightsClanTag: null,
            smartInsightsFetchedAt: undefined,
          });
          return;
        }
        const clan = normalizeTag(payload.metadata.clanTag);
        set({
          smartInsights: payload,
          smartInsightsStatus: 'success',
          smartInsightsError: null,
          smartInsightsClanTag: clan,
          smartInsightsFetchedAt: Date.now(),
        });
        saveSmartInsightsPayload(clan, payload);
      },
      setCurrentUser: (currentUser) =>
        set((state) => ({
          currentUser,
          hasAutoLoadedHomeClan: currentUser ? state.hasAutoLoadedHomeClan : false,
        })),
      setUserRoles: (userRoles) => set({ userRoles }),
      setImpersonatedRole: (impersonatedRole) => {
        const state = get();
        const normalizedClanTag = normalizeTag(state.clanTag || state.homeClan || cfg.homeClanTag || '');
        const hasLeadershipAccess = normalizedClanTag
          ? state.userRoles.some(
              (role) =>
                role.clan_tag === normalizedClanTag &&
                (role.role === 'leader' || role.role === 'coleader')
            )
          : false;

        if (!hasLeadershipAccess) {
          set({ impersonatedRole: null });
          return;
        }

        set({ impersonatedRole });
      },
      setRosterViewMode: (mode) => set({ rosterViewMode: mode }),
      loadIngestionHealth: async (clanTag: string) => {
        try {
          const normalized = normalizeTag(clanTag) || clanTag;
          const params = normalized ? `?clanTag=${encodeURIComponent(normalized)}` : '';
          const res = await fetch(`/api/ingestion/health${params}`, { cache: 'no-store' });
          if (!res.ok) {
            if (res.status === 404) {
              set({ ingestionHealth: null });
              return;
            }
            throw new Error(`Failed to load ingestion health (${res.status})`);
          }
          const payload = await res.json();
          if (!payload?.success) {
            set({ ingestionHealth: null });
            return;
          }
          const health = payload.data as IngestionHealthSummary;
          set({
            ingestionHealth: health,
            lastKnownIngestionVersion: health.payloadVersion ?? get().lastKnownIngestionVersion ?? null,
          });
        } catch (error) {
          console.warn('[loadIngestionHealth] Failed', error);
        }
      },

      // =============================================================================
      // COMPLEX ACTIONS
      // =============================================================================
      
      autoLoadHomeClanIfNeeded: async () => {
        const state = get();
        if (state.hasAutoLoadedHomeClan) return;
        if (state.sessionStatus !== 'ready') return;

        const normalizedHome = normalizeTag(state.homeClan || '') || null;
        const normalizedClan = normalizeTag(state.clanTag || '') || null;
        const fallback = normalizeTag(cfg.homeClanTag || '') || null;
        const targetClanTag = normalizedHome || normalizedClan || fallback;
        if (!targetClanTag) return;

        const rosterClanTag = normalizeTag(state.roster?.clanTag || '') || null;
        if (state.roster?.members?.length && rosterClanTag === targetClanTag) {
          set({ hasAutoLoadedHomeClan: true, clanTag: targetClanTag });
          return;
        }

        set({ hasAutoLoadedHomeClan: true, clanTag: targetClanTag });
        try {
          await state.loadRoster(targetClanTag, { force: false });
        } catch (error) {
          console.warn('[DashboardStore] Failed to auto-load home clan', error);
          set({ hasAutoLoadedHomeClan: false });
        }
      },

      resetDashboard: () => set(initialState),
      loadRoster: async (clanTag: string, options: { mode?: 'snapshot' | 'live'; force?: boolean } = {}) => {
        const {
          setStatus,
          setMessage,
          setRoster,
          selectedSnapshot,
          setLastLoadInfo,
          setDataFetchedAt,
          snapshotMetadata,
          roster,
          lastKnownIngestionVersion,
        } = get();
        const normalizedTag = normalizeTag(clanTag) || clanTag;
        const modeOverride = options.mode;
        const forceReload = options.force ?? false;
        const latestPayloadVersion = snapshotMetadata?.payloadVersion
          ?? roster?.snapshotMetadata?.payloadVersion
          ?? roster?.meta?.payloadVersion
          ?? null;
        const latestSchemaVersion = snapshotMetadata?.schemaVersion
          ?? roster?.snapshotMetadata?.schemaVersion
          ?? roster?.meta?.schemaVersion
          ?? null;
        const latestIngestionVersion = snapshotMetadata?.ingestionVersion
          ?? roster?.snapshotMetadata?.ingestionVersion
          ?? roster?.meta?.ingestionVersion
          ?? lastKnownIngestionVersion
          ?? null;
        const previousFingerprint = latestPayloadVersion || latestIngestionVersion || null;
        
        try {
          setStatus('loading');
          setMessage('');
          const t0 = Date.now();

          if (cfg.useSupabase && modeOverride !== 'live') {
            try {
              const snapshotRoster = await fetchRosterFromDataSpine(normalizedTag);
              if (snapshotRoster) {
                setRoster(snapshotRoster);
                setStatus('success');
                const memberCount = snapshotRoster.members?.length ?? 0;
              setMessage(`Loaded ${memberCount} members (snapshot)`);
              setLastLoadInfo({
                source: snapshotRoster.source || 'snapshot',
                ms: Date.now() - t0,
                tenureMatches: (snapshotRoster.members || []).reduce((acc: number, m: any) => acc + (((m.tenure_days || m.tenure || 0) > 0) ? 1 : 0), 0),
                total: memberCount,
              });
              const fetchedAt = snapshotRoster.snapshotMetadata?.computedAt
                ?? snapshotRoster.meta?.computedAt
                ?? snapshotRoster.snapshotMetadata?.fetchedAt
                ?? new Date().toISOString();
              
              // Compute season key if not provided by API
              if (!snapshotRoster.seasonId && fetchedAt) {
                const seasonInfo = calculateSeasonInfo(fetchedAt);
                snapshotRoster.seasonId = seasonInfo.seasonId;
                snapshotRoster.seasonStart = seasonInfo.seasonStart;
                snapshotRoster.seasonEnd = seasonInfo.seasonEnd;
              }
              
              setDataFetchedAt(fetchedAt);

              const shouldForceLiveRefresh = !forceReload && (modeOverride as string) !== 'live' && isDataStale(fetchedAt);
              if (shouldForceLiveRefresh) {
                await get().loadRoster(normalizedTag, { mode: 'live', force: true });
                return;
              }

              await get().loadIngestionHealth(normalizedTag);
              return;
            }
            } catch (supabaseError) {
              console.warn('[loadRoster] Failed to load roster from data spine, falling back', supabaseError);
            }
          }

          let plan = buildRosterFetchPlan(normalizedTag, modeOverride === 'live' ? 'live' : selectedSnapshot);
          if (modeOverride === 'live') {
            const base = `/api/v2/roster?clanTag=${encodeURIComponent(normalizedTag)}`;
            plan = { urls: [base], sourcePreference: 'live' };
          }
          if (forceReload) {
            const bust = Date.now();
            plan = {
              ...plan,
              urls: plan.urls.map((url) => `${url}${url.includes('?') ? '&' : '?'}_=${bust}`),
            };
          }
          
          const tryFetch = async (url: string) => {
            // Add a safety timeout to avoid indefinite spin
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let res: Response;
            try {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (!forceReload) {
            if (latestPayloadVersion) {
              headers['If-None-Match'] = `"${latestPayloadVersion}"`;
            } else if (latestIngestionVersion) {
              headers['If-None-Match'] = `W/"${latestIngestionVersion}"`;
            }
          }
          res = await fetch(url, { signal: controller.signal, headers });
            } finally {
              clearTimeout(timer);
            }
            if (res.status === 304) {
              return { ok: true, status: 304 } as { ok: boolean; status: number; json?: any };
            }
            const json = await res.json();
            return { ok: res.ok, status: res.status, json } as { ok: boolean; status: number; json: any };
          };

          let lastError: any = null;
          for (const url of plan.urls) {
            const result = await tryFetch(url);
            if (result.status === 304) {
              setStatus('success');
              const messageParts = ['Roster up to date'];
              if (latestSchemaVersion) {
                messageParts.push(`schema ${latestSchemaVersion}`);
              }
              setMessage(messageParts.join(' • '));
              setLastLoadInfo({
                source: get().lastLoadInfo?.source ?? 'snapshot',
                ms: Date.now() - t0,
                tenureMatches: get().lastLoadInfo?.tenureMatches ?? 0,
                total: get().roster?.members?.length ?? 0,
              });
              const computed = get().snapshotMetadata?.computedAt ?? get().dataFetchedAt;
              if (computed) {
                setDataFetchedAt(computed);
              }
              await get().loadIngestionHealth(normalizedTag);
              return;
            }

            const apiResponse = result.json;
            if (result.ok && apiResponse?.success && apiResponse?.data) {
              const transformedRoster = transformResponse(apiResponse);
              if (transformedRoster) {
                setRoster(transformedRoster);
                setStatus('success');
                const src = transformedRoster?.source || plan.sourcePreference;
                const newFingerprint = transformedRoster.snapshotMetadata?.payloadVersion
                  ?? transformedRoster.meta?.payloadVersion
                  ?? transformedRoster.snapshotMetadata?.ingestionVersion
                  ?? transformedRoster.meta?.ingestionVersion
                  ?? null;
                const fingerprintChanged = previousFingerprint && newFingerprint
                  ? previousFingerprint !== newFingerprint
                  : undefined;
                const schemaChanged = latestSchemaVersion && transformedRoster.snapshotMetadata?.schemaVersion
                  ? latestSchemaVersion !== transformedRoster.snapshotMetadata.schemaVersion
                  : undefined;
                const versionHints: string[] = [];
                if (fingerprintChanged) {
                  versionHints.push('new snapshot version');
                }
                if (schemaChanged) {
                  versionHints.push(`schema ${transformedRoster.snapshotMetadata?.schemaVersion ?? 'updated'}`);
                }
                const messagePrefix = `Loaded ${transformedRoster.members.length} members (${src})`;
                setMessage(versionHints.length ? `${messagePrefix} • ${versionHints.join(' • ')}` : messagePrefix);
                // Update dev status badge info
                const tenureMatches = (transformedRoster.members || []).reduce((acc: number, m: any) => acc + (((m.tenure_days || m.tenure || 0) > 0) ? 1 : 0), 0);
                setLastLoadInfo({ source: src, ms: Date.now() - t0, tenureMatches, total: (transformedRoster.members || []).length });
                const fetchedAt = transformedRoster?.snapshotMetadata?.computedAt
                  ?? transformedRoster?.meta?.computedAt
                  ?? transformedRoster?.snapshotMetadata?.fetchedAt
                  ?? new Date().toISOString();
                setDataFetchedAt(fetchedAt);
                const shouldForceLiveRefresh = !forceReload && (modeOverride as string) !== 'live' && isDataStale(fetchedAt);
                if (shouldForceLiveRefresh) {
                  await get().loadRoster(normalizedTag, { mode: 'live', force: true });
                  return;
                }
                await get().loadIngestionHealth(normalizedTag);
                return;
              }
            }
            lastError = result.json?.error || result.json?.message || 'Failed to load roster';
          }

          setStatus('error');
          setMessage(lastError || 'Failed to load roster (timeout)');
          setLastLoadInfo(undefined);
        } catch (error: any) {
          setStatus('error');
          setMessage(error.name === 'AbortError' ? 'Roster request timed out' : (error.message || 'Failed to load roster'));
          setLastLoadInfo(undefined);
        }
      },

      loadSmartInsights: async (clanTag: string, options: { force?: boolean; ttlMs?: number } = {}) => {
        const cleanTag = normalizeTag(clanTag);
        if (!cleanTag) return;

        const { smartInsightsClanTag, smartInsightsFetchedAt, smartInsightsStatus, smartInsights } = get();
        const now = Date.now();
        const ttlMs = options.ttlMs ?? SMART_INSIGHTS_CACHE_TTL_MS;
        const isRecent = smartInsightsFetchedAt ? (now - smartInsightsFetchedAt) < ttlMs : false;
        const generatedAtMs = smartInsights?.metadata?.generatedAt ? new Date(smartInsights.metadata.generatedAt).getTime() : null;
        const isGeneratedFresh = generatedAtMs ? (now - generatedAtMs) < ttlMs : false;
        const force = options.force ?? false;

        if (!force && smartInsightsClanTag === cleanTag) {
          if (smartInsightsStatus === 'loading') {
            return;
          }
          if (smartInsights && (isRecent || isGeneratedFresh)) {
            return;
          }
        }

        if (force) {
          clearSmartInsightsPayload(cleanTag);
          set({
            smartInsights: null,
            smartInsightsStatus: 'loading',
            smartInsightsError: null,
            smartInsightsClanTag: cleanTag,
            smartInsightsFetchedAt: undefined,
          });
        } else {
          set({ smartInsightsStatus: 'loading', smartInsightsError: null });
        }

        try {
          const cached = force ? null : loadSmartInsightsPayload(cleanTag);
          if (cached) {
            get().setSmartInsights(cached);
          }
          
          // If we already have fresh insights from cache and not forcing, skip fetch
          const hasFreshCached = !force && cached && (isRecent || isGeneratedFresh);
          if (hasFreshCached) {
            set({ smartInsightsStatus: 'success', smartInsightsError: null, smartInsightsClanTag: cleanTag, smartInsightsFetchedAt: Date.now() });
            return;
          }

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          let res: Response;
          try {
            res = await fetch(`/api/insights?clanTag=${encodeURIComponent(cleanTag)}`, { signal: controller.signal });
          } finally {
            clearTimeout(timer);
          }

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const data = await res.json();
          const payload: SmartInsightsPayload | null = data?.data?.smartInsightsPayload
            ?? data?.data?.payload
            ?? data?.data?.smart_insights_payload
            ?? null;

          if (payload) {
            get().setSmartInsights(payload);
          } else if (!cached) {
            set({
              smartInsights: null,
              smartInsightsStatus: 'success',
              smartInsightsError: null,
              smartInsightsClanTag: cleanTag,
              smartInsightsFetchedAt: Date.now(),
            });
          } else {
            set({ smartInsightsStatus: 'success', smartInsightsError: null, smartInsightsClanTag: cleanTag, smartInsightsFetchedAt: Date.now() });
          }
        } catch (error: any) {
          console.error('[DashboardStore] Failed to load smart insights:', error);
          set((state) => ({
            smartInsightsStatus: state.smartInsights && state.smartInsightsClanTag === cleanTag ? 'success' : 'error',
            smartInsightsError: error?.message || 'Failed to load insights',
            smartInsightsClanTag: cleanTag,
          } as unknown as DashboardState));
        }
      },

      loadHistory: async (clanTag: string, options: { force?: boolean; ttlMs?: number } = {}) => {
        const normalizedTag = normalizeTag(clanTag) || clanTag;
        if (!normalizedTag) return;

        const force = options.force ?? false;
        const ttlMs = options.ttlMs ?? HISTORY_CACHE_TTL_MS;
        const now = Date.now();

        const currentEntry = get().historyByClan[normalizedTag];
        if (!force && currentEntry?.lastFetched && now - currentEntry.lastFetched < ttlMs) {
          if (currentEntry.status === 'idle') {
            set((state) => ({
              historyByClan: {
                ...state.historyByClan,
                [normalizedTag]: { ...currentEntry, status: 'ready', error: null },
              },
            }));
          }
          return;
        }

        if (!force && (currentEntry?.status === 'loading' || currentEntry?.isRefreshing)) {
          return;
        }

        const previousItems = currentEntry?.items ?? [];
        const previousLastFetched = currentEntry?.lastFetched;

        set((state) => ({
          historyByClan: {
            ...state.historyByClan,
            [normalizedTag]: {
              items: previousItems,
              status: previousItems.length ? 'ready' : 'loading',
              error: null,
              lastFetched: previousLastFetched,
              isRefreshing: previousItems.length > 0,
            },
          },
        }));

        let storedSummaries: ChangeSummary[] = [];
        try {
          const { getAISummaries } = await import('@/lib/supabase');
          const supabaseSummaries = await getAISummaries(normalizedTag);

          storedSummaries = supabaseSummaries.map((summary: any) => ({
            date: summary.date,
            clanTag: summary.clan_tag,
            changes: [],
            summary: summary.summary,
            gameChatMessages: [],
            unread: summary.unread,
            actioned: summary.actioned,
            createdAt: summary.created_at,
          }));
        } catch (supabaseError) {
          console.warn('[DashboardStore] Failed to load insights summaries from Supabase, trying localStorage fallback:', supabaseError);
          if (typeof window !== 'undefined') {
            try {
              const savedSummaries = localStorage.getItem('ai_summaries');
              if (savedSummaries) {
                const parsed = JSON.parse(savedSummaries);
                storedSummaries = parsed
                  .filter((summary: ChangeSummary) => (normalizeTag(summary.clanTag) || summary.clanTag) === normalizedTag)
                  .map((summary: ChangeSummary) => ({
                    ...summary,
                    clanTag: normalizeTag(summary.clanTag) || summary.clanTag,
                  }));
              }
            } catch (localError) {
              console.warn('[DashboardStore] Failed to load insights summaries from localStorage:', localError);
            }
          }
        }

        let combinedChanges: ChangeSummary[] = [...storedSummaries];
        let fetchError: Error | null = null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          let response: Response;
          try {
            response = await fetch(`/api/snapshots/changes?clanTag=${encodeURIComponent(normalizedTag)}`, {
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data?.success) {
            const serverChanges: ChangeSummary[] = Array.isArray(data.changes) ? data.changes : [];
            combinedChanges = [...combinedChanges, ...serverChanges];
          } else {
            throw new Error(data?.error || 'Failed to load changes');
          }
        } catch (error: any) {
          fetchError = error instanceof Error ? error : new Error(String(error));
        }

        if (!combinedChanges.length) {
          combinedChanges = previousItems;
        }

        combinedChanges.sort((a, b) => {
          const aDate = a.createdAt || a.date;
          const bDate = b.createdAt || b.date;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

        const hasData = combinedChanges.length > 0;
        const errorMessage = fetchError ? (fetchError.message || 'Failed to load changes') : null;

        set((state) => ({
          historyByClan: {
            ...state.historyByClan,
            [normalizedTag]: {
              items: combinedChanges,
              status: hasData ? 'ready' : 'error',
              error: hasData ? errorMessage : (errorMessage ?? 'Failed to load changes'),
              lastFetched: hasData ? now : previousLastFetched,
              isRefreshing: false,
            },
          },
        }));
      },

      mutateHistoryItems: (clanTag: string, mutator: (items: ChangeSummary[]) => ChangeSummary[]) => {
        const normalizedTag = normalizeTag(clanTag) || clanTag;
        if (!normalizedTag) return;

        set((state) => {
          const entry = state.historyByClan[normalizedTag];
          const nextItems = mutator(entry?.items ?? []);
          const nextStatus: HistoryStatus = nextItems.length
            ? 'ready'
            : entry?.status === 'error'
              ? 'error'
              : 'idle';
          return {
            historyByClan: {
              ...state.historyByClan,
              [normalizedTag]: {
                items: nextItems,
                status: nextStatus,
                error: entry?.error ?? null,
                lastFetched: entry?.lastFetched,
                isRefreshing: false,
              },
            },
          };
        });
      },

      // Hydrate roster from local cache for instant paint
      hydrateRosterFromCache: () => {
        try {
          if (typeof window === 'undefined') return false;
          const tag = (get().clanTag || get().homeClan || '').toString();
          if (!tag) return false;
          const raw = localStorage.getItem(`lastRoster:v3:${tag}`);
          if (!raw) return false;
          const parsed = JSON.parse(raw) as
            | Roster
            | {
                version?: string | null;
                schemaVersion?: string | null;
                ingestionVersion?: string | null;
                computedAt?: string | null;
                storedAt?: number;
                roster: Roster;
              };

          const cachedRoster: Roster | undefined = (parsed as any)?.roster ?? (parsed as Roster);
          if (!cachedRoster || !Array.isArray(cachedRoster.members) || !cachedRoster.members.length) {
            return false;
          }

          const schemaVersion = (parsed as any)?.schemaVersion ?? cachedRoster.meta?.schemaVersion ?? cachedRoster.snapshotMetadata?.schemaVersion ?? null;
          if (schemaVersion && schemaVersion !== CURRENT_PIPELINE_SCHEMA_VERSION) {
            return false;
          }

          const storedAt: number | undefined = (parsed as any)?.storedAt;
          if (typeof storedAt === 'number' && Date.now() - storedAt > ROSTER_CACHE_MAX_AGE_MS) {
            return false;
          }

          const normalized = normalizeRosterSeasonFields(cachedRoster);
          set({
            roster: normalized,
            snapshotMetadata: normalized?.snapshotMetadata ?? null,
            snapshotDetails: normalized?.snapshotDetails ?? null,
          });
          const computedAt = (parsed as any)?.computedAt ?? normalized?.meta?.computedAt ?? normalized?.snapshotMetadata?.computedAt ?? null;
          if (computedAt) {
            set({ dataFetchedAt: computedAt });
          }
            return true;
        } catch {}
        return false;
      },

      triggerIngestion: async (clanTag: string) => {
        const { loadRoster, loadIngestionHealth } = get();
        const normalizedTag = normalizeTag(clanTag) || clanTag;
        if (!normalizedTag) {
          set({ ingestionRunError: 'No clan tag available to run ingestion.' });
          return;
        }

        set({ isTriggeringIngestion: true, ingestionRunError: null });

        try {
          const res = await fetch('/api/admin/run-staged-ingestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clanTag: normalizedTag })
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload?.success) {
            const message = payload?.error || 'Ingestion run failed';
            throw new Error(message);
          }

          await loadRoster(normalizedTag, { mode: 'snapshot', force: true });
          await loadIngestionHealth(normalizedTag);
        } catch (error: any) {
          const message = error?.message || 'Failed to trigger ingestion';
          set({ ingestionRunError: message });
        } finally {
          set({ isTriggeringIngestion: false });
        }
      },

      hydrateSession: async () => {
        const state = get();
        if (state.sessionStatus === 'loading') {
          return;
        }

        set({ sessionStatus: 'loading', sessionError: null });

        try {
          const res = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' });
          if (!res.ok) {
            set({
              currentUser: null,
              userRoles: [],
              sessionStatus: 'error',
              sessionError: 'Unable to load session',
              impersonatedRole: null,
              needsOnboarding: false,
            });
            return;
          }
          const body = await res.json();
          if (!body?.success) {
            set({
              currentUser: null,
              userRoles: [],
              sessionStatus: 'error',
              sessionError: body?.error || 'Unable to load session',
              impersonatedRole: null,
              needsOnboarding: false,
            });
            return;
          }

          const roles: UserRoleRecord[] = body.data?.roles ?? [];
          const nextUser = body.data?.user ?? null;
          const currentState = get();
          const normalizedClanTag = normalizeTag(currentState.clanTag || currentState.homeClan || cfg.homeClanTag || '');
          const hasLeadershipAccess = normalizedClanTag
            ? roles.some(
                (role) =>
                  role.clan_tag === normalizedClanTag &&
                  (role.role === 'leader' || role.role === 'coleader')
              )
            : false;

          const needsOnboarding = Boolean(body.data?.needsOnboarding);
          set({
            currentUser: nextUser,
            userRoles: roles,
            sessionStatus: 'ready',
            sessionError: null,
            impersonatedRole: hasLeadershipAccess ? currentState.impersonatedRole : null,
            needsOnboarding,
          });
          void get().autoLoadHomeClanIfNeeded();
        } catch (error) {
          console.warn('[hydrateSession] Failed', error);
          set({
            currentUser: null,
            userRoles: [],
            sessionStatus: 'error',
            sessionError: 'Failed to connect to session endpoint',
            impersonatedRole: null,
            needsOnboarding: false,
          });
        }
      },

      setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),

      canManageAccess: () => {
        const state = get();
        const clanTag = normalizeTag(state.clanTag || state.homeClan || cfg.homeClanTag || '');
        const roles = state.userRoles;
        const effectiveRole = state.impersonatedRole;
        if (effectiveRole) {
          return effectiveRole === 'leader';
        }
        return roles.some((role) => role.clan_tag === clanTag && role.role === 'leader');
      },
      canManageClanData: () => {
        const state = get();
        const clanTag = normalizeTag(state.clanTag || state.homeClan || cfg.homeClanTag || '');
        const effectiveRole = state.impersonatedRole;
        if (effectiveRole) {
          return effectiveRole === 'leader' || effectiveRole === 'coleader';
        }
        return state.userRoles.some((role) => role.clan_tag === clanTag && (role.role === 'leader' || role.role === 'coleader'));
      },
      canSeeLeadershipFeatures: () => {
        const state = get();
        const clanTag = normalizeTag(state.clanTag || state.homeClan || cfg.homeClanTag || '');
        const effectiveRole = state.impersonatedRole;
        if (effectiveRole) {
          return effectiveRole === 'leader' || effectiveRole === 'coleader';
        }
        return state.userRoles.some((role) => role.clan_tag === clanTag && (role.role === 'leader' || role.role === 'coleader'));
      },
      canPublishDiscord: () => {
        const state = get();
        const clanTag = normalizeTag(state.clanTag || state.homeClan || cfg.homeClanTag || '');
        const effectiveRole = state.impersonatedRole;
        if (effectiveRole) {
          return effectiveRole === 'leader' || effectiveRole === 'coleader';
        }
        return state.userRoles.some((role) => role.clan_tag === clanTag && (role.role === 'leader' || role.role === 'coleader'));
      },
      // auto-refresh removed

      refreshData: async () => {
        if (get().isRefreshingData) {
          return;
        }

        const { clanTag, loadRoster } = get();
        if (!clanTag) {
          set({
            message: 'Load a clan first to refresh data',
            status: 'error',
          });
          return;
        }

        set({
          status: 'loading',
          message: 'Refreshing snapshot from Supabase…',
          isRefreshingData: true,
        });

        try {
          await loadRoster(clanTag, { mode: 'snapshot', force: true });
          set({
            status: 'success',
            message: 'Snapshot data refreshed',
          });
        } catch (error) {
          console.error('Failed to refresh roster:', error);
          set({
            status: 'error',
            message: `Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        } finally {
          set({ isRefreshingData: false });
        }
      },
      
      checkDepartureNotifications: async () => {
        const { clanTag, homeClan, setDepartureNotifications, setDepartureNotificationsData, setDismissedNotifications } = get();
        const currentTag = clanTag || homeClan;
        
        if (!currentTag) return;
        
        try {
          const response = await fetch(`/api/departures/notifications?clanTag=${encodeURIComponent(currentTag)}`);
          const data = await response.json();
          
          if (data.success) {
            // Load dismissed notifications from localStorage
            const dismissed = new Set<string>();
            try {
              const stored = localStorage.getItem('dismissedNotifications');
              if (stored) {
                const parsed = JSON.parse(stored);
                parsed.forEach((tag: string) => dismissed.add(tag));
              }
            } catch (error) {
              console.error('Failed to load dismissed notifications:', error);
            }
            
            setDismissedNotifications(dismissed);
            
            // Calculate active notifications count
            let activeCount = 0;
            if (data.notifications) {
              activeCount += data.notifications.rejoins?.filter((r: any) => !dismissed.has(r.memberTag)).length || 0;
              activeCount += data.notifications.activeDepartures?.filter((d: any) => !dismissed.has(d.memberTag)).length || 0;
            }
            
            setDepartureNotifications(activeCount);
            setDepartureNotificationsData({
              ...data.notifications,
              hasNotifications: activeCount > 0
            });
          } else {
            setDepartureNotifications(0);
            setDepartureNotificationsData(null);
          }
        } catch (error) {
          console.error('Failed to check departure notifications:', error);
          setDepartureNotifications(0);
          setDepartureNotificationsData(null);
        }
      },
      
      dismissAllNotifications: () => {
        const { departureNotificationsData, setDismissedNotifications } = get();
        if (departureNotificationsData) {
          const newDismissed = new Set<string>();
          departureNotificationsData.rejoins.forEach(rejoin => {
            newDismissed.add(rejoin.memberTag);
          });
          departureNotificationsData.activeDepartures.forEach(departure => {
            newDismissed.add(departure.memberTag);
          });
          setDismissedNotifications(newDismissed);
        }
      },
      
      checkJoinerNotifications: async () => {
        const { clanTag, homeClan, setJoinerNotifications, setJoinerNotificationsData, setDismissedJoinerNotifications } = get();
        const currentTag = clanTag || homeClan;
        
        if (!currentTag) return;
        
        try {
          const response = await fetch(`/api/joiners/notifications?clanTag=${encodeURIComponent(currentTag)}&days=7`);
          const data = await response.json();
          
          if (data.success && data.data) {
            // Load dismissed notifications from localStorage
            const dismissed = new Set<string>();
            try {
              const stored = localStorage.getItem('dismissedJoinerNotifications');
              if (stored) {
                const parsed = JSON.parse(stored);
                parsed.forEach((id: string) => dismissed.add(id));
              }
            } catch (error) {
              console.error('Failed to load dismissed joiner notifications:', error);
            }
            
            setDismissedJoinerNotifications(dismissed);
            
            // Calculate active notifications count (excluding dismissed)
            // Prioritize critical (warnings) and high priority notifications
            let activeCount = 0;
            const notifications = data.data;
            
            // Count critical (warnings) - highest priority
            activeCount += notifications.critical?.filter((n: any) => !dismissed.has(n.id)).length || 0;
            // Count high priority (notes or name change)
            activeCount += notifications.high?.filter((n: any) => !dismissed.has(n.id)).length || 0;
            // Count medium priority (previous history)
            activeCount += notifications.medium?.filter((n: any) => !dismissed.has(n.id)).length || 0;
            // Count low priority (new players) - only if they have some history
            activeCount += notifications.low?.filter((n: any) => !dismissed.has(n.id)).length || 0;
            
            setJoinerNotifications(activeCount);
            setJoinerNotificationsData(notifications);
          } else {
            setJoinerNotifications(0);
            setJoinerNotificationsData(null);
          }
        } catch (error) {
          console.error('Failed to check joiner notifications:', error);
          setJoinerNotifications(0);
          setJoinerNotificationsData(null);
        }
      },
      
      dismissAllJoinerNotifications: () => {
        const { joinerNotificationsData, setDismissedJoinerNotifications } = get();
        if (joinerNotificationsData) {
          const newDismissed = new Set<string>();
          [
            ...joinerNotificationsData.critical,
            ...joinerNotificationsData.high,
            ...joinerNotificationsData.medium,
            ...joinerNotificationsData.low,
          ].forEach((notification) => {
            newDismissed.add(notification.id);
          });
          setDismissedJoinerNotifications(newDismissed);
          
          // Persist to localStorage
          try {
            localStorage.setItem('dismissedJoinerNotifications', JSON.stringify(Array.from(newDismissed)));
          } catch (error) {
            console.error('Failed to save dismissed joiner notifications:', error);
          }
        }
      },
    });
  })
  // TEMPORARILY DISABLED: devtools options might be causing React Error #185
  // );
);

// Expose store to window for debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__dashboardStore = useDashboardStore;
}
    // , {
    //   name: 'dashboard-store',
    //   partialize: (state: DashboardState) => ({
    //     // Only persist certain state to localStorage
    //     clanTag: state.clanTag,
    //     homeClan: state.homeClan,
    //     activeTab: state.activeTab,
    //     sortKey: state.sortKey,
    //     sortDir: state.sortDir,
    //     pageSize: state.pageSize,
    //     userRole: state.userRole,
    //   }),
    //   // Prevent hydration mismatch by using onRehydrateStorage
    //   onRehydrateStorage: () => (state: DashboardState | undefined) => {
    //     // This runs after rehydration completes
    //     if (state) {
    //       console.log('[DashboardStore] Rehydrated successfully');
    //     }
    //   },
    // }
  // )

// =============================================================================
// SELECTORS
// =============================================================================

// Selectors for computed values
export const selectors = {
  // Get current clan name
  clanName: (state: DashboardState) => 
    state.roster?.clanName ?? state.roster?.meta?.clanName ?? '',
  
  // Get current member count
  memberCount: (state: DashboardState) => 
    state.roster?.members?.length ?? 0,
  
  // Snapshot metadata selectors
  snapshotMetadata: (state: DashboardState) => state.snapshotMetadata,
  snapshotDetails: (state: DashboardState) => state.snapshotDetails,
  isDataFresh: (state: DashboardState) => {
    if (!state.snapshotMetadata?.fetchedAt) return false;
    const fetchedAt = new Date(state.snapshotMetadata.fetchedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  },
  dataAge: (state: DashboardState) => {
    if (!state.snapshotMetadata?.fetchedAt) return undefined;
    const fetchedAt = new Date(state.snapshotMetadata.fetchedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff;
  },
  smartInsights: (state: DashboardState) => state.smartInsights,
  smartInsightsStatus: (state: DashboardState) => state.smartInsightsStatus,
  smartInsightsError: (state: DashboardState) => state.smartInsightsError,
  smartInsightsHeadlines: (state: DashboardState) => state.smartInsights?.headlines ?? EMPTY_HEADLINES,
  rosterViewMode: (state: DashboardState) => state.rosterViewMode,
  smartInsightsIsStale: (state: DashboardState) => {
    // Only show "stale" if insights exist AND are old (>24h)
    // Don't show "stale" if insights simply don't exist yet
    if (!state.smartInsights?.metadata.generatedAt) return false;
    const generatedAt = new Date(state.smartInsights.metadata.generatedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24;
  },
  smartInsightsSource: (state: DashboardState) => state.smartInsights?.metadata.source ?? 'unknown',

  // Get sorted and filtered members
  sortedMembers: (state: DashboardState) => {
    if (!state.roster?.members) return [];
    
    let members = [...state.roster.members];
    
    // Apply recent clan filter
    if (state.recentClanFilter) {
      members = members.filter(m => 
        m.recentClans?.includes(state.recentClanFilter)
      );
    }
    
    let aceScoresByTag: Map<string, AceScoreResult> | null = null;
    if (state.sortKey === 'ace' && state.roster?.members?.length) {
      const inputs = createAceInputsFromRoster(state.roster);
      if (inputs.length) {
        const results = calculateAceScores(inputs);
        aceScoresByTag = new Map<string, AceScoreResult>();
        const register = (tag: string | null | undefined, entry: AceScoreResult) => {
          if (!tag) return;
          aceScoresByTag!.set(tag, entry);
          aceScoresByTag!.set(tag.toUpperCase(), entry);
          const stripped = tag.replace(/^#/, '');
          if (stripped && stripped !== tag) {
            aceScoresByTag!.set(stripped, entry);
            aceScoresByTag!.set(stripped.toUpperCase(), entry);
          }
        };
        results.forEach((entry) => register(entry.tag, entry));
      }
    }

    // Apply sorting
    members.sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      switch (state.sortKey) {
        case 'ace':
          if (aceScoresByTag) {
            const resolve = (member: Member) => {
              const rawTag = member.tag ?? '';
              if (!rawTag) return null;
              const normalized = rawTag.replace(/^#/, '');
              return (
                aceScoresByTag!.get(rawTag) ||
                aceScoresByTag!.get(rawTag.toUpperCase()) ||
                aceScoresByTag!.get(normalized) ||
                aceScoresByTag!.get(normalized.toUpperCase()) ||
                null
              );
            };
            const aEntry = resolve(a);
            const bEntry = resolve(b);
            aVal = typeof aEntry?.ace === 'number' ? aEntry.ace : Number.NEGATIVE_INFINITY;
            bVal = typeof bEntry?.ace === 'number' ? bEntry.ace : Number.NEGATIVE_INFINITY;
          } else {
            aVal = getMemberAceScore(a) ?? Number.NEGATIVE_INFINITY;
            bVal = getMemberAceScore(b) ?? Number.NEGATIVE_INFINITY;
          }
          break;
        default:
          aVal = a[state.sortKey as keyof Member];
          bVal = b[state.sortKey as keyof Member];
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return state.sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      
      return state.sortDir === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    
    return members;
  },
  
  // Get paginated members
  paginatedMembers: (state: DashboardState) => {
    const sorted = selectors.sortedMembers(state);
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    return sorted.slice(start, end);
  },
  
  // Check if user has leadership access
  hasLeadershipAccess: (state: DashboardState) => 
    state.userRole === 'leader' || state.userRole === 'coLeader',
  
  // Check if user can manage access
  canManageAccess: (state: DashboardState) => 
    state.userRole === 'leader',
  
  // Check if user can modify clan data
  canModifyClanData: (state: DashboardState) => 
    state.userRole === 'leader' || state.userRole === 'coLeader',
};

// =============================================================================
// SUBSCRIPTIONS
// =============================================================================

// Subscribe to localStorage changes for persistence
// Gate correctly with SUBSCRIPTIONS flag (was HYDRATION)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_STORE_SUBSCRIPTIONS !== 'true') {
  useDashboardStore.subscribe(
    (state) => state.clanTag,
    (clanTag) => {
      if (clanTag) {
        localStorage.setItem('currentClanTag', clanTag);
      } else {
        localStorage.removeItem('currentClanTag');
      }
    }
  );
  
  useDashboardStore.subscribe(
    (state) => state.homeClan,
    (homeClan) => {
      if (homeClan) {
        localStorage.setItem('homeClanTag', homeClan);
      } else {
        localStorage.removeItem('homeClanTag');
      }
    }
  );
  
  useDashboardStore.subscribe(
    (state) => state.userRole,
    (userRole) => {
      localStorage.setItem('userRole', userRole);
    }
  );
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Hydrate store from localStorage on client-side initialization
// Gate correctly with HYDRATION flag (was SUBSCRIPTIONS)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_STORE_HYDRATION !== 'true') {
  const hydrateFromStorage = () => {
    try {
      const currentClanTag = localStorage.getItem('currentClanTag');
      const homeClanTag = localStorage.getItem('homeClanTag');
      const userRole = localStorage.getItem('userRole');
      
      if (currentClanTag || homeClanTag || userRole) {
        useDashboardStore.setState((state) => ({
          ...state,
          clanTag: currentClanTag || state.clanTag,
          homeClan: homeClanTag || state.homeClan,
          userRole: (userRole as ClanRole) || state.userRole,
        }));
      }
    } catch (error) {
      console.error('[DashboardStore] Failed to hydrate from localStorage:', error);
    }
  };
  
  // Hydrate immediately
  hydrateFromStorage();

  // AUTO-REFRESH DISABLED: Timing hacks are not the solution
  // The real issue is that auto-refresh is fundamentally incompatible with how the app is architected
  // TODO: Re-architect auto-refresh to use a proper React pattern (useEffect hook in a component)
  // instead of trying to initialize it from the store module scope
  
  // For now, users can manually refresh when needed
  // This keeps the app stable and functional
}

// =============================================================================
// EMERGENCY FIX: Shallow Comparison Hook
// =============================================================================

/**
 * USE THIS INSTEAD OF useDashboardStore for subscribing to objects/arrays
 * This prevents infinite loops by using shallow comparison
 * 
 * Example:
 * const roster = useDashboardStoreShallow((state) => state.roster);
 * 
 * In Zustand v5, use it like this:
 * const roster = useDashboardStore(useShallow((state) => state.roster));
 */
export { useShallow };
