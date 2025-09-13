// web-next/src/app/api/ai/batch-results/route.ts
// API endpoint for retrieving batch AI results

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLatestBatchAIResults, getBatchAIResultsByDate } from '@/lib/ai-storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const date = searchParams.get('date');

    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }

    let results;
    if (date) {
      results = await getBatchAIResultsByDate(clanTag, date);
    } else {
      results = await getLatestBatchAIResults(clanTag);
    }

    if (!results) {
      return NextResponse.json({ 
        error: 'No batch AI results found',
        clanTag,
        date: date || 'latest'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error('[API] Error fetching batch AI results:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch batch AI results' },
      { status: 500 }
    );
  }
}
