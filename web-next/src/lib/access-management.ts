// Access Management System for Clan-Specific Dashboard Access

export type AccessLevel = 'viewer' | 'member' | 'elder' | 'coleader' | 'leader';

export interface AccessMember {
  id: string;
  name: string;
  cocPlayerTag?: string;
  email?: string;
  accessLevel: AccessLevel;
  password: string; // Individual access password
  createdAt: string;
  lastAccessed?: string;
  isActive: boolean;
  addedBy: string; // Who granted them access
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
    canGenerateAICoaching: false,
    canManageChangeDashboard: false,
    canModifyClanData: false,
    canManageAccess: false,
  },
  member: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: false,
    canGenerateAICoaching: false,
    canManageChangeDashboard: false,
    canModifyClanData: false,
    canManageAccess: false,
  },
  elder: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: false,
    canGenerateAICoaching: false,
    canManageChangeDashboard: true,
    canModifyClanData: false,
    canManageAccess: false,
  },
  coleader: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: true,
    canGenerateAICoaching: true,
    canManageChangeDashboard: true,
    canModifyClanData: false,
    canManageAccess: false,
  },
  leader: {
    canViewRoster: true,
    canViewBasicStats: true,
    canAccessDiscordPublisher: true,
    canGenerateAICoaching: true,
    canManageChangeDashboard: true,
    canModifyClanData: true,
    canManageAccess: true,
  },
};

export function getAccessLevelPermissions(accessLevel: AccessLevel) {
  return ACCESS_LEVEL_PERMISSIONS[accessLevel];
}

// Generate a secure access password
export function generateAccessPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate access password format
export function isValidAccessPassword(password: string): boolean {
  return /^[A-Z0-9]{8}$/.test(password);
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
