import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const context = createApiContext(request, `/api/player/${params.tag}/history`);
  
  try {
    const playerTag = normalizeTag(params.tag);
    if (!isValidTag(playerTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid player tag format" },
        { status: 400 }
      );
    }

    // Get days parameter (default 30, max 90)
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam || '30'), 1), 90);

    const supabase = getSupabaseAdminClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch historical snapshots
    const { data: snapshots, error } = await supabase
      .from('full_snapshots')
      .select('snapshot_date, snapshot_data')
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (error) {
      console.error('[Player History API] Supabase error:', error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          playerTag,
          days,
          snapshotsFound: 0
        }
      });
    }

    // Extract player data from snapshots
    const historicalData: any[] = [];
    let previousData: any = null;

    for (const snapshot of snapshots) {
      if (!snapshot.snapshot_data || !snapshot.snapshot_data.members) {
        continue;
      }

      const playerData = snapshot.snapshot_data.members.find(
        (member: any) => normalizeTag(member.tag) === playerTag
      );

      if (playerData) {
        const currentData = {
          date: snapshot.snapshot_date,
          trophies: playerData.trophies || 0,
          donations: playerData.donations || 0,
          donationsReceived: playerData.donationsReceived || 0,
          warStars: playerData.warStars || 0,
          clanCapitalContributions: playerData.clanCapitalContributions || 0,
          townHallLevel: playerData.townHallLevel || playerData.th || 0,
          role: playerData.role || 'member'
        };

        // Calculate deltas if we have previous data
        if (previousData) {
          currentData.deltas = {
            trophies: currentData.trophies - previousData.trophies,
            donations: currentData.donations - previousData.donations,
            donationsReceived: currentData.donationsReceived - previousData.donationsReceived,
            warStars: currentData.warStars - previousData.warStars,
            clanCapitalContributions: currentData.clanCapitalContributions - previousData.clanCapitalContributions
          };
        }

        historicalData.push(currentData);
        previousData = currentData;
      }
    }

    return NextResponse.json({
      success: true,
      data: historicalData,
      meta: {
        playerTag,
        days,
        snapshotsFound: snapshots.length,
        dataPointsFound: historicalData.length
      }
    });

  } catch (error) {
    console.error('[Player History API] Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}