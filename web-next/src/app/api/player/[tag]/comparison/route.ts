import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ComparisonMetrics {
  playerValue: number;
  clanAverage: number;
  clanMedian: number;
  percentile: number;
  rank: number;
  totalPlayers: number;
}

interface PlayerComparisonData {
  trophies: ComparisonMetrics;
  donations: ComparisonMetrics;
  donationsReceived: ComparisonMetrics;
  warStars: ComparisonMetrics;
  clanCapitalContributions: ComparisonMetrics;
  donationRatio: ComparisonMetrics;
  townHallComparison?: {
    level: number;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersAtLevel: number;
  };
  roleComparison?: {
    role: string;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersWithRole: number;
  };
}

function calculateMetrics(playerValue: number, values: number[]): ComparisonMetrics {
  const sortedValues = [...values].sort((a, b) => b - a);
  const rank = sortedValues.findIndex(v => v <= playerValue) + 1;
  const percentile = ((values.length - rank + 1) / values.length) * 100;
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;
  
  const sortedForMedian = [...values].sort((a, b) => a - b);
  const median = sortedForMedian.length % 2 === 0
    ? (sortedForMedian[sortedForMedian.length / 2 - 1] + sortedForMedian[sortedForMedian.length / 2]) / 2
    : sortedForMedian[Math.floor(sortedForMedian.length / 2)];

  return {
    playerValue,
    clanAverage: Math.round(average * 100) / 100,
    clanMedian: Math.round(median * 100) / 100,
    percentile: Math.round(percentile * 100) / 100,
    rank,
    totalPlayers: values.length
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const context = createApiContext(request, `/api/player/${params.tag}/comparison`);
  
  try {
    const playerTag = normalizeTag(params.tag);
    if (!isValidTag(playerTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid player tag format" },
        { status: 400 }
      );
    }

    // Construct base URL dynamically
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Fetch current roster data using v2 API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let rosterResponse;
    try {
      rosterResponse = await fetch(`${baseUrl}/api/v2/roster`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Player-Comparison-API/1.0'
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!rosterResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch roster data: ${rosterResponse.status} ${rosterResponse.statusText}` },
        { status: 502 }
      );
    }

    const rosterResult = await rosterResponse.json();
    
    if (!rosterResult.success || !rosterResult.data?.members) {
      return NextResponse.json(
        { success: false, error: "Invalid roster data received" },
        { status: 502 }
      );
    }

    const members = rosterResult.data.members;
    
    // Find the target player
    const targetPlayer = members.find((member: any) => 
      normalizeTag(member.tag) === playerTag
    );

    if (!targetPlayer) {
      return NextResponse.json(
        { success: false, error: "Player not found in current roster" },
        { status: 404 }
      );
    }

    // Extract metrics for comparison
    const trophies = members.map((m: any) => m.trophies || 0);
    const donations = members.map((m: any) => m.donations || 0);
    const donationsReceived = members.map((m: any) => m.donationsReceived || 0);
    const warStars = members.map((m: any) => m.warStars || 0);
    const clanCapitalContributions = members.map((m: any) => m.clanCapitalContributions || 0);
    
    // Calculate donation ratios
    const donationRatios = members.map((m: any) => {
      const given = m.donations || 0;
      const received = m.donationsReceived || 1; // Avoid division by zero
      return given / received;
    });

    // Build comparison data
    const comparisonData: PlayerComparisonData = {
      trophies: calculateMetrics(targetPlayer.trophies || 0, trophies),
      donations: calculateMetrics(targetPlayer.donations || 0, donations),
      donationsReceived: calculateMetrics(targetPlayer.donationsReceived || 0, donationsReceived),
      warStars: calculateMetrics(targetPlayer.warStars || 0, warStars),
      clanCapitalContributions: calculateMetrics(targetPlayer.clanCapitalContributions || 0, clanCapitalContributions),
      donationRatio: calculateMetrics((targetPlayer.donations || 0) / (targetPlayer.donationsReceived || 1), donationRatios)
    };

    // Town Hall level comparison
    const playerTH = targetPlayer.townHallLevel || targetPlayer.th;
    if (playerTH) {
      const sameTHMembers = members.filter((m: any) => 
        (m.townHallLevel || m.th) === playerTH
      );
      
      if (sameTHMembers.length > 1) {
        const thTrophies = sameTHMembers.map((m: any) => m.trophies || 0);
        const thDonations = sameTHMembers.map((m: any) => m.donations || 0);
        const thWarStars = sameTHMembers.map((m: any) => m.warStars || 0);
        
        comparisonData.townHallComparison = {
          level: playerTH,
          averageTrophies: Math.round(thTrophies.reduce((sum: number, val: number) => sum + val, 0) / thTrophies.length),
          averageDonations: Math.round(thDonations.reduce((sum: number, val: number) => sum + val, 0) / thDonations.length),
          averageWarStars: Math.round(thWarStars.reduce((sum: number, val: number) => sum + val, 0) / thWarStars.length),
          playersAtLevel: sameTHMembers.length
        };
      }
    }

    // Role comparison
    const playerRole = targetPlayer.role || 'member';
    const sameRoleMembers = members.filter((m: any) => 
      (m.role || 'member') === playerRole
    );
    
    if (sameRoleMembers.length > 1) {
      const roleTrophies = sameRoleMembers.map((m: any) => m.trophies || 0);
      const roleDonations = sameRoleMembers.map((m: any) => m.donations || 0);
      const roleWarStars = sameRoleMembers.map((m: any) => m.warStars || 0);
      
      comparisonData.roleComparison = {
        role: playerRole,
        averageTrophies: Math.round(roleTrophies.reduce((sum: number, val: number) => sum + val, 0) / roleTrophies.length),
        averageDonations: Math.round(roleDonations.reduce((sum: number, val: number) => sum + val, 0) / roleDonations.length),
        averageWarStars: Math.round(roleWarStars.reduce((sum: number, val: number) => sum + val, 0) / roleWarStars.length),
        playersWithRole: sameRoleMembers.length
      };
    }

    return NextResponse.json({
      success: true,
      data: comparisonData,
      meta: {
        playerTag,
        playerName: targetPlayer.name,
        clanSize: members.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Player Comparison API] Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}