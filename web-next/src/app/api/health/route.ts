export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/health');
  
  // Check if this is an MCP request
  const url = new URL(request.url);
  if (url.searchParams.get('mcp') === 'true') {
    return json({
      success: true,
      data: {
        name: "Clash Intelligence MCP Server",
        version: "1.0.0",
        description: "MCP server for Clash Intelligence dashboard tools and data access",
        tools: [
          {
            name: "get-clan-data",
            description: "Retrieve current clan information and statistics",
            parameters: [
              {
                name: "clanTag",
                type: "string",
                description: "Clan tag to retrieve data for",
                required: true
              }
            ]
          },
          {
            name: "get-member-data",
            description: "Retrieve member information and statistics", 
            parameters: [
              {
                name: "playerTag",
                type: "string",
                description: "Player tag to retrieve data for",
                required: true
              }
            ]
          }
        ],
        capabilities: [
          "clan-data-access",
          "member-analytics"
        ]
      }
    });
  }
  
  // Regular health check
  const hasCoC = !!process.env.COC_API_TOKEN;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  return json({ success: true, data: { hasCoC, hasOpenAI } });
}
