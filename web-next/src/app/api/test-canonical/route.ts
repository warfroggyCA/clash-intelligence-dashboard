import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get a sample canonical snapshot
    const { data: canonicalSnapshots, error } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: canonicalSnapshots,
    });

  } catch (error: any) {
    console.error('[test-canonical] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
