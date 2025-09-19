// Access Management System for Clan-Specific Dashboard Access

export type AccessLevel = 'viewer' | 'member' | 'elder' | 'coleader' | 'leader';

export interface AccessMember {
  id: string;
  name: string;
  cocPlayerTag?: string;
  email?: string;
  accessLevel: AccessLevel;
  password?: string; // Individual access password (undefined when not shared)
  createdAt: string;
  lastAccessed?: string;
  isActive: boolean;
  addedBy?: string; // Who granted them access
  notes?: string;
}

export interface ClanAccessConfig {
  clanTag: string;
  clanName: string;
  ownerId: string; // The clan leader who created this access config
  accessMembers: AccessMember[];
  settings: {
    allowSelfRegistration: boolean;
    requireEmailVerification: boolean;
    defaultAccessLevel: AccessLevel;
  };
  createdAt: string;
  updatedAt: string;
}

// Permission mapping based on access level
export const ACCESS_LEVEL_PERMISSIONS = {
  viewer: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: false,
    canGenerateCoachingInsights: false,
    canManageChangeDashboard: false,
    canModifyClanData: false,
    canManageAccess: false,
    canViewSensitiveData: false,
    canViewLeadershipFeatures: false,
  },
  member: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: false,
    canGenerateCoachingInsights: false,
    canManageChangeDashboard: false,
    canModifyClanData: false,
    canManageAccess: false,
    canViewSensitiveData: false,
    canViewLeadershipFeatures: false,
  },
  elder: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: false,
    canGenerateCoachingInsights: false,
    canManageChangeDashboard: true,
    canModifyClanData: false,
    canManageAccess: false,
    canViewSensitiveData: true,
    canViewLeadershipFeatures: true,
  },
  coleader: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: true,
    canGenerateCoachingInsights: true,
    canManageChangeDashboard: true,
    canModifyClanData: false,
    canManageAccess: false,
    canViewSensitiveData: true,
    canViewLeadershipFeatures: true,
  },
  leader: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: true,
    canGenerateCoachingInsights: true,
    canManageChangeDashboard: true,
    canModifyClanData: true,
    canManageAccess: true,
    canViewSensitiveData: true,
    canViewLeadershipFeatures: true,
  },
};

export function getAccessLevelPermissions(accessLevel: AccessLevel) {
  return ACCESS_LEVEL_PERMISSIONS[accessLevel];
}

// Get access level display name
export function getAccessLevelDisplayName(level: AccessLevel): string {
  switch (level) {
    case 'viewer': return 'Viewer';
    case 'member': return 'Member';
    case 'elder': return 'Elder';
    case 'coleader': return 'Co-Leader';
    case 'leader': return 'Leader';
    default: return 'Unknown';
  }
}

// Check if access level can manage other access levels
export function canManageAccessLevel(managerLevel: AccessLevel, targetLevel: AccessLevel): boolean {
  const hierarchy = ['viewer', 'member', 'elder', 'coleader', 'leader'];
  const managerIndex = hierarchy.indexOf(managerLevel);
  const targetIndex = hierarchy.indexOf(targetLevel);
  
  // Can only manage levels below your own, and leaders can manage all levels
  return managerIndex > targetIndex || managerLevel === 'leader';
}
