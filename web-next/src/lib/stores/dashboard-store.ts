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
import { devtools, subscribeWithSelector } from 'zustand/middleware';
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
  EventHistory,
  PlayerEvent
} from '@/types';
import type { RolePermissions } from '@/lib/leadership';
import { ACCESS_LEVEL_PERMISSIONS, type AccessLevel } from '@/lib/access-management';
import { cfg } from '@/lib/config';
import { buildRosterFetchPlan } from '@/lib/data-source-policy';
import { showToast } from '@/lib/toast';

// =============================================================================
// STORE INTERFACES
// =============================================================================

interface DashboardState {
  // Core Data
  roster: Roster | null;
  clanTag: string;
  homeClan: string | null;
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
  
  // Modals & UI
  showAccessManager: boolean;
  showAccessSetup: boolean;
  showAccessLogin: boolean;
  showDepartureManager: boolean;
  showDepartureModal: boolean;
  showPlayerProfile: boolean;
  showSettings: boolean;
  selectedMember: Member | null;
  selectedPlayer: Member | null;
  
  // Notifications
  departureNotifications: number;
  departureNotificationsData: DepartureNotifications | null;
  dismissedNotifications: Set<string>;
  
  // Snapshots & History
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
  dataFetchedAt?: number; // timestamp when data was last fetched
  
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
  setShowDepartureModal: (show: boolean) => void;
  setShowPlayerProfile: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setSelectedMember: (member: Member | null) => void;
  setSelectedPlayer: (member: Member | null) => void;
  
  setDepartureNotifications: (count: number) => void;
  setDepartureNotificationsData: (data: DepartureNotifications | null) => void;
  setDismissedNotifications: (notifications: Set<string>) => void;
  
  setAvailableSnapshots: (snapshots: Array<{ date: string; memberCount: number }>) => void;
  setSelectedSnapshot: (snapshot: string) => void;
  setPlayerNameHistory: (history: Record<string, Array<{ name: string; timestamp: string }>>) => void;
  setEventHistory: (history: EventHistory) => void;
  setEventFilterPlayer: (player: string) => void;

  setLastLoadInfo: (info: DashboardState['lastLoadInfo']) => void;
  setDataFetchedAt: (timestamp: number) => void;
  
  // Complex Actions
  resetDashboard: () => void;
  loadRoster: (clanTag: string) => Promise<void>;
  refreshData: () => Promise<void>;
  checkDepartureNotifications: () => Promise<void>;
  dismissAllNotifications: () => void;
  hydrateRosterFromCache: () => boolean;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const DEFAULT_ACCESS_LEVEL: AccessLevel = 'leader';
const DEFAULT_CLAN_TAG = cfg.homeClanTag;

const initialState = {
  // Core Data
  roster: null,
  clanTag: DEFAULT_CLAN_TAG,
  homeClan: DEFAULT_CLAN_TAG,
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
  
  // Modals & UI
  showAccessManager: false,
  showAccessSetup: false,
  showAccessLogin: false,
  showDepartureManager: false,
  showDepartureModal: false,
  showPlayerProfile: false,
  showSettings: false,
  selectedMember: null,
  selectedPlayer: null,
  
  // Notifications
  departureNotifications: 0,
  departureNotificationsData: null,
  dismissedNotifications: new Set<string>(),
  
  // Snapshots & History
  availableSnapshots: [],
  selectedSnapshot: 'latest', // Always use snapshot data for roster
  playerNameHistory: {},
  eventHistory: {},
  eventFilterPlayer: '',
  lastLoadInfo: undefined,
  dataFetchedAt: undefined,
};

// =============================================================================
// STORE CREATION
// =============================================================================

export const useDashboardStore = create<DashboardState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      
      // =============================================================================
      // BASIC SETTERS
      // =============================================================================
      
