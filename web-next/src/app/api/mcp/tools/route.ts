import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
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
}

