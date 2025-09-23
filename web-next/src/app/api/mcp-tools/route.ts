export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/mcp-tools');
  return json({
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
      },
      {
        name: "get-war-data",
        description: "Retrieve current and recent war information",
        parameters: [
          {
            name: "clanTag",
            type: "string",
            description: "Clan tag to retrieve war data for",
            required: true
          }
        ]
      },
      {
        name: "get-snapshot-data",
        description: "Retrieve roster snapshot data for analysis",
        parameters: [
          {
            name: "clanTag",
            type: "string",
            description: "Clan tag to retrieve snapshot data for",
            required: true
          },
          {
            name: "date",
            type: "string",
            description: "Date of snapshot (optional, defaults to latest)",
            required: false
          }
        ]
      },
      {
        name: "trigger-ingestion",
        description: "Trigger a new data ingestion job for the clan",
        parameters: [
          {
            name: "clanTag",
            type: "string",
            description: "Clan tag to ingest data for",
            required: true
          }
        ]
      }
    ],
    capabilities: [
      "clan-data-access",
      "member-analytics", 
      "war-intelligence",
      "snapshot-management",
      "ingestion-control"
    ]
  });
}
