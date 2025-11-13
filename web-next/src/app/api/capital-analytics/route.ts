// Capital Analytics API Endpoint
// Returns comprehensive capital raid performance analytics

import { NextRequest, NextResponse } from 'next/server';
import { calculateCapitalAnalytics } from '@/lib/capital-analytics/engine';
import { requireLeadership } from '@/lib/api/role-check';
import { createApiContext } from '@/lib/api/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/capital-analytics');

  try {
    // Require leadership access
    await requireLeadership(request);

    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const weeksBack = searchParams.get('weeksBack') ? Number(searchParams.get('weeksBack')) : undefined;
    const minWeekends = searchParams.get('minWeekends') ? Number(searchParams.get('minWeekends')) : undefined;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    const result = await calculateCapitalAnalytics({
      clanTag,
      playerTag: playerTag || undefined,
      weeksBack: weeksBack || 12,
      minWeekends: minWeekends || 3,
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

    console.error('[capital-analytics] Error:', error);
    return json({
      success: false,
      error: error?.message || 'Failed to calculate capital analytics',
    }, { status: error?.status || 500 });
  }
}

