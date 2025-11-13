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
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

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
export async function requireLeadership(req: NextRequest): Promise<void> {
  // Development-only bypass (never in production)
  if (checkDevBypass(req)) {
    return;
  }

  // Development-only: Allow header-based role check for easier local development
  // This is safe because it only works in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const headerRole = req.headers.get('x-user-role');
    if (headerRole === 'leader' || headerRole === 'coleader' || headerRole === 'coLeader') {
      return; // Allow access in development with header-based role
    }
  }

  // Require authenticated user
  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  // Check user's actual roles from database
  const roles = await getUserClanRoles(user.id);
  const clanTag = cfg.homeClanTag;
  
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
export async function requireLeader(req: NextRequest): Promise<void> {
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
  const clanTag = cfg.homeClanTag;
  
  if (!checkUserHasRole(roles, clanTag, ['leader'])) {
    throw NextResponse.json({ success: false, error: 'Forbidden: Leader access required' }, { status: 403 });
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

function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const normalized = tag.trim().toUpperCase();
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

