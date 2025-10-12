import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const tag = params.tag;
    // Ensure tag has # prefix before normalizing
    const tagWithHash = tag.startsWith('#') ? tag : `#${tag}`;
    const normalizedTag = normalizeTag(tagWithHash);

    // Get the clan tag from config
    const { cfg } = await import('@/lib/config');
    const clanTag = normalizeTag(cfg.homeClanTag || '');

    // First, get the clan to get its ID
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, name')
      .eq('tag', clanTag)
      .single();

    if (clanError || !clanRow) {
      return NextResponse.json({ 
        success: false, 
        error: 'Clan not found' 
      }, { status: 404 });
    }

    // Get the member data
    const { data: memberRow, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('tag', normalizedTag)
      .single();

    if (memberError || !memberRow) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player not found' 
      }, { status: 404 });
    }

    // Get the latest snapshot for this member
    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (snapshotError || !snapshotRows || snapshotRows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No snapshot data found' 
      }, { status: 404 });
    }

    const latestSnapshot = snapshotRows[0];

    // Get member stats from the latest snapshot
    const { data: statsRow, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('*')
      .eq('snapshot_id', latestSnapshot.id)
      .eq('member_id', memberRow.id)
      .single();

    // Build player data response
    const playerData = {
      name: memberRow.name,
      tag: memberRow.tag,
      role: statsRow?.role || memberRow.role,
      townHallLevel: statsRow?.th_level || memberRow.th_level,
      trophies: statsRow?.trophies || 0,
      donations: statsRow?.donations || 0,
      donationsReceived: statsRow?.donations_received || 0,
      league: memberRow.league ? {
        name: memberRow.league_name || memberRow.league
      } : null,
      rankedLeague: memberRow.ranked_league_name ? {
        name: memberRow.ranked_league_name
      } : null,
      clan: {
        name: clanRow.name
      },
      // Hero levels from stats
      bk: statsRow?.hero_levels?.bk || null,
      aq: statsRow?.hero_levels?.aq || null,
      gw: statsRow?.hero_levels?.gw || null,
      rc: statsRow?.hero_levels?.rc || null,
      mp: statsRow?.hero_levels?.mp || null,
    };

    return NextResponse.json({
      success: true,
      data: playerData
    });

  } catch (error: any) {
    console.error('[api/v2/player] error', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message ?? 'Internal Server Error' 
    }, { status: 500 });
  }
}
