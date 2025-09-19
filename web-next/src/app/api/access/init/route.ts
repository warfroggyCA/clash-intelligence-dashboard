import { NextRequest } from 'next/server';
import { createAccessConfig, getAccessConfigSummary } from '@/lib/server/access-service';
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';

export async function POST(req: NextRequest) {
  const { json } = createApiContext(req, '/api/access/init');
  try {
    const leadershipToken = process.env.LEADERSHIP_TOKEN;
    if (leadershipToken) {
      const provided = req.headers.get('x-leadership-token') || '';
      if (provided !== leadershipToken) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const Schema = z.object({ clanTag: z.string(), clanName: z.string(), ownerName: z.string(), ownerCocTag: z.string().optional() });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag, clan name, and owner name are required' }, { status: 400 });
    }
    const { clanTag, clanName, ownerName, ownerCocTag } = parsed.data as any;

    const result = await createAccessConfig({ clanTag, clanName, ownerName, ownerCocTag });

    return json({
      success: true,
      data: {
        message: 'Access configuration created successfully',
        ownerAccess: {
          name: result.ownerMember.name,
          accessLevel: result.ownerMember.accessLevel,
          password: result.ownerPassword,
          instructions: `Share this password with clan members: ${result.ownerPassword}`,
        },
        clanInfo: {
          clanTag: result.config.clanTag,
          clanName: result.config.clanName,
        },
      },
    });

  } catch (error) {
    console.error('Error initializing access:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { json } = createApiContext(req, '/api/access/init');
  try {
    const { searchParams } = new URL(req.url);
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag required' }, { status: 400 });
    }
    const clanTag = parsed.data.clanTag;

    const summary = await getAccessConfigSummary(clanTag);
    if (!summary) {
      return json({ success: false, error: 'No access configuration found for this clan' }, { status: 404 });
    }

    // Return basic info (without sensitive data)
    return json({
      success: true,
      data: {
        exists: true,
        clanInfo: {
          clanTag: summary.clanTag,
          clanName: summary.clanName,
          memberCount: summary.memberCount,
          createdAt: summary.createdAt,
        },
      },
    });

  } catch (error) {
    console.error('Error checking access config:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
