import { useMemo } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { ACCESS_LEVEL_PERMISSIONS, type AccessLevel } from '@/lib/access-management';
import { checkLeadershipAccess, getRolePermissions, type LeadershipCheck, type RolePermissions, type ClanRole } from '../lib/leadership';

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
  const accessPermissions = useDashboardStore((state) => state.accessPermissions) || ACCESS_LEVEL_PERMISSIONS.member;
  const currentAccessMember = useDashboardStore((state) => state.currentAccessMember);

  const derived = useMemo(() => {
    const accessLevel: AccessLevel = currentAccessMember?.accessLevel || 'member';
    const normalizedRole: ClanRole = accessLevel === 'coleader'
      ? 'coLeader'
      : accessLevel === 'viewer'
        ? 'member'
        : (accessLevel as ClanRole);

    const check = {
      isLeader: normalizedRole === 'leader',
      isCoLeader: normalizedRole === 'coLeader',
      isElder: normalizedRole === 'elder',
      hasLeadershipAccess: Boolean(accessPermissions?.canViewLeadershipFeatures),
      role: normalizedRole,
    } satisfies LeadershipCheck;

    return { check, permissions: accessPermissions as RolePermissions };
  }, [accessPermissions, currentAccessMember]);

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
