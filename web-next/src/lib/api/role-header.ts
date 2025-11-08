/**
 * Role Header Utility
 * Adds user role header to API requests for temporary role-based filtering
 * TODO: Replace with real authentication when implemented
 */

import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { ClanRoleName } from '@/lib/auth/roles';

/**
 * Get current user role from Zustand store (impersonation system)
 * Falls back to 'member' if not set
 */
export function getCurrentUserRole(): string {
  if (typeof window === 'undefined') {
    return 'member';
  }

  try {
    // Get role from Zustand store
    const store = useDashboardStore.getState();
    const impersonatedRole = store.impersonatedRole;
    const userRoles = store.userRoles;
    const clanTag = store.clanTag || store.homeClan || '';

    let currentRole: string = 'member';

    if (impersonatedRole) {
      currentRole = impersonatedRole;
    } else if (clanTag) {
      const normalized = clanTag.trim().toUpperCase();
      const match = userRoles.find((r) => r.clan_tag === normalized);
      if (match) {
        currentRole = match.role;
      }
    }

    // Normalize coLeader to coleader for backend consistency
    // Handle both 'coLeader' (from store) and 'coleader' (from database)
    if (currentRole === 'coLeader' || currentRole === 'coleader') {
      return 'coleader';
    }
    return currentRole;
  } catch (error) {
    console.warn('[getCurrentUserRole] Error getting role:', error);
    return 'member';
  }
}

/**
 * Get headers with role information
 * Use this when making API calls that need role-based filtering
 */
export function getRoleHeaders(): HeadersInit {
  const role = getCurrentUserRole();
  return {
    'x-user-role': role,
  };
}

/**
 * Check if current role is leadership (leader or coLeader)
 */
export function isLeadershipRole(): boolean {
  const role = getCurrentUserRole();
  return role === 'leader' || role === 'coleader' || role === 'coLeader';
}

