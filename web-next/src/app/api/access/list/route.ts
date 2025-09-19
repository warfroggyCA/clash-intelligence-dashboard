import { NextRequest } from 'next/server';
import { getAccessLevelPermissions } from '../../../../lib/access-management';
import {
  authenticateAccessMember,
  listAccessMembers,
  addAccessMember,
  updateAccessMember,
  deactivateAccessMember,
} from '@/lib/server/access-service';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(req: NextRequest) {
  const { json } = createApiContext(req, '/api/access/list');
  try {
    const { searchParams } = new URL(req.url);
    const Schema = z.object({ clanTag: z.string(), accessPassword: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag and access password required' }, { status: 400 });
    }
    const { clanTag, accessPassword } = parsed.data;

    const accessMember = await authenticateAccessMember(clanTag, accessPassword);
    if (!accessMember) {
      return json({ success: false, error: 'Invalid access password' }, { status: 401 });
    }

    return json({
      success: true,
      data: {
        accessMember,
        permissions: getAccessLevelPermissions(accessMember.accessLevel),
      },
    });
  } catch (error) {
    console.error('Error fetching access member:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { json } = createApiContext(req, '/api/access/list');
  try {
    const body = await req.json();
    const Schema = z.object({
      clanTag: z.string(),
      accessPassword: z.string(),
      action: z.enum(['list', 'add', 'update', 'remove']),
      name: z.string().optional(),
      cocPlayerTag: z.string().optional(),
      email: z.string().optional(),
      accessLevel: z.string().optional(),
      notes: z.string().optional(),
      memberId: z.string().optional(),
      updates: z.record(z.any()).optional(),
      memberIdToRemove: z.string().optional(),
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { clanTag, accessPassword, action } = parsed.data as any;

    const manager = await authenticateAccessMember(clanTag, accessPassword);
    if (!manager) {
      return json({ success: false, error: 'Invalid access password' }, { status: 401 });
    }

    if (!['leader', 'coleader'].includes(manager.accessLevel)) {
      return json({ success: false, error: 'Insufficient permissions to manage access' }, { status: 403 });
    }

    switch (action) {
      case 'list': {
        try {
          const accessMembers = await listAccessMembers(clanTag);
          return json({ success: true, data: { accessMembers } });
        } catch (error: any) {
          return json({ success: false, error: error.message || 'Failed to load access members' }, { status: 400 });
        }
      }
      case 'add': {
        const { name, cocPlayerTag, email, accessLevel, notes } = parsed.data as any;
        if (!name || !accessLevel) {
          return json({ success: false, error: 'Name and access level required' }, { status: 400 });
        }
        try {
          const result = await addAccessMember({
            clanTag,
            name,
            accessLevel,
            cocPlayerTag,
            email,
            notes,
            addedBy: manager.name,
          });
          return json({
            success: true,
            data: {
              accessMember: result.member,
              newPassword: result.password,
            },
          });
        } catch (error: any) {
          return json({ success: false, error: error.message || 'Failed to add access member' }, { status: 400 });
        }
      }
      case 'update': {
        const { memberId, updates } = parsed.data as any;
        if (!memberId || !updates) {
          return json({ success: false, error: 'Member ID and updates required' }, { status: 400 });
        }
        try {
          const updated = await updateAccessMember({ clanTag, memberId, updates });
          return json({ success: true, data: { accessMember: updated } });
        } catch (error: any) {
          return json({ success: false, error: error.message || 'Failed to update access member' }, { status: 400 });
        }
      }
      case 'remove': {
        const { memberIdToRemove } = parsed.data as any;
        if (!memberIdToRemove) {
          return json({ success: false, error: 'Member ID required' }, { status: 400 });
        }
        try {
          await deactivateAccessMember(clanTag, memberIdToRemove);
          return json({ success: true, data: { message: 'Member access revoked successfully' } });
        } catch (error: any) {
          return json({ success: false, error: error.message || 'Failed to revoke access' }, { status: 400 });
        }
      }
      default:
        return json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing access:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
