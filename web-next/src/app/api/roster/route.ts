// web-next/src/app/api/roster/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from "@/lib/coc";
import { getLatestSnapshot, loadSnapshot } from "@/lib/snapshots";
import { isValidTag, normalizeTag } from "@/lib/tags";
import { rateLimiter } from "@/lib/rate-limiter";
import { ymdNowUTC } from "@/lib/date";
import { readTenureDetails } from "@/lib/tenure";
import type { Roster, Member, ApiResponse } from "@/types";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import { createApiContext } from "@/lib/api/route-helpers";
import { cached } from "@/lib/cache";
import { z } from "zod";

// ---------- small helpers ----------
// Validation moved to lib/tags

// Shared rateLimiter is imported from lib/rate-limiter

// Concurrency is governed by the shared rateLimiter

// ---------- route ----------
export async function GET(req: NextRequest) {
  const { logger, json } = createApiContext(req as unknown as Request, '/api/roster');
  try {
    const t0 = Date.now();
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Zod validation for query params
    const QuerySchema = z.object({
      clanTag: z.string().optional(),
      mode: z.enum(["live", "snapshot"]).optional().default("live"),
      date: z.string().optional(),
    });
    const q = QuerySchema.parse(params);

    const raw = q.clanTag || cfg.homeClanTag || "";
    const clanTag = normalizeTag(raw);
    const mode = q.mode;

    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: "Provide a valid clanTag like #2PR8R8V8P" }, { status: 400 });
    }

    // Basic inbound rate limit per IP+route+mode
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `roster:${mode}:${clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 30),
        }
      });
    }

    // Handle snapshot mode - load from stored snapshots
    if (mode === "snapshot") {
      const requestedDate = q.date;
      let snapshot;
      
      if (requestedDate && requestedDate !== "latest") {
        // Validate YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
          return json({ success: false, error: "Invalid date format. Use YYYY-MM-DD or 'latest'" }, { status: 400 });
        }
        snapshot = await cached(["roster","snapshot",clanTag,requestedDate], () => loadSnapshot(clanTag, requestedDate));
      } else {
        snapshot = await cached(["roster","snapshot","latest",clanTag], () => getLatestSnapshot(clanTag));
      }
      
      if (!snapshot) {
        // Fallback to live data if no snapshot available
        logger.info('No snapshot found, falling back to live', { clanTag });
        // Continue to live data fetching below instead of returning error
      } else {
        // Load tenure data as it was on the snapshot date
        const tenureDetails = await cached(["tenure","as-of",snapshot.date], () => readTenureDetails(snapshot.date));
        
        // Enrich snapshot members with date-appropriate tenure data
        const enrichedMembers: Member[] = snapshot.members.map((member: any) => {
          const key = normalizeTag(member.tag);
          const t = tenureDetails[key];
          return {
            ...member,
            tenure_days: t?.days || 0,
            tenure_as_of: t?.as_of,
          } as Member;
        });
        
        const payload: Roster = {
          source: "snapshot",
          date: snapshot.date,
          clanName: snapshot.clanName,
          clanTag,
          meta: { clanName: snapshot.clanName },
          members: enrichedMembers,
        };
        const res = json<Roster>({ success: true, data: payload }, { status: 200, headers: { "Cache-Control": "private, max-age=60" } });
        logger.info('Served roster snapshot', { clanTag, ms: Date.now() - t0, members: enrichedMembers.length });
        return res;
      }
    }

    // 1) clan info + members (live, rate-limited)
    await rateLimiter.acquire();
    let info, members;
    try {
      [info, members] = await Promise.all([
        getClanInfo(clanTag),
        getClanMembers(clanTag) // (coc.ts uses ?limit=50)
      ]);
    } finally {
      rateLimiter.release();
    }
    if (!members?.length) {
      return json({ success: false, error: `No members returned for ${clanTag}` }, { status: 404 });
    }

    // 2) read effective tenure map (append-only)
    const tenureDetails = await readTenureDetails();
    if (process.env.ENABLE_DEBUG_LOGGING === 'true') {
      try {
        const memberTags = new Set(members.map((m:any) => normalizeTag(m.tag)));
        let hits = 0;
        for (const t of Object.keys(tenureDetails)) if (memberTags.has(t)) hits++;
        console.log(`[Roster] Tenure details loaded: ${Object.keys(tenureDetails).length} rows; matching current members: ${hits}/${members.length}`);
      } catch {}
    }

    // 3) pull each player for TH + heroes (rate-limited)
    const enriched: Member[] = await Promise.all(members.map(async (m) => {
      await rateLimiter.acquire();
      try {
        const p = await getPlayer(m.tag);
        const heroes = extractHeroLevels(p);
        const key = normalizeTag(m.tag);
        const t = tenureDetails[key];
        return {
          name: m.name,
          tag: key,
          townHallLevel: p.townHallLevel,
          trophies: m.trophies,
          donations: m.donations,
          donationsReceived: m.donationsReceived,
          role: m.role,
          bk: typeof heroes.bk === "number" ? heroes.bk : null,
          aq: typeof heroes.aq === "number" ? heroes.aq : null,
          gw: typeof heroes.gw === "number" ? heroes.gw : null,
          rc: typeof heroes.rc === "number" ? heroes.rc : null,
          mp: typeof heroes.mp === "number" ? heroes.mp : null,
          tenure_days: t?.days || 0,
          tenure_as_of: t?.as_of,
        } as Member;
      } finally {
        rateLimiter.release();
      }
    }))

    const payload: Roster = {
      source: "live",
      date: ymdNowUTC(),
      clanName: (info as any)?.name,
      clanTag,
      meta: { clanTag, clanName: (info as any)?.name },
      members: enriched || [],
    };
    const res = json<Roster>({ success: true, data: payload }, { status: 200, headers: { "Cache-Control": "private, max-age=60" } });
    logger.info('Served roster live', { clanTag, ms: Date.now() - t0, members: payload.members.length });
    return res;
  } catch (e: any) {
    console.error('Roster API error:', e);
    return json({
      success: false,
      error: e?.message || "Internal server error",
      message: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
    }, { status: 500 });
  }
}
