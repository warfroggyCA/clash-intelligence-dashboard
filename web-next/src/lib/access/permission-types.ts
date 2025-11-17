import { ACCESS_LEVEL_PERMISSIONS, type AccessLevel } from '@/lib/access-management';
import type { ClanRole } from '@/lib/leadership';

export type PermissionSet = (typeof ACCESS_LEVEL_PERMISSIONS)['viewer'];
export type PermissionKey = keyof PermissionSet;
export type CustomPermissions = Partial<Record<AccessLevel, Partial<PermissionSet>>>;

export function roleToAccessLevel(role: ClanRole): AccessLevel {
  switch (role) {
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
