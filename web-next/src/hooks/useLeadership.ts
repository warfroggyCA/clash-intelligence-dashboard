import { useMemo, useState, useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { checkLeadershipAccess, getRolePermissions, type LeadershipCheck, type RolePermissions, type ClanRole, clanRoleFromName } from '../lib/leadership';
import { getAccessLevelPermissions, type AccessLevel } from '@/lib/access-management';
import { getRoleHeaders } from '@/lib/api/role-header';
import { normalizeTag } from '@/lib/tags';

export interface UseLeadershipResult {
  check: LeadershipCheck;
  permissions: RolePermissions;
  isLoading: boolean;
  error: string | null;
}

/**
 * Shared hook to fetch custom permissions for the current clan
 * This avoids duplicate fetches when multiple hooks need permissions
 */
function useCustomPermissions() {
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const [customPermissions, setCustomPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const normalizedClanTag = normalizeTag(clanTag || '');
    if (!normalizedClanTag) {
      setCustomPermissions(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchCustomPermissions = async () => {
      try {
        setLoading(true);
        const roleHeaders = getRoleHeaders();
        const response = await fetch(
          `/api/access/permissions?clanTag=${encodeURIComponent(normalizedClanTag)}`,
          { headers: roleHeaders }
        );

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.customPermissions) {
            setCustomPermissions(data.data.customPermissions);
            if (process.env.NODE_ENV === 'development') {
              console.log('[useCustomPermissions] Fetched custom permissions:', JSON.stringify(data.data.customPermissions, null, 2));
            }
          } else {
            setCustomPermissions(null);
            if (process.env.NODE_ENV === 'development') {
              console.log('[useCustomPermissions] No custom permissions found');
            }
          }
        } else {
          // If 403, user doesn't have permission to view, but that's okay - use defaults
          setCustomPermissions(null);
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useCustomPermissions] Failed to fetch permissions:', response.status, response.statusText);
          }
        }
      } catch (error) {
        console.warn('[useCustomPermissions] Failed to fetch custom permissions:', error);
        if (!cancelled) {
          setCustomPermissions(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchCustomPermissions();

    return () => {
      cancelled = true;
    };
  }, [clanTag]);

  return { customPermissions, loading };
}

/**
 * Map ClanRole to AccessLevel for permission checking
 */
function roleToAccessLevel(role: ClanRole): AccessLevel {
  switch (role) {
    case 'leader': return 'leader';
    case 'coLeader': return 'coleader';
    case 'elder': return 'elder';
    case 'member': return 'member';
    default: return 'member';
  }
}

/**
 * Convert AccessLevel permissions to RolePermissions
 */
function accessPermissionsToRolePermissions(
  accessPerms: ReturnType<typeof getAccessLevelPermissions>
): RolePermissions {
  return {
    canViewSensitiveData: accessPerms.canViewSensitiveData,
    canModifyClanData: accessPerms.canModifyClanData,
    canAccessDiscordPublisher: accessPerms.canAccessDiscordPublisher,
    canGenerateCoachingInsights: accessPerms.canGenerateCoachingInsights,
    canManageChangeDashboard: accessPerms.canManageChangeDashboard,
    canViewLeadershipFeatures: accessPerms.canViewLeadershipFeatures,
    canManageAccess: accessPerms.canManageAccess,
    canViewAuditLog: accessPerms.canViewAuditLog,
  };
}

/**
 * Hook to check leadership access for the current user
 * Fetches custom permissions from API and merges with defaults
 */
export function useLeadership(): UseLeadershipResult {
  const userRoles = useDashboardStore((state) => state.userRoles);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const { customPermissions, loading: loadingPermissions } = useCustomPermissions();

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
    
    // Get permissions with custom overrides
    const accessLevel = roleToAccessLevel(check.role);
    const accessPerms = getAccessLevelPermissions(accessLevel, customPermissions);
    const permissions = accessPermissionsToRolePermissions(accessPerms);
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[useLeadership] impersonatedRole:', impersonatedRole);
      console.log('[useLeadership] role:', role);
      console.log('[useLeadership] accessLevel:', accessLevel);
      console.log('[useLeadership] customPermissions:', JSON.stringify(customPermissions, null, 2));
      console.log('[useLeadership] accessPerms.canViewAuditLog:', accessPerms.canViewAuditLog);
      console.log('[useLeadership] permissions.canViewAuditLog:', permissions.canViewAuditLog);
    }
    
    return { check, permissions };
  }, [userRoles, clanTag, impersonatedRole, customPermissions]);

  return {
    check: derived.check,
    permissions: derived.permissions,
    isLoading: loadingPermissions,
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
 * Hook to get permissions for a specific role (with custom permissions)
 * Note: This uses the current clan's custom permissions
 */
export function useRolePermissions(role: ClanRole): RolePermissions {
  const { customPermissions } = useCustomPermissions();
  
  // Get permissions with custom overrides
  const accessLevel = roleToAccessLevel(role);
  const accessPerms = getAccessLevelPermissions(accessLevel, customPermissions);
  return accessPermissionsToRolePermissions(accessPerms);
}
