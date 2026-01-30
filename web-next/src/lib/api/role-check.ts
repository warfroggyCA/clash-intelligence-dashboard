/**
 * Role Checking Utility for API Routes
 * 
 * SECURITY: Requires verified Supabase sessions. Header-based auth removed to prevent
 * privilege escalation attacks. Development-only API key bypass available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles, hasRole as checkUserHasRole } from '@/lib/auth/roles';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAccessLevelPermissions } from '@/lib/access-management';
import { clanRoleFromName } from '@/lib/leadership';
import { roleToAccessLevel, type PermissionKey, type CustomPermissions } from '@/lib/access/permission-types';

/**
 * Check if development API key bypass is enabled and valid
 * Only works in non-production environments
 */
function checkDevBypass(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false; // Never allow bypass in production
  }
  
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  
  return !!(expectedKey && apiKey === expectedKey);
}

/**
 * Require leadership role (leader or coleader), throw 403 if not
 * 
 * SECURITY: Requires verified Supabase session. Header spoofing no longer works.
 * Development: Allows ADMIN_API_KEY bypass in non-production environments.
 */
interface RequireOptions {
  clanTag?: string | null;
}

function resolveClanTag(input?: string | null): string {
  const fallback = cfg.homeClanTag ?? '';
  const normalized = normalizeTag(input || fallback);
  if (!normalized) {
    throw NextResponse.json({ success: false, error: 'Clan tag not configured' }, { status: 500 });
  }
  return normalized;
}

const CUSTOM_PERMISSION_CACHE_MS = 60 * 1000;
const customPermissionCache = new Map<string, { data: CustomPermissions | null; fetchedAt: number }>();

async function loadCustomPermissions(clanTag: string): Promise<CustomPermissions | null> {
  const normalizedTag = normalizeTag(clanTag);
  if (!normalizedTag) return null;

  const cached = customPermissionCache.get(normalizedTag);
  if (cached && Date.now() - cached.fetchedAt < CUSTOM_PERMISSION_CACHE_MS) {
    return cached.data;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('clan_access_configs')
    .select('custom_permissions')
    .eq('clan_tag', normalizedTag)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const permissions = (data?.custom_permissions as CustomPermissions | null) ?? null;
  customPermissionCache.set(normalizedTag, { data: permissions, fetchedAt: Date.now() });
  return permissions;
}

export async function requireLeadership(req: NextRequest, options?: RequireOptions): Promise<void> {
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_PERMISSIONS === 'true') {
    return;
  }
  // Development-only bypass (never in production)
  if (checkDevBypass(req)) {
    return;
  }

  // Require authenticated user
  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  // Check user's actual roles from database
  const roles = await getUserClanRoles(user.id);
  const clanTag = resolveClanTag(options?.clanTag);
  
  if (!checkUserHasRole(roles, clanTag, ['leader', 'coleader'])) {
    throw NextResponse.json({ success: false, error: 'Forbidden: Leadership access required' }, { status: 403 });
  }
}

/**
 * Require Leader role specifically (not Co-Leader), throw 403 if not
 * 
 * SECURITY: Requires verified Supabase session. Header spoofing no longer works.
 * Development: Allows ADMIN_API_KEY bypass in non-production environments.
 */
export async function requireLeader(req: NextRequest, options?: RequireOptions): Promise<void> {
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_PERMISSIONS === 'true') {
    return;
  }
  // Development-only bypass (never in production)
  if (checkDevBypass(req)) {
    return;
  }

  // Require authenticated user
  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  // Check user's actual roles from database - must be leader (not coleader)
  const roles = await getUserClanRoles(user.id);
  const clanTag = resolveClanTag(options?.clanTag);
  
  if (!checkUserHasRole(roles, clanTag, ['leader'])) {
    throw NextResponse.json({ success: false, error: 'Forbidden: Leader access required' }, { status: 403 });
  }
}

/**
 * Require a specific permission (based on access level + custom overrides)
 * Throws 403 if the permission is not granted for the user's clan role.
 */
export async function requirePermission(
  req: NextRequest,
  permission: PermissionKey,
  options?: RequireOptions,
): Promise<void> {
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_PERMISSIONS === 'true') {
    return;
  }
  if (checkDevBypass(req)) {
    return;
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  const roles = await getUserClanRoles(user.id);
  const clanTag = resolveClanTag(options?.clanTag);
  const normalizedClanTag = normalizeTag(clanTag);

  const roleForClan = roles.find((role) => normalizeTag(role.clan_tag) === normalizedClanTag);
  if (!roleForClan) {
    throw NextResponse.json({ success: false, error: 'Forbidden: Clan access required' }, { status: 403 });
  }

  const clanRole = clanRoleFromName(roleForClan.role ?? 'member');
  const accessLevel = roleToAccessLevel(clanRole);
  const customPermissions = await loadCustomPermissions(clanTag);
  const permissions = getAccessLevelPermissions(accessLevel, customPermissions ?? undefined);

  if (!permissions[permission]) {
    throw NextResponse.json(
      { success: false, error: 'Forbidden: Additional permission required' },
      { status: 403 },
    );
  }
}

/**
 * Get the current user's identifier for audit trails
 * Returns user's email, or player name from user_roles if available, or fallback identifier
 */
export async function getCurrentUserIdentifier(req: NextRequest, clanTag?: string): Promise<string> {
  // Check for dev bypass first
  if (checkDevBypass(req)) {
    return 'Dev API Key';
  }

  try {
    const user = await getAuthenticatedUser();
    if (user) {
      // Try to get player name from user_roles
      const roles = await getUserClanRoles(user.id);
      const targetClanTag = normalizeTag(clanTag || cfg.homeClanTag || '');
      
      if (targetClanTag) {
        const roleForClan = roles.find(r => r.clan_tag === targetClanTag);
        if (roleForClan?.player_tag) {
          // Try to get player name from canonical snapshots
          const supabase = getSupabaseAdminClient();
          const { data } = await supabase
            .from('canonical_member_snapshots')
            .select('payload')
            .eq('clan_tag', targetClanTag)
            .eq('player_tag', roleForClan.player_tag)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data?.payload?.member?.name) {
            return data.payload.member.name;
          }
        }
      }
      
      // Fallback to email
      return user.email || `User ${user.id.substring(0, 8)}`;
    }
  } catch (error) {
    console.warn('[getCurrentUserIdentifier] Auth check failed:', error);
  }
  
  // Fallback if no authenticated user
  return 'System';
}