      setRoster: (roster) => {
        console.log('[DashboardStore] setRoster called with:', {
          hasRoster: !!roster,
          memberCount: roster?.members?.length,
          clanTag: roster?.clanTag,
          source: roster?.source
        });
        set({ 
          roster,
          snapshotMetadata: roster?.snapshotMetadata || null,
          snapshotDetails: roster?.snapshotDetails || null,
        });
        try {
          if (typeof window !== 'undefined' && roster && Array.isArray(roster.members)) {
            const tag = (roster.clanTag || get().clanTag || get().homeClan || '').toString();
            if (tag) {
              localStorage.setItem(`lastRoster:${tag}`, JSON.stringify(roster));
            }
          }
        } catch {}
      },
      setClanTag: (clanTag) => set({ clanTag }),
      setHomeClan: (homeClan) => set({ homeClan }),
      setMessage: (message) => set({ message }),
      setStatus: (status) => set({ status }),
      
      // Snapshot metadata actions
      setSnapshotMetadata: (snapshotMetadata) => set({ snapshotMetadata }),
      setSnapshotDetails: (snapshotDetails) => set({ snapshotDetails }),
      clearSnapshotData: () => set({ snapshotMetadata: null, snapshotDetails: null }),
      
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
      setShowDepartureModal: (showDepartureModal) => set({ showDepartureModal }),
      setShowPlayerProfile: (showPlayerProfile) => set({ showPlayerProfile }),
      setShowSettings: (showSettings) => set({ showSettings }),
      setSelectedMember: (selectedMember) => set({ selectedMember }),
      setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
      
      setDepartureNotifications: (departureNotifications) => set({ departureNotifications }),
      setDepartureNotificationsData: (departureNotificationsData) => set({ departureNotificationsData }),
      setDismissedNotifications: (dismissedNotifications) => set({ dismissedNotifications }),
      
      setAvailableSnapshots: (availableSnapshots) => set({ availableSnapshots }),
      setSelectedSnapshot: (selectedSnapshot) => set({ selectedSnapshot }),
      setPlayerNameHistory: (playerNameHistory) => set({ playerNameHistory }),
      setEventHistory: (eventHistory) => set({ eventHistory }),
      setEventFilterPlayer: (eventFilterPlayer) => set({ eventFilterPlayer }),

      setLastLoadInfo: (lastLoadInfo) => set({ lastLoadInfo }),
      setDataFetchedAt: (dataFetchedAt) => set({ dataFetchedAt }),
      
      // =============================================================================
      // COMPLEX ACTIONS
      // =============================================================================
      
      resetDashboard: () => set(initialState),
      
