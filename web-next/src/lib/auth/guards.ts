import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './server';
import { getUserClanRoles, hasRole, ClanRoleName } from './roles';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

interface RequireRoleOptions {
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

export async function requireRole(
  req: NextRequest,
  allowedRoles: ClanRoleName[],
  options?: RequireRoleOptions
) {
  const impersonatedRole = req.headers.get('x-impersonate-role') as ClanRoleName | null;

  // Development-friendly bypass: local/dev environments can trigger protected routes
  // without requiring a Supabase session.
  if (process.env.DISABLE_PERMISSIONS === 'true') {
    // If we are actively impersonating a lower role, respect that so the dev can test restrictions
    if (impersonatedRole && !allowedRoles.includes(impersonatedRole)) {
       throw NextResponse.json({ 
         success: false, 
         error: `Impersonation: Role '${impersonatedRole}' is restricted from this resource.` 
       }, { status: 403 });
    }
    return { user: null, roles: [], clanTag: resolveClanTag(options?.clanTag) };
  }

  const apiKey = req.headers.get('x-api-key');
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  if (expectedKey && apiKey === expectedKey) {
    return { user: null, roles: [], clanTag: resolveClanTag(options?.clanTag) };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const roles = await getUserClanRoles(user.id);
  const clanTag = resolveClanTag(options?.clanTag);
  if (!hasRole(roles, clanTag, allowedRoles)) {
    throw NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return { user, roles, clanTag };
}

