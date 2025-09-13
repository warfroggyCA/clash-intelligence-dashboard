import { useState, useEffect } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>();

  const loadUserRole = () => {
    try {
      setError(null);
      
      // Check localStorage for stored role (for development/testing)
      if (typeof window !== 'undefined') {
        const storedRole = localStorage.getItem('clash-intelligence-user-role');
        if (storedRole && ['leader', 'coLeader', 'elder', 'member'].includes(storedRole)) {
          // Convert stored role back to CoC API format
          switch (storedRole) {
            case 'leader':
              return 'leader';
            case 'coLeader':
              return 'coleader';
            case 'elder':
              return 'elder';
            case 'member':
            default:
              return 'member';
          }
        }
      }
      
      // Default to member if no role is stored
      return 'member';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user role');
      return 'member';
    }
  };

  useEffect(() => {
    // Initial load
    const role = loadUserRole();
    setUserRole(role);
    setIsLoading(false);

    // Listen for localStorage changes (when role selector updates the role)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clash-intelligence-user-role') {
        const role = loadUserRole();
        setUserRole(role);
      }
    };

    // Listen for custom events (for same-tab updates)
    const handleRoleChange = () => {
      const role = loadUserRole();
      setUserRole(role);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userRoleChanged', handleRoleChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userRoleChanged', handleRoleChange);
    };
  }, []);

  const check = checkLeadershipAccess(userRole);
  const permissions = getRolePermissions(check.role);

  return {
    check,
    permissions,
    isLoading,
    error
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
