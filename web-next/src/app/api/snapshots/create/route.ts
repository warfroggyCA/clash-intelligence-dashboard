// web-next/src/app/api/snapshots/create/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { detectChanges, saveChangeSummary, getLatestSnapshot } from "@/lib/snapshots";
import { generateChangeSummary } from "@/lib/ai-summarizer";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import { createApiContext } from "@/lib/api/route-helpers";
import { fetchFullClanSnapshot, persistFullClanSnapshot } from "@/lib/full-snapshot";

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
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
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

    // Create today's full snapshot
    const fullSnapshot = await fetchFullClanSnapshot(clanTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
    });
    await persistFullClanSnapshot(fullSnapshot);
    
    // Convert to DailySnapshot format for change detection
    const currentSnapshot = {
      date: fullSnapshot.fetchedAt.slice(0, 10),
      clanTag: fullSnapshot.clanTag,
      clanName: fullSnapshot.clan?.name,
      timestamp: fullSnapshot.fetchedAt,
      members: fullSnapshot.memberSummaries.map((summary: any) => ({
        name: summary.name,
        tag: summary.tag,
        townHallLevel: summary.townHallLevel,
        trophies: summary.trophies,
        donations: summary.donations,
        donationsReceived: summary.donationsReceived,
        role: summary.role,
        tenure_days: 0,
        attackWins: 0,
        versusBattleWins: 0,
        versusTrophies: summary.builderTrophies || 0,
        clanCapitalContributions: 0,
      })),
      memberCount: fullSnapshot.memberSummaries.length,
      totalTrophies: fullSnapshot.memberSummaries.reduce((sum: number, m: any) => sum + (m.trophies || 0), 0),
      totalDonations: fullSnapshot.memberSummaries.reduce((sum: number, m: any) => sum + (m.donations || 0), 0),
    };
    
    // Get previous snapshot for comparison
    const previousSnapshot = await getLatestSnapshot(clanTag);
    
    let changeSummary = null;
    
    if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
      // Detect changes
      const changes = detectChanges(previousSnapshot, currentSnapshot);
      
      if (changes.length > 0) {
        // Generate automated summary
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
