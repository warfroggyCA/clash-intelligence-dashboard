// War Intelligence API Endpoint
// Returns comprehensive war performance analytics

import { NextRequest, NextResponse } from 'next/server';
import { calculateWarIntelligence } from '@/lib/war-intelligence/engine';
import { requireLeadership } from '@/lib/api/role-check';
import { createApiContext } from '@/lib/api/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/war-intelligence');

  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    await requireLeadership(request, { clanTag });
    const playerTag = searchParams.get('playerTag');
    const daysBack = searchParams.get('daysBack') ? Number(searchParams.get('daysBack')) : undefined;
    const minWars = searchParams.get('minWars') ? Number(searchParams.get('minWars')) : undefined;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    const result = await calculateWarIntelligence({
      clanTag,
      playerTag: playerTag || undefined,
      daysBack: daysBack || 90,
      minWars: minWars || 3,
    });

    return json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // Handle 401/403 errors from requireLeadership
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }

    console.error('[war-intelligence] Error:', error);
    return json({
      success: false,
      error: error?.message || 'Failed to calculate war intelligence',
    }, { status: error?.status || 500 });
  }
}

