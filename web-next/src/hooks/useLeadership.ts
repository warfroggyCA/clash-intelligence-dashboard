import { useMemo } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { checkLeadershipAccess, getRolePermissions, type LeadershipCheck, type RolePermissions, type ClanRole, clanRoleFromName } from '../lib/leadership';

export interface UseLeadershipResult {
  check: LeadershipCheck;
  permissions: RolePermissions;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check leadership access for the current user
 * Uses localStorage for role persistence during development
 */
export function useLeadership(): UseLeadershipResult {
  const userRoles = useDashboardStore((state) => state.userRoles);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);

  const derived = useMemo(() => {
    let role: ClanRole = 'member';
    if (impersonatedRole) {
      if (impersonatedRole === 'coleader') {
        role = 'coLeader';
      } else if (impersonatedRole === 'leader') {
        role = 'leader';
      } else if (impersonatedRole === 'elder') {
        role = 'elder';
      } else {
        role = 'member';
      }
    } else {
      const normalized = clanTag.trim().toUpperCase();
      const match = userRoles.find((r) => r.clan_tag === normalized);
      if (match) {
        role = clanRoleFromName(match.role);
      }
    }

    const check = checkLeadershipAccess(role);
    const permissions = getRolePermissions(check.role);
    return { check, permissions };
  }, [userRoles, clanTag, impersonatedRole]);

  return {
    check: derived.check,
    permissions: derived.permissions,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook to check leadership access for a specific member
 */
export function useMemberLeadership(memberRole?: string): LeadershipCheck {
  return checkLeadershipAccess(memberRole);
}

/**
 * Hook to get permissions for a specific role
 */
export function useRolePermissions(role: ClanRole): RolePermissions {
  return getRolePermissions(role);
}
