#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.MCP_PORT || 3001;

// Enable CORS for ChatGPT
app.use(cors());
app.use(express.json());

// Base URL for your existing APIs
const BASE_URL = 'http://localhost:5050';

// Helper function to make requests to your existing APIs
async function fetchFromAPI(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

// MCP Server endpoints
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: "analyze_clan_rush_status",
        description: "Get rush analysis for clan members with recommendations",
        inputSchema: {
          type: "object",
          properties: {
            clanTag: {
              type: "string",
              description: "Clan tag (e.g., #2PR8R8V8P)",
              default: "#2PR8R8V8P"
            }
          }
        }
      },
      {
        name: "get_clan_activity_summary",
        description: "Get recent clan activity and member changes",
        inputSchema: {
          type: "object",
          properties: {
            clanTag: {
              type: "string", 
              description: "Clan tag (e.g., #2PR8R8V8P)",
              default: "#2PR8R8V8P"
            }
          }
        }
      },
      {
        name: "generate_ai_coaching_advice",
        description: "Generate personalized coaching advice for specific players",
        inputSchema: {
          type: "object",
          properties: {
            clanTag: {
              type: "string",
              description: "Clan tag (e.g., #2PR8R8V8P)", 
              default: "#2PR8R8V8P"
            },
            playerName: {
              type: "string",
              description: "Name of the player to generate advice for (optional)"
            }
          }
        }
      },
      {
        name: "get_clan_roster",
        description: "Get current clan roster with member details",
        inputSchema: {
          type: "object",
          properties: {
            clanTag: {
              type: "string",
              description: "Clan tag (e.g., #2PR8R8V8P)",
              default: "#2PR8R8V8P"
            },
            mode: {
              type: "string",
              description: "Data mode: 'live' or 'snapshot'",
              enum: ["live", "snapshot"],
              default: "live"
            }
          }
        }
      }
    ]
  });
});

app.post('/mcp/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { clanTag = "#2PR8R8V8P", playerName, mode = "live" } = req.body;

  try {
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
        return res.status(400).json({ error: `Unknown tool: ${toolName}` });
    }

    res.json({ result });
  } catch (error) {
    console.error(`Error in tool ${toolName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function analyzeRushStatus(rosterData) {
  if (!rosterData.members) {
    return { error: "No member data available" };
  }

  const members = rosterData.members;
  const rushedMembers = members.filter(m => {
    // Calculate rush percentage (simplified)
    const th = m.townHallLevel || m.th;
    const bk = m.bk || 0;
    const aq = m.aq || 0;
    
    if (th < 7) return false;
    
    const expectedHeroes = th >= 15 ? 75 : th >= 12 ? 50 : th >= 9 ? 30 : 15;
    const actualHeroes = Math.max(bk, aq);
    const rushPercentage = Math.max(0, (expectedHeroes - actualHeroes) / expectedHeroes * 100);
    
    return rushPercentage >= 40;
  }).sort((a, b) => {
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
    topRushedPlayers: rushedMembers.slice(0, 5).map(m => ({
      name: m.name,
      townHall: m.townHallLevel || m.th,
      barbarianKing: m.bk,
      archerQueen: m.aq,
      grandWarden: m.gw,
      royalChampion: m.rc
    }))
  };
}

function formatActivitySummary(changesData) {
  if (!changesData || !Array.isArray(changesData)) {
    return { error: "No activity data available" };
  }

  const recentChanges = changesData.slice(0, 5);
  
  return {
    totalChanges: changesData.length,
    recentActivity: recentChanges.map(change => ({
      date: change.date,
      summary: change.summary,
      unread: change.unread,
      actioned: change.actioned
    }))
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Available at: http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp/tools`);
});

