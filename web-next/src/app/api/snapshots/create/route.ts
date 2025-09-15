// web-next/src/app/api/snapshots/create/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createDailySnapshot, detectChanges, saveChangeSummary, getLatestSnapshot } from "@/lib/snapshots";
import { generateChangeSummary } from "@/lib/ai-summarizer";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import { createApiContext } from "@/lib/api/route-helpers";

export async function POST(req: NextRequest) {
  const { json } = createApiContext(req, '/api/snapshots/create');
  try {
    const body = await req.json();
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: "clanTag is required" }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    if (!isValidTag(clanTag)) {
      return json({ success: false, error: "Provide a valid clanTag like #2PR8R8V8P" }, { status: 400 });
    }

    // Inbound rate limit (expensive path)
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `snapshots:create:${clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 6 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 6),
        }
      });
    }

    // Create today's snapshot
    const currentSnapshot = await createDailySnapshot(clanTag);
    
    // Get previous snapshot for comparison
    const previousSnapshot = await getLatestSnapshot(clanTag);
    
    let changeSummary = null;
    
    if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
      // Detect changes
      const changes = detectChanges(previousSnapshot, currentSnapshot);
      
      if (changes.length > 0) {
        // Generate AI summary
        const summary = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
        
        changeSummary = {
          date: currentSnapshot.date,
          clanTag,
          changes,
          summary,
          unread: true,
          actioned: false,
          createdAt: new Date().toISOString(),
          gameChatMessages: [],
        };
        
        // Save change summary
        await saveChangeSummary(changeSummary);
      }
    }

    return json({
      success: true,
      data: { snapshot: currentSnapshot, changes: changeSummary }
    });
  } catch (error: any) {
    console.error('Snapshot creation error:', error);
    return json({ success: false, error: error.message || "Failed to create snapshot" }, { status: 500 });
  }
}
