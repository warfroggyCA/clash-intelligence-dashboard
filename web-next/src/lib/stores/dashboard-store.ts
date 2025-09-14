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
  accessPermissions: any;
  
  // Modals & UI
  showAccessManager: boolean;
  showAccessSetup: boolean;
  showAccessLogin: boolean;
  showDepartureManager: boolean;
  showDepartureModal: boolean;
  showPlayerProfile: boolean;
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
  
  // Actions
  setRoster: (roster: Roster | null) => void;
  setClanTag: (tag: string) => void;
  setHomeClan: (tag: string | null) => void;
  setMessage: (message: string) => void;
  setStatus: (status: Status) => void;
  
  setActiveTab: (tab: TabType) => void;
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: SortDirection) => void;
  setPageSize: (size: number) => void;
  setPage: (page: number) => void;
  setRecentClanFilter: (filter: string) => void;
  
  setUserRole: (role: ClanRole) => void;
  setHydrated: (hydrated: boolean) => void;
  setCurrentAccessMember: (member: AccessMember | null) => void;
  setAccessPermissions: (permissions: any) => void;
  
  setShowAccessManager: (show: boolean) => void;
  setShowAccessSetup: (show: boolean) => void;
  setShowAccessLogin: (show: boolean) => void;
  setShowDepartureManager: (show: boolean) => void;
  setShowDepartureModal: (show: boolean) => void;
  setShowPlayerProfile: (show: boolean) => void;
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
  
  // Complex Actions
  resetDashboard: () => void;
  loadRoster: (clanTag: string) => Promise<void>;
  refreshData: () => Promise<void>;
  checkDepartureNotifications: () => Promise<void>;
  dismissAllNotifications: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState = {
  // Core Data
  roster: null,
  clanTag: '',
  homeClan: null,
  message: '',
  status: 'idle' as Status,
  
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
  accessPermissions: null,
  
  // Modals & UI
  showAccessManager: false,
  showAccessSetup: false,
  showAccessLogin: false,
  showDepartureManager: false,
  showDepartureModal: false,
  showPlayerProfile: false,
  selectedMember: null,
  selectedPlayer: null,
  
  // Notifications
  departureNotifications: 0,
  departureNotificationsData: null,
  dismissedNotifications: new Set<string>(),
  
  // Snapshots & History
  availableSnapshots: [],
  selectedSnapshot: 'latest',
  playerNameHistory: {},
  eventHistory: {},
  eventFilterPlayer: '',
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
      
      setRoster: (roster) => set({ roster }),
      setClanTag: (clanTag) => set({ clanTag }),
      setHomeClan: (homeClan) => set({ homeClan }),
      setMessage: (message) => set({ message }),
      setStatus: (status) => set({ status }),
      
      setActiveTab: (activeTab) => set({ activeTab }),
      setSortKey: (sortKey) => set({ sortKey }),
      setSortDir: (sortDir) => set({ sortDir }),
      setPageSize: (pageSize) => set({ pageSize, page: 1 }), // Reset to first page
      setPage: (page) => set({ page }),
      setRecentClanFilter: (recentClanFilter) => set({ recentClanFilter }),
      
      setUserRole: (userRole) => set({ userRole }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      setCurrentAccessMember: (currentAccessMember) => set({ currentAccessMember }),
      setAccessPermissions: (accessPermissions) => set({ accessPermissions }),
      
      setShowAccessManager: (showAccessManager) => set({ showAccessManager }),
      setShowAccessSetup: (showAccessSetup) => set({ showAccessSetup }),
      setShowAccessLogin: (showAccessLogin) => set({ showAccessLogin }),
      setShowDepartureManager: (showDepartureManager) => set({ showDepartureManager }),
      setShowDepartureModal: (showDepartureModal) => set({ showDepartureModal }),
      setShowPlayerProfile: (showPlayerProfile) => set({ showPlayerProfile }),
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
      
      // =============================================================================
      // COMPLEX ACTIONS
      // =============================================================================
      
      resetDashboard: () => set(initialState),
      
      loadRoster: async (clanTag: string) => {
        const { setStatus, setMessage, setRoster } = get();
        
        try {
          setStatus('loading');
          setMessage('');
          
          const response = await fetch(`/api/roster?clanTag=${encodeURIComponent(clanTag)}`);
          const data = await response.json();
          
          if (data.members && Array.isArray(data.members)) {
            setRoster(data);
            setStatus('success');
            setMessage(`Loaded ${data.members.length} members`);
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to load roster');
          }
        } catch (error: any) {
          setStatus('error');
          setMessage(error.message || 'Failed to load roster');
        }
      },
      
      refreshData: async () => {
        const { clanTag, loadRoster } = get();
        if (clanTag) {
          await loadRoster(clanTag);
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
      onRehydrateStorage: () => (state) => {
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

// Zustand persistence will handle initialization automatically
