import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";
import type { DailySnapshot } from "@/lib/snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HistoricalDataPoint {
  date: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  warStars: number;
  clanCapitalContributions: number;
  attackWins?: number;
  versusTrophies?: number;
  townHallLevel?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const { logger, json } = createApiContext(request, '/api/player/[tag]/history');
  
  const playerTag = params.tag;
  if (!playerTag) {
    return json({ success: false, error: "Player tag is required" }, { status: 400 });
  }

  const normalized = normalizeTag(playerTag);
  if (!isValidTag(normalized)) {
    return json({ success: false, error: "Invalid player tag format" }, { status: 400 });
  }

  // Get days parameter (default 30, max 90)
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get('days');
  const days = Math.min(parseInt(daysParam || '30', 10), 90);

  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return json({ 
        success: true, 
        data: [], 
        message: "Supabase not configured - using mock data" 
      });
    }

    // Get clan tag from config
    const clanTag = process.env.DEFAULT_CLAN_TAG || '#2PR8R8V8P';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch snapshots from Supabase
    const { data: snapshots, error } = await supabase
      .from('clan_snapshots')
      .select('snapshot_date, member_summaries, player_details')
      .eq('clan_tag', clanTag)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (error) {
      logger.error('Error fetching snapshots from Supabase', { error });
      return json({ success: false, error: "Failed to fetch historical data" }, { status: 500 });
    }

    // Extract player data from snapshots
    const historicalData: HistoricalDataPoint[] = [];
    
    if (snapshots && snapshots.length > 0) {
      for (const snapshot of snapshots) {
        try {
          // Look in member_summaries first (main roster data)
          let member = snapshot.member_summaries?.find((m: any) => normalizeTag(m.tag) === normalized);
          
          // If not found, check player_details (detailed player data)
          if (!member && snapshot.player_details) {
            member = snapshot.player_details.find((p: any) => normalizeTag(p.tag) === normalized);
          }
          
          if (member) {
            historicalData.push({
              date: snapshot.snapshot_date,
              trophies: member.trophies || 0,
              donations: member.donations || 0,
              donationsReceived: member.donationsReceived || 0,
              warStars: member.attackWins || 0, // Use attackWins as proxy for war activity
              clanCapitalContributions: member.clanCapitalContributions || 0,
              attackWins: member.attackWins || 0,
              versusTrophies: member.versusTrophies || 0,
              townHallLevel: member.townHallLevel || 0,
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse snapshot', { date: snapshot.snapshot_date, error: parseError });
        }
      }
    }

    // Calculate deltas (day-over-day changes)
    const historicalWithDeltas = historicalData.map((point, index) => {
      if (index === 0) {
        return { ...point, deltas: {} };
      }
      
      const previous = historicalData[index - 1];
      return {
        ...point,
        deltas: {
          trophies: point.trophies - previous.trophies,
          donations: point.donations - previous.donations,
          donationsReceived: point.donationsReceived - previous.donationsReceived,
          warStars: point.warStars - previous.warStars,
          clanCapitalContributions: point.clanCapitalContributions - previous.clanCapitalContributions,
        }
      };
    });

    logger.info('Served player history', { 
      tag: normalized, 
      days, 
      dataPoints: historicalWithDeltas.length 
    });

    return json({
      success: true,
      data: historicalWithDeltas,
    });

  } catch (error: any) {
    logger.error('Error fetching player history', { error: error.message });
    return json({ 
      success: false, 
      error: error.message || "Failed to fetch player history" 
    }, { status: 500 });
  }
}
