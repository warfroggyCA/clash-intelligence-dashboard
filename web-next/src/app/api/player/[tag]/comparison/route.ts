import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";
import { parseRankedLeagueName } from "@/lib/league-tiers";

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
  leagueTierComparison?: {
    leagueName: string;
    leagueBaseName: string;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersInLeague: number;
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
  // Sort descending for ranking
  const sortedValues = [...values].sort((a, b) => b - a);
  
  // Calculate rank: find the position where playerValue fits
  // Special handling for 0 values - they should be at the bottom
  let rank: number;
  if (playerValue === 0) {
    // Count how many players have values > 0
    const playersAboveZero = sortedValues.filter(v => v > 0).length;
    // If all players have 0, everyone is tied for rank 1
    // Otherwise, players with 0 are tied for the worst rank (last place)
    if (playersAboveZero === 0) {
      rank = 1; // Everyone tied at 0
    } else {
      // All players with 0 share the worst rank (last place)
      rank = values.length;
    }
  } else {
    // For non-zero values, find the first position where value <= playerValue
    const index = sortedValues.findIndex(v => v <= playerValue);
    if (index >= 0) {
      rank = index + 1;
      // If there are ties (multiple players with same value), we want the worst rank among ties
      // Count how many players have the exact same value and are better
      const sameValueCount = sortedValues.filter(v => v === playerValue).length;
      const betterCount = sortedValues.filter(v => v > playerValue).length;
      // If there are ties, all tied players share the same rank
      // Rank is based on how many are better, plus 1
      rank = betterCount + 1;
    } else {
      rank = values.length;
    }
  }
  
  // Percentile: percentage of players at or below this rank
  // Lower rank (1st) = higher percentile (100th)
  // Higher rank (last) = lower percentile (0th)
  // For ties, use the worst percentile (bottom of the tied range) to clearly show poor performance
  const playersWithSameValue = values.filter(v => v === playerValue).length;
  const playersBetter = values.filter(v => v > playerValue).length;
  
  // Calculate percentile: if tied, use the worst percentile of the tied range
  // This ensures that players with 0 or low values are clearly shown as bottom performers
  const rankStart = playersBetter + 1;
  const rankEnd = rankStart + playersWithSameValue - 1;
  // Use the worst percentile (corresponding to the worst rank in the tie)
  const percentile = ((values.length - rankEnd + 1) / values.length) * 100;
  
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
  { params }: { params: Promise<{ tag: string }> }
) {
  const { tag } = await params;
  const context = createApiContext(request, `/api/player/${tag}/comparison`);
  
  try {
    const playerTag = normalizeTag(tag);
    if (!isValidTag(playerTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid player tag format" },
        { status: 400 }
      );
    }

    // Get clanTag from query parameter
    const { searchParams } = new URL(request.url);
    const requestedClanTag = searchParams.get('clanTag');
    const clanTag = requestedClanTag ? normalizeTag(requestedClanTag) : null;

    // Construct base URL dynamically
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Fetch current roster data using v2 API with clanTag if provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const rosterUrl = clanTag 
      ? `${baseUrl}/api/v2/roster?clanTag=${encodeURIComponent(clanTag)}`
      : `${baseUrl}/api/v2/roster`;

    let rosterResponse;
    try {
      rosterResponse = await fetch(rosterUrl, {
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

    const toNumber = (value: any): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    // Extract metrics for comparison
    // Use seasonTotalTrophies (running total across all weeks) instead of current trophies (which reset weekly)
    const trophies = members.map((m: any) => toNumber(m.seasonTotalTrophies));
    
    // ACCRUING METRICS FIX: Use activity metrics (running totals) or historical timeline maxima
    // to prevent "Season Reset" wiping out the dashboard rankings
    const getTrueSeasonTotal = (member: any, field: string, deltaField: string) => {
      const live = toNumber(member[field]);
      const running = toNumber(member.activity?.metrics?.[deltaField]);
      
      // DEEP SEARCH: If both are 0, scan the historical activity timeline for the peak value
      let historicalPeak = 0;
      if (member.activityTimeline && Array.isArray(member.activityTimeline)) {
        historicalPeak = Math.max(...member.activityTimeline.map((t: any) => toNumber(t[field])), 0);
      }
      
      return Math.max(live, running, historicalPeak);
    };

    const donations = members.map((m: any) => getTrueSeasonTotal(m, 'donations', 'donationDelta'));
    const donationsReceived = members.map((m: any) => getTrueSeasonTotal(m, 'donationsReceived', 'donationReceivedDelta'));

    const warStars = members.map((m: any) => toNumber(m.warStars));
    // Note: roster API returns 'capitalContributions', not 'clanCapitalContributions'
    const clanCapitalContributions = members.map((m: any) => toNumber(m.capitalContributions));
    
    // Calculate donation ratios (sanitize to avoid NaN/Infinity)
    const donationRatios = members.map((m: any, idx: number) => {
      const given = donations[idx];
      const received = donationsReceived[idx];
      const denom = Math.max(1, received);
      const ratio = given / denom;
      return Number.isFinite(ratio) ? ratio : 0;
    });

    const targetIdx = members.findIndex((m: any) => normalizeTag(m.tag) === playerTag);
    const targetDonations = donations[targetIdx] || 0;
    const targetReceived = donationsReceived[targetIdx] || 0;
    const targetRatio = Number.isFinite(targetDonations / Math.max(1, targetReceived))
      ? targetDonations / Math.max(1, targetReceived)
      : 0;

    // Build comparison data
    const comparisonData: PlayerComparisonData = {
      trophies: calculateMetrics(toNumber(targetPlayer.seasonTotalTrophies), trophies),
      donations: calculateMetrics(targetDonations, donations),
      donationsReceived: calculateMetrics(targetReceived, donationsReceived),
      warStars: calculateMetrics(toNumber(targetPlayer.warStars), warStars),
      // Note: roster API returns 'capitalContributions', not 'clanCapitalContributions'
      clanCapitalContributions: calculateMetrics(toNumber(targetPlayer.capitalContributions), clanCapitalContributions),
      donationRatio: calculateMetrics(targetRatio, donationRatios)
    };

    // Town Hall level comparison
    const playerTH = targetPlayer.townHallLevel || targetPlayer.th;
    if (playerTH) {
      const sameTHMembers = members.filter((m: any) => 
        (m.townHallLevel || m.th) === playerTH
      );
      
      if (sameTHMembers.length > 1) {
        // Use seasonTotalTrophies (running total) for comparison
        const thTrophies = sameTHMembers.map((m: any) => toNumber(m.seasonTotalTrophies));
        const thDonations = sameTHMembers.map((m: any) => toNumber(m.donations));
        const thWarStars = sameTHMembers.map((m: any) => toNumber(m.warStars));
        
        comparisonData.townHallComparison = {
          level: playerTH,
          averageTrophies: Math.round(thTrophies.reduce((sum: number, val: number) => sum + val, 0) / thTrophies.length),
          averageDonations: Math.round(thDonations.reduce((sum: number, val: number) => sum + val, 0) / thDonations.length),
          averageWarStars: Math.round(thWarStars.reduce((sum: number, val: number) => sum + val, 0) / thWarStars.length),
          playersAtLevel: sameTHMembers.length
        };
      }
    }

    // League tier comparison (use ranked league if available, otherwise regular league)
    const playerLeagueName = targetPlayer.rankedLeagueName || targetPlayer.rankedLeague?.name || targetPlayer.leagueName || targetPlayer.league?.name;
    if (playerLeagueName) {
      const playerLeagueInfo = parseRankedLeagueName(playerLeagueName);
      if (playerLeagueInfo) {
        // Find members in the same league base (e.g., all "Dragon League" players regardless of tier)
        const sameLeagueMembers = members.filter((m: any) => {
          const memberLeagueName = m.rankedLeagueName || m.rankedLeague?.name || m.leagueName || m.league?.name;
          if (!memberLeagueName) return false;
          const memberLeagueInfo = parseRankedLeagueName(memberLeagueName);
          return memberLeagueInfo?.baseName === playerLeagueInfo.baseName;
        });
        
        if (sameLeagueMembers.length > 1) {
          // Use seasonTotalTrophies (running total) for comparison
          const leagueTrophies = sameLeagueMembers.map((m: any) => toNumber(m.seasonTotalTrophies));
          const leagueDonations = sameLeagueMembers.map((m: any) => toNumber(m.donations));
          const leagueWarStars = sameLeagueMembers.map((m: any) => toNumber(m.warStars));
          
          comparisonData.leagueTierComparison = {
            leagueName: playerLeagueName,
            leagueBaseName: playerLeagueInfo.baseName,
            averageTrophies: Math.round(leagueTrophies.reduce((sum: number, val: number) => sum + val, 0) / leagueTrophies.length),
            averageDonations: Math.round(leagueDonations.reduce((sum: number, val: number) => sum + val, 0) / leagueDonations.length),
            averageWarStars: Math.round(leagueWarStars.reduce((sum: number, val: number) => sum + val, 0) / leagueWarStars.length),
            playersInLeague: sameLeagueMembers.length
          };
        }
      }
    }

    // Role comparison
    const playerRole = targetPlayer.role || 'member';
    const sameRoleMembers = members.filter((m: any) => 
      (m.role || 'member') === playerRole
    );
    
    if (sameRoleMembers.length > 1) {
      // Use seasonTotalTrophies (running total) for comparison
      const roleTrophies = sameRoleMembers.map((m: any) => toNumber(m.seasonTotalTrophies));
      const roleDonations = sameRoleMembers.map((m: any) => toNumber(m.donations));
      const roleWarStars = sameRoleMembers.map((m: any) => toNumber(m.warStars));
      
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