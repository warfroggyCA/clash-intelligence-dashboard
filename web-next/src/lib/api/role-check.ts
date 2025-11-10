/**
 * Role Checking Utility for API Routes
 * Temporary solution for role-based access control using headers
 * TODO: Replace with real authentication when implemented
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles } from '@/lib/auth/roles';
import { cfg } from '@/lib/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Check if request has leadership role (leader or coLeader)
 * Reads from x-user-role header (set by frontend impersonation)
 */
export function isLeadershipRequest(req: NextRequest): boolean {
  const role = req.headers.get('x-user-role') || 'member';
  return role === 'leader' || role === 'coleader' || role === 'coLeader';
}

/**
 * Get user role from request header
 */
export function getUserRoleFromRequest(req: NextRequest): string {
  return req.headers.get('x-user-role') || 'member';
}

/**
 * Check if request has one of the allowed roles
 */
export function hasRole(req: NextRequest, allowedRoles: string[]): boolean {
  const role = getUserRoleFromRequest(req);
  // Normalize role names
  const normalizedRole = role === 'coLeader' ? 'coleader' : role.toLowerCase();
  return allowedRoles.some(allowed => allowed.toLowerCase() === normalizedRole);
}

/**
 * Require leadership role, throw 403 if not
 * Temporary solution - will be replaced with real auth
 */
export function requireLeadership(req: NextRequest): void {
  if (!isLeadershipRequest(req)) {
    throw new Response('Forbidden: Leadership access required', { status: 403 });
  }
}

/**
 * Require Leader role specifically (not Co-Leader), throw 403 if not
 * Checks header-based role (temporary solution for impersonation)
 * TODO: Replace with real authentication when implemented
 */
export async function requireLeader(req: NextRequest): Promise<void> {
  // First try to check authenticated user roles
  try {
    const user = await getAuthenticatedUser();
    if (user) {
      const roles = await getUserClanRoles(user.id);
      const clanTag = cfg.homeClanTag;
      const normalizedClanTag = normalizeTag(clanTag || '');
      
      if (normalizedClanTag) {
        const roleForClan = roles.find(r => r.clan_tag === normalizedClanTag);
        if (roleForClan?.role === 'leader') {
          return; // User is authenticated as leader
        }
      }
    }
  } catch (error) {
    // If auth check fails, fall back to header-based check
    console.warn('[requireLeader] Auth check failed, using header fallback:', error);
  }
  
  // Fallback: Check header-based role (temporary solution for impersonation)
  const role = getUserRoleFromRequest(req);
  // Normalize role names (coLeader -> coleader)
  const normalizedRole = role === 'coLeader' ? 'coleader' : role.toLowerCase();
  if (normalizedRole !== 'leader') {
    // Return JSON response for proper error handling
    const errorResponse = NextResponse.json(
      { success: false, error: 'Forbidden: Leader access required' },
      { status: 403 }
    );
    throw errorResponse;
  }
}

/**
 * Get the current user's identifier for audit trails
 * Returns user's email, or player name from user_roles if available, or fallback identifier
 */
export async function getCurrentUserIdentifier(req: NextRequest, clanTag?: string): Promise<string> {
  try {
    // Try to get authenticated user first
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
    // If auth fails, fall back to header-based approach
    console.warn('[getCurrentUserIdentifier] Auth check failed, using header fallback:', error);
  }
  
  // Fallback: Use header-based role (temporary solution)
  const role = getUserRoleFromRequest(req);
  return role !== 'member' ? `Leadership (${role})` : 'System';
}

function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const normalized = tag.trim().toUpperCase();
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

