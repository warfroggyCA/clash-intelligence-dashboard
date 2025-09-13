// web-next/src/app/api/ai/dna-cache/route.ts
// API endpoint for retrieving cached player DNA profiles

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDNACache, getPlayerDNACacheByPlayer } from '@/lib/ai-storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const date = searchParams.get('date');

    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }

    let results;
    if (playerTag) {
      results = await getPlayerDNACacheByPlayer(clanTag, playerTag);
    } else {
      results = await getPlayerDNACache(clanTag, date || undefined);
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error('[API] Error fetching DNA cache:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch DNA cache' },
      { status: 500 }
    );
  }
}
