import { NextRequest, NextResponse } from 'next/server';
import { backfillPlayerDay } from '@/lib/ingestion/player-day-backfill';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clanTag } = body;

    if (!clanTag) {
      return NextResponse.json({ error: 'clanTag is required' }, { status: 400 });
    }

    console.log(`[Admin] Starting player_day backfill for ${clanTag}`);

    const supabase = getSupabaseServerClient();
    const result = await backfillPlayerDay({
      supabase,
      clanTag,
      onPlayerProcessed: ({ playerTag, snapshots, inserted, updated, skipped }) => {
        console.log(`${playerTag}: snapshots=${snapshots}, inserted=${inserted}, updated=${updated}, skipped=${skipped}`);
      }
    });

    console.log(`[Admin] Player_day backfill completed for ${clanTag}:`, result);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Admin] Player_day backfill failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
