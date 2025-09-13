import { NextRequest, NextResponse } from 'next/server';

// Helper function to make requests to your existing APIs
async function fetchFromAPI(endpoint: string, baseUrl?: string) {
  try {
    const url = baseUrl ? `${baseUrl}${endpoint}` : `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5050'}${endpoint}`;
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

// Helper functions
function analyzeRushStatus(rosterData: any) {
  if (!rosterData.members) {
    return { error: "No member data available" };
  }

  const members = rosterData.members;
  const rushedMembers = members.filter((m: any) => {
    // Calculate rush percentage (simplified)
    const th = m.townHallLevel || m.th;
    const bk = m.bk || 0;
    const aq = m.aq || 0;
    
    if (th < 7) return false;
    
    const expectedHeroes = th >= 15 ? 75 : th >= 12 ? 50 : th >= 9 ? 30 : 15;
    const actualHeroes = Math.max(bk, aq);
    const rushPercentage = Math.max(0, (expectedHeroes - actualHeroes) / expectedHeroes * 100);
    
    return rushPercentage >= 40;
  }).sort((a: any, b: any) => {
    const aTh = a.townHallLevel || a.th;
    const bTh = b.townHallLevel || b.th;
    const aHeroes = Math.max(a.bk || 0, a.aq || 0);
    const bHeroes = Math.max(b.bk || 0, b.aq || 0);
    return bHeroes - aHeroes;
  });

  return {
    clanName: rosterData.clanName || "Unknown Clan",
    totalMembers: members.length,
    rushedMembers: rushedMembers.length,
    rushPercentage: Math.round((rushedMembers.length / members.length) * 100),
    topRushedPlayers: rushedMembers.slice(0, 5).map((m: any) => ({
      name: m.name,
      townHall: m.townHallLevel || m.th,
      barbarianKing: m.bk,
      archerQueen: m.aq,
      grandWarden: m.gw,
      royalChampion: m.rc
    }))
  };
}

function formatActivitySummary(changesData: any) {
  if (!changesData || !Array.isArray(changesData)) {
    return { error: "No activity data available" };
  }

  const recentChanges = changesData.slice(0, 5);
  
  return {
    totalChanges: changesData.length,
    recentActivity: recentChanges.map((change: any) => ({
      date: change.date,
      summary: change.summary,
      unread: change.unread,
      actioned: change.actioned
    }))
  };
}

export async function POST(req: NextRequest, { params }: { params: { toolName: string } }) {
  try {
    const { toolName } = params;
    const body = await req.json();
    const { clanTag = "#2PR8R8V8P", playerName, mode = "live" } = body;

    let result;

    switch (toolName) {
      case "analyze_clan_rush_status":
        const rosterData = await fetchFromAPI(`/api/roster?mode=${mode}&clanTag=${encodeURIComponent(clanTag)}`);
        result = analyzeRushStatus(rosterData);
        break;

      case "get_clan_activity_summary":
        const changesData = await fetchFromAPI(`/api/snapshots/changes?clanTag=${encodeURIComponent(clanTag)}`);
        result = formatActivitySummary(changesData);
        break;

      case "generate_ai_coaching_advice":
        const adviceData = await fetchFromAPI(`/api/ai-coaching/generate?clanTag=${encodeURIComponent(clanTag)}${playerName ? `&playerName=${encodeURIComponent(playerName)}` : ''}`);
        result = adviceData;
        break;

      case "get_clan_roster":
        result = await fetchFromAPI(`/api/roster?mode=${mode}&clanTag=${encodeURIComponent(clanTag)}`);
        break;

      default:
        return NextResponse.json({ error: `Unknown tool: ${toolName}` }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error(`Error in tool ${params.toolName}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

