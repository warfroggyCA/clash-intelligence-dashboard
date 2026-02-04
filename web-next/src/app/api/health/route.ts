export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const { json } = createApiContext(request, "/api/health");

  // Check if this is an MCP request
  const url = new URL(request.url);
  if (url.searchParams.get("mcp") === "true") {
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
                required: true,
              },
            ],
          },
          {
            name: "get-member-data",
            description: "Retrieve member information and statistics",
            parameters: [
              {
                name: "playerTag",
                type: "string",
                description: "Player tag to retrieve data for",
                required: true,
              },
            ],
          },
        ],
        capabilities: ["clan-data-access", "member-analytics"],
      },
    });
  }

  // Regular health check
  const hasCoC = !!process.env.COC_API_TOKEN;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  return json({
    success: true,
    data: {
      hasCoC,
      hasOpenAI,
      atMs: Date.now(),
    },
  });
}

export async function POST(request: Request) {
  const { json } = createApiContext(request, "/api/health");

  // Check if this is a direct ingestion request (from Ingestion Monitor modal)
  const url = new URL(request.url);
  if (url.searchParams.get("cron") === "true") {
    try {
      // Import the staged ingestion function (same as cron route)
      const { runStagedIngestionJob } = await import("@/lib/ingestion/run-staged-ingestion");
      const { cfg } = await import("@/lib/config");

      let targetClanTag = cfg.homeClanTag;

      // CRITICAL SAFEGUARD: Ensure we're using the correct default clan tag
      if (!targetClanTag || targetClanTag === "#G9QVRYC2Y") {
        console.error(
          `[Health/DirectIngestion] INVALID CLAN TAG DETECTED: ${targetClanTag}. Forcing to #2PR8R8V8P`
        );
        targetClanTag = "#2PR8R8V8P";
      }

      console.log("[Health/DirectIngestion] Starting direct ingestion job for", targetClanTag);

      // Check for forceInsights parameter to regenerate insights even if data is current
      const urlObj = new URL(request.url);
      const forceInsights = urlObj.searchParams.get("forceInsights") === "true";
      const forceFetch = urlObj.searchParams.get("forceFetch") === "true";

      const result = await runStagedIngestionJob({
        clanTag: targetClanTag,
        runPostProcessing: true,
        forceInsights,
        forceFetch,
      });

      console.log(
        "[Health/DirectIngestion] Direct ingestion completed:",
        result.success ? "SUCCESS" : "FAILED"
      );

      if (!result.success) {
        return json(
          {
            success: false,
            error: result.error || "Ingestion failed",
            data: {
              clanTag: result.clanTag,
              success: false,
              error: result.error,
            },
          },
          { status: 500 }
        );
      }

      // Format response similar to what the UI expects
      const ingestionResult = result.ingestionResult as any;

      // Extract member count from the upsertMembers phase row_delta, or from transform phase metadata
      const memberCount =
        ingestionResult?.phases?.upsertMembers?.row_delta ??
        ingestionResult?.phases?.transform?.metadata?.memberCount ??
        ingestionResult?.phases?.fetch?.metadata?.snapshot?.memberSummaries?.length ??
        0;

      const responseData = [
        {
          clanTag: result.clanTag,
          success: result.success,
          memberCount,
          changesDetected: result.changeSummary ? "Yes" : "No",
          playersResolved: result.playersResolved ?? 0,
          summary: result.changeSummary,
          skipped: ingestionResult?.skipped ?? false,
          reason:
            ingestionResult?.reason ||
            (memberCount === 0 && result.success
              ? "No members processed - check ingestion logs"
              : undefined),
          insightsGenerated: result.insightsGenerated ?? false,
          error: result.error,
          phases: ingestionResult?.phases
            ? {
                fetch: ingestionResult.phases.fetch?.success,
                transform: ingestionResult.phases.transform?.success,
                upsertMembers: ingestionResult.phases.upsertMembers?.success,
                writeSnapshot: ingestionResult.phases.writeSnapshot?.success,
                writeStats: ingestionResult.phases.writeStats?.success,
              }
            : undefined,
        },
      ];

      return json({
        success: true,
        data: responseData,
      });
    } catch (error: any) {
      console.error("[Health/DirectIngestion] Direct ingestion failed:", error);
      return json(
        {
          success: false,
          error: error?.message || "Internal Server Error",
        },
        { status: 500 }
      );
    }
  }

  // Default POST response
  return json({ success: true, message: "Health endpoint POST" });
}
// Trigger deployment Tue Sep 23 15:58:59 EDT 2025