      loadRoster: async (clanTag: string) => {
        const { setStatus, setMessage, setRoster, selectedSnapshot, setLastLoadInfo, setDataFetchedAt } = get();
        
        try {
          setStatus('loading');
          setMessage('');
          const t0 = Date.now();

          const plan = buildRosterFetchPlan(clanTag, selectedSnapshot);
          
          const tryFetch = async (url: string) => {
            // Add a safety timeout to avoid indefinite spin
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let res: Response;
            try {
              res = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timer);
            }
            const json = await res.json();
            return { ok: res.ok, json } as { ok: boolean; json: any };
          };

          let lastError: any = null;
          for (const url of plan.urls) {
            const result = await tryFetch(url);
            const payload = result.json?.data ?? result.json;
            if (result.ok && Array.isArray(payload?.members)) {
              setRoster(payload);
              setStatus('success');
              const src = payload?.source || plan.sourcePreference;
              setMessage(`Loaded ${payload.members.length} members (${src})`);
              // Update dev status badge info
              const tenureMatches = (payload.members || []).reduce((acc: number, m: any) => acc + (((m.tenure_days || m.tenure || 0) > 0) ? 1 : 0), 0);
              setLastLoadInfo({ source: src, ms: Date.now() - t0, tenureMatches, total: (payload.members || []).length });
              setDataFetchedAt(Date.now());
              return;
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

      // Hydrate roster from local cache for instant paint
      hydrateRosterFromCache: () => {
        try {
          if (typeof window === 'undefined') return false;
          const tag = (get().clanTag || get().homeClan || '').toString();
          if (!tag) return false;
          const raw = localStorage.getItem(`lastRoster:${tag}`);
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          // Only use cached data if it has actual members (not empty)
          if (parsed && Array.isArray(parsed.members) && parsed.members.length > 0) {
            set({ roster: parsed as Roster });
            return true;
          }
        } catch {}
        return false;
      },
      
      refreshData: async () => {
        const { clanTag, loadRoster, setStatus, setMessage, setRoster, selectedSnapshot, setLastLoadInfo, setDataFetchedAt } = get();
        if (!clanTag) return;
        
        try {
          setStatus('loading');
          setMessage('Refreshing data...');
          const t0 = Date.now();

          // Force fresh snapshot data by adding cache-busting parameter
          const base = `/api/roster?clanTag=${encodeURIComponent(clanTag)}`;
          const cacheBuster = `&_t=${Date.now()}`;
          const date = selectedSnapshot === 'latest' || !selectedSnapshot ? 'latest' : selectedSnapshot;
          
          // Always use snapshot data for roster
          const snapshotUrl = `${base}&mode=snapshot&date=${encodeURIComponent(date)}${cacheBuster}`;
          const urls = [snapshotUrl, `${base}${cacheBuster}`];

          const tryFetch = async (url: string) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let res: Response;
            try {
              res = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timer);
            }
            const json = await res.json();
            return { ok: res.ok, json } as { ok: boolean; json: any };
          };

          let lastError: any = null;
          for (const url of urls) {
            try {
              const { ok, json } = await tryFetch(url);
              if (ok && json?.members) {
                setRoster(json);
                setLastLoadInfo({
                  source: 'snapshot',
                  ms: Date.now() - t0,
                  tenureMatches: (json.members || []).reduce((acc: number, m: any) => acc + (((m.tenure_days || m.tenure || 0) > 0) ? 1 : 0), 0),
                  total: (json.members || []).length
                });
                setDataFetchedAt(Date.now());
                setStatus('success');
                setMessage(`Loaded ${json.members.length} members from snapshot data`);
                
                // Show toast notification with snapshot metadata
                if (json.snapshotMetadata) {
                  const snapshotDate = new Date(json.snapshotMetadata.snapshotDate).toLocaleDateString();
                  const fetchedTime = new Date(json.snapshotMetadata.fetchedAt).toLocaleTimeString('en-US', { 
                    hour12: false, 
                    timeZone: 'UTC' 
                  });
                  showToast(
                    `Latest snapshot: ${snapshotDate} ${fetchedTime} UTC`, 
                    'success', 
                    3000
                  );
                }
                return;
              }
              lastError = json?.error || 'Invalid response format';
            } catch (error) {
              lastError = error;
            }
          }
          
          throw lastError || new Error('All fetch attempts failed');
        } catch (error) {
          console.error('Failed to refresh roster:', error);
          setStatus('error');
          setMessage(`Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    })),
    {
      name: 'dashboard-store',
      partialize: (state: DashboardState) => ({
        // Only persist certain state to localStorage
        clanTag: state.clanTag,
        homeClan: state.homeClan,
        activeTab: state.activeTab,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        pageSize: state.pageSize,
        userRole: state.userRole,
      }),
      // Prevent hydration mismatch by using onRehydrateStorage
      onRehydrateStorage: () => (state: DashboardState | undefined) => {
        // This runs after rehydration completes
        if (state) {
          console.log('[DashboardStore] Rehydrated successfully');
        }
      },
    }
  )
);

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
    if (!state.snapshotMetadata?.fetchedAt) return null;
    const fetchedAt = new Date(state.snapshotMetadata.fetchedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff;
  },
  
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
    
    // Apply sorting
    members.sort((a, b) => {
      const aVal = a[state.sortKey as keyof Member];
      const bVal = b[state.sortKey as keyof Member];
      
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
if (typeof window !== 'undefined') {
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
if (typeof window !== 'undefined') {
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
}
