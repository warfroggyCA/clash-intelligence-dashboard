export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/mcp-working');
  return json({
    success: true,
    data: {
      name: "Clash Intelligence MCP Server",
      version: "1.0.0",
      description: "Working MCP server for Cursor integration",
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
