import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get a sample canonical snapshot
    const { data: canonicalSnapshot, error } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, payload')
      .limit(1);

    if (error) {
      throw error;
    }

    const member = canonicalSnapshot[0].payload.member;
    
    return NextResponse.json({
      success: true,
      data: {
        donations_raw: member.donations,
        donations_given: member.donations?.given,
        donations_received: member.donations?.received,
        donationsReceived_raw: member.donationsReceived,
        donations_final: member.donations?.given || member.donations || 0,
        donations_received_final: member.donations?.received || member.donationsReceived || 0,
      },
    });

  } catch (error: any) {
    console.error('[debug-donations] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
