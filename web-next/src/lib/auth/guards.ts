import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './server';
import { getUserClanRoles, hasRole, ClanRoleName } from './roles';
import { cfg } from '@/lib/config';

export async function requireRole(req: NextRequest, allowedRoles: ClanRoleName[]) {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  if (expectedKey && apiKey === expectedKey) {
    return { user: null, roles: [] };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const roles = await getUserClanRoles(user.id);
  const clanTag = cfg.homeClanTag;
  if (!hasRole(roles, clanTag, allowedRoles)) {
    throw NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return { user, roles };
}

