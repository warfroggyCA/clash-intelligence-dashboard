import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ComparisonMetrics {
  playerValue: number;
  clanAverage: number;
  clanMedian: number;
  percentile: number; // 0-100, where 100 is top performer
  rank: number; // 1 = best
  totalPlayers: number;
}

interface PlayerComparison {
  trophies: ComparisonMetrics;
  donations: ComparisonMetrics;
  donationsReceived: ComparisonMetrics;
  warStars: ComparisonMetrics;
  clanCapitalContributions: ComparisonMetrics;
  donationRatio: ComparisonMetrics; // donations / donationsReceived
  thLevelComparison: {
    playerTH: number;
    sameTHCount: number;
    avgTrophiesForTH: number;
    avgDonationsForTH: number;
    avgWarStarsForTH: number;
  };
  roleComparison: {
    playerRole: string;
    sameRoleCount: number;
    avgMetricsForRole: {
      trophies: number;
      donations: number;
      warStars: number;
    };
  };
}

function calculatePercentile(value: number, sortedValues: number[]): number {
  const rank = sortedValues.filter(v => v < value).length;
  return Math.round((rank / sortedValues.length) * 100);
}

function calculateMetrics(
  playerValue: number,
  allValues: number[]
): Omit<ComparisonMetrics, 'playerValue'> {
  const sorted = [...allValues].sort((a, b) => b - a); // Descending
  const sum = allValues.reduce((acc, v) => acc + v, 0);
  const average = allValues.length > 0 ? sum / allValues.length : 0;
  
  const median = sorted.length > 0 
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : 0;

  const rank = sorted.indexOf(playerValue) + 1;
  const percentile = calculatePercentile(playerValue, sorted);

  return {
    clanAverage: Math.round(average),
    clanMedian: Math.round(median),
    percentile,
    rank,
    totalPlayers: allValues.length,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const { logger, json } = createApiContext(request, '/api/player/[tag]/comparison');
  
  const playerTag = params.tag;
  if (!playerTag) {
    return json({ success: false, error: "Player tag is required" }, { status: 400 });
  }

  const normalized = normalizeTag(playerTag);
  if (!isValidTag(normalized)) {
    return json({ success: false, error: "Invalid player tag format" }, { status: 400 });
  }

  try {
    // Fetch current roster from the API - use relative URL for server-side fetch
    const clanTag = process.env.DEFAULT_CLAN_TAG || '#2PR8R8V8P';
    
    // Get the host from the request headers for server-side fetch
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    logger.info('Fetching roster for comparison', { baseUrl, clanTag });
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const rosterResponse = await fetch(`${baseUrl}/api/roster?clanTag=${encodeURIComponent(clanTag)}`, {
      headers: {
        'x-api-key': process.env.ADMIN_API_KEY || '',
        'User-Agent': 'NextJS-Internal-Fetch',
      },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!rosterResponse.ok) {
      const errorText = await rosterResponse.text().catch(() => 'Unable to read error');
      logger.error('Failed to fetch roster', { 
        status: rosterResponse.status, 
        statusText: rosterResponse.statusText,
        url: `${baseUrl}/api/roster?clanTag=${encodeURIComponent(clanTag)}`,
        errorBody: errorText.substring(0, 200),
      });
      return json({ 
        success: false, 
        error: `Roster API returned ${rosterResponse.status}: ${rosterResponse.statusText}`,
        debug: {
          url: `${baseUrl}/api/roster`,
          status: rosterResponse.status,
        }
      }, { status: 503 });
    }

    const rosterData = await rosterResponse.json();
    
    if (!rosterData.success) {
      logger.error('Roster API returned error', { error: rosterData.error });
      return json({ 
        success: false, 
        error: "Roster data unavailable" 
      }, { status: 503 });
    }
    
    const members = rosterData.data?.members || [];

    if (members.length === 0) {
      return json({ 
        success: false, 
        error: "No roster members found. Please refresh clan data from the dashboard." 
      }, { status: 404 });
    }

    // Find the player
    const player = members.find((m: any) => normalizeTag(m.tag) === normalized);
    
    if (!player) {
      return json({ success: false, error: "Player not found in current roster" }, { status: 404 });
    }

    // Extract all values for comparison
    const allTrophies = members.map((m: any) => m.trophies || 0);
    const allDonations = members.map((m: any) => m.donations || 0);
    const allDonationsReceived = members.map((m: any) => m.donationsReceived || 0);
    const allWarStars = members.map((m: any) => m.warStars || 0);
    const allCapitalContribs = members.map((m: any) => m.clanCapitalContributions || 0);
    const allDonationRatios = members.map((m: any) => {
      const received = m.donationsReceived || 1; // Avoid division by zero
      return (m.donations || 0) / received;
    });

    // Calculate comparison metrics
    const comparison: PlayerComparison = {
      trophies: {
        playerValue: player.trophies || 0,
        ...calculateMetrics(player.trophies || 0, allTrophies),
      },
      donations: {
        playerValue: player.donations || 0,
        ...calculateMetrics(player.donations || 0, allDonations),
      },
      donationsReceived: {
        playerValue: player.donationsReceived || 0,
        ...calculateMetrics(player.donationsReceived || 0, allDonationsReceived),
      },
      warStars: {
        playerValue: player.warStars || 0,
        ...calculateMetrics(player.warStars || 0, allWarStars),
      },
      clanCapitalContributions: {
        playerValue: player.clanCapitalContributions || 0,
        ...calculateMetrics(player.clanCapitalContributions || 0, allCapitalContribs),
      },
      donationRatio: {
        playerValue: (player.donations || 0) / (player.donationsReceived || 1),
        ...calculateMetrics(
          (player.donations || 0) / (player.donationsReceived || 1),
          allDonationRatios
        ),
      },
      thLevelComparison: (() => {
        const playerTH = player.townHallLevel || player.th || 0;
        const sameTHPlayers = members.filter((m: any) => (m.townHallLevel || m.th) === playerTH);
        const sameTHCount = sameTHPlayers.length;
        
        return {
          playerTH,
          sameTHCount,
          avgTrophiesForTH: sameTHCount > 0
            ? Math.round(sameTHPlayers.reduce((sum: number, m: any) => sum + (m.trophies || 0), 0) / sameTHCount)
            : 0,
          avgDonationsForTH: sameTHCount > 0
            ? Math.round(sameTHPlayers.reduce((sum: number, m: any) => sum + (m.donations || 0), 0) / sameTHCount)
            : 0,
          avgWarStarsForTH: sameTHCount > 0
            ? Math.round(sameTHPlayers.reduce((sum: number, m: any) => sum + (m.warStars || 0), 0) / sameTHCount)
            : 0,
        };
      })(),
      roleComparison: (() => {
        const playerRole = player.role || 'member';
        const sameRolePlayers = members.filter((m: any) => (m.role || 'member') === playerRole);
        const sameRoleCount = sameRolePlayers.length;
        
        return {
          playerRole,
          sameRoleCount,
          avgMetricsForRole: {
            trophies: sameRoleCount > 0
              ? Math.round(sameRolePlayers.reduce((sum: number, m: any) => sum + (m.trophies || 0), 0) / sameRoleCount)
              : 0,
            donations: sameRoleCount > 0
              ? Math.round(sameRolePlayers.reduce((sum: number, m: any) => sum + (m.donations || 0), 0) / sameRoleCount)
              : 0,
            warStars: sameRoleCount > 0
              ? Math.round(sameRolePlayers.reduce((sum: number, m: any) => sum + (m.warStars || 0), 0) / sameRoleCount)
              : 0,
          },
        };
      })(),
    };

    logger.info('Served player comparison', { tag: normalized });

    return json({
      success: true,
      data: comparison,
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error('Roster fetch timeout', { tag: normalized });
      return json({ 
        success: false, 
        error: "Request timeout while loading roster data. Please try again." 
      }, { status: 504 });
    }
    
    logger.error('Error generating player comparison', { 
      error: error.message, 
      stack: error.stack,
      tag: normalized 
    });
    return json({ 
      success: false, 
      error: "Unable to generate comparison data. Please try again later." 
    }, { status: 500 });
  }
}
