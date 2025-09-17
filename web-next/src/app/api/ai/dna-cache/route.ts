// web-next/src/app/api/ai/dna-cache/route.ts
// API endpoint for retrieving cached player DNA profiles

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDNACache, getPlayerDNACacheByPlayer } from '@/lib/insights-storage';
import { createApiContext } from '@/lib/api/route-helpers';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai/dna-cache');
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const date = searchParams.get('date');

    if (!clanTag) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    let results;
    if (playerTag) {
      results = await getPlayerDNACacheByPlayer(clanTag, playerTag);
    } else {
      results = await getPlayerDNACache(clanTag, date || undefined);
    }

    return json({ success: true, data: results });

  } catch (error: any) {
    console.error('[API] Error fetching DNA cache:', error);
    return json<ApiResponse>({ success: false, error: error.message || 'Failed to fetch DNA cache' }, { status: 500 });
  }
}
