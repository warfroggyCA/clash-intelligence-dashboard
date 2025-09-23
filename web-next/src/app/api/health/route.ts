export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/health');
  
  // Check if this is a cron request (temporary workaround)
  const url = new URL(request.url);
  if (url.searchParams.get('cron') === 'true') {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Verify this is coming from Vercel's cron service
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized access attempt via health endpoint');
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      console.log('[Cron] Starting daily ingestion job via health endpoint');
      const { runIngestionJob } = await import('@/lib/ingestion/run-ingestion');
      
      const results = await runIngestionJob({ 
        clanTag: '#2PR8R8V8P'
      });
      
      console.log('[Cron] Daily ingestion completed via health endpoint:', results);
      
      return json({ 
        success: true, 
        data: results,
        timestamp: new Date().toISOString(),
        source: 'health-endpoint-workaround'
      });
    } catch (error: any) {
      console.error('[Cron] Daily ingestion failed via health endpoint:', error);
      return json(
        { 
          success: false, 
          error: error?.message || 'Internal Server Error',
          timestamp: new Date().toISOString(),
          source: 'health-endpoint-workaround'
        }, 
        { status: 500 }
      );
    }
  }
  
  // Check if this is an MCP request
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
// Trigger deployment Tue Sep 23 15:58:59 EDT 2025
