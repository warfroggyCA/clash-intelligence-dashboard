// Leadership access control utilities

export type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member';
export function clanRoleFromName(role: string): ClanRole {
  const value = role.toLowerCase();
  if (value === 'leader') return 'leader';
  if (value === 'coleader' || value === 'co-leader') return 'coLeader';
  if (value === 'elder' || value === 'admin') return 'elder';
  return 'member';
}

export interface LeadershipCheck {
  isLeader: boolean;
  isCoLeader: boolean;
  isElder: boolean;
  hasLeadershipAccess: boolean;
  role: ClanRole;
}

/**
 * Parse a role string from the CoC API into a standardized role
 */
export function parseRole(roleString?: string): ClanRole {
  if (!roleString) return 'member';
  
  const normalized = roleString.toLowerCase().trim();
  
  switch (normalized) {
    case 'leader':
      return 'leader';
    case 'coleader':
    case 'co-leader':
      return 'coLeader';
    case 'elder':
    case 'admin':
      return 'elder';
    default:
      return 'member';
  }
}

/**
 * Check if a user has leadership access (leader or co-leader)
 */
export function checkLeadershipAccess(userRole?: string): LeadershipCheck {
  const role = parseRole(userRole);
  
  return {
    isLeader: role === 'leader',
    isCoLeader: role === 'coLeader',
    isElder: role === 'elder',
    hasLeadershipAccess: role === 'leader' || role === 'coLeader',
    role
  };
}

/**
 * Get a user-friendly role display name
 */
export function getRoleDisplayName(role: ClanRole): string {
  switch (role) {
    case 'leader':
      return 'Leader';
    case 'coLeader':
      return 'Co-Leader';
    case 'elder':
      return 'Elder';
    case 'member':
      return 'Member';
    default:
      return 'Member';
  }
}

export type RoleBadgeTone = 'leader' | 'coleader' | 'elder' | 'member';

export interface RoleBadgeVariant {
  label: string;
  icon: string;
  tone: RoleBadgeTone;
}

const ROLE_BADGE_VARIANTS: Record<ClanRole, RoleBadgeVariant> = {
  leader: { label: 'Leader', icon: '👑', tone: 'leader' },
  coLeader: { label: 'Co-Leader', icon: '💎', tone: 'coleader' },
  elder: { label: 'Elder', icon: '⭐', tone: 'elder' },
  member: { label: 'Member', icon: '', tone: 'member' },
};

export function getRoleBadgeVariant(roleString?: string | null): RoleBadgeVariant {
  const role = parseRole(roleString || undefined);
  return ROLE_BADGE_VARIANTS[role];
}

/**
 * Get role-based permissions
 */
export interface RolePermissions {
  canViewSensitiveData: boolean;
  canModifyClanData: boolean;
  canAccessDiscordPublisher: boolean;
  canGenerateCoachingInsights: boolean;
  canManageChangeDashboard: boolean;
  canViewLeadershipFeatures: boolean;
  canManageAccess: boolean;
  canViewAuditLog: boolean;
  canViewWarPrep: boolean;
  canManageWarPlans: boolean;
  canRunWarAnalysis: boolean;
}

export function getRolePermissions(role: ClanRole): RolePermissions {
  const isLeadership = role === 'leader' || role === 'coLeader';
  
  return {
    canViewSensitiveData: isLeadership,
    canModifyClanData: isLeadership, // Leaders and co-leaders can modify
    canAccessDiscordPublisher: isLeadership,
    canGenerateCoachingInsights: isLeadership,
    canManageChangeDashboard: isLeadership,
    canViewLeadershipFeatures: isLeadership,
    canManageAccess: role === 'leader', // Only leaders can manage access
    canViewAuditLog: role === 'leader', // Only leaders can view audit log by default
    canViewWarPrep: true,
    canManageWarPlans: isLeadership,
    canRunWarAnalysis: isLeadership,
  };
}

/**
 * Create a leadership guard component that checks permissions
 */
export function createLeadershipGuard(
  userRole: string | undefined,
  requiredPermission: keyof RolePermissions
): { hasAccess: boolean; check: LeadershipCheck; permissions: RolePermissions } {
  const check = checkLeadershipAccess(userRole);
  const permissions = getRolePermissions(check.role);
  
  return {
    hasAccess: permissions[requiredPermission],
    check,
    permissions
  };
}
