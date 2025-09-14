// web-next/src/app/api/roster/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from "@/lib/coc";
import { getLatestSnapshot, loadSnapshot } from "@/lib/snapshots";
import { isValidTag, normalizeTag } from "@/lib/tags";
import { rateLimiter } from "@/lib/rate-limiter";
import { ymdNowUTC } from "@/lib/date";
import { readTenureDetails } from "@/lib/tenure";

// ---------- small helpers ----------
// Validation moved to lib/tags

// Shared rateLimiter is imported from lib/rate-limiter

// Concurrency is governed by the shared rateLimiter

// ---------- route ----------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("clanTag") || cfg.homeClanTag || "";
    const clanTag = normalizeTag(raw);
    const mode = url.searchParams.get("mode") || "live";
    
    if (!clanTag || !isValidTag(clanTag)) {
      return NextResponse.json({ ok:false, error:"Provide a valid clanTag like #2PR8R8V8P" }, { status:400 });
    }

    // Handle snapshot mode - load from stored snapshots
    if (mode === "snapshot") {
      const requestedDate = url.searchParams.get("date");
      let snapshot;
      
      if (requestedDate && requestedDate !== "latest") {
        snapshot = await loadSnapshot(clanTag, requestedDate);
      } else {
        snapshot = await getLatestSnapshot(clanTag);
      }
      
      if (!snapshot) {
        // Fallback to live data if no snapshot available
        console.log(`No snapshot found for ${clanTag}, falling back to live data`);
        // Continue to live data fetching below instead of returning error
      } else {
        // Load tenure data as it was on the snapshot date
        const tenureDetails = await readTenureDetails(snapshot.date);
        
        // Enrich snapshot members with date-appropriate tenure data
        const enrichedMembers = snapshot.members.map((member: any) => {
          const key = normalizeTag(member.tag);
          const t = tenureDetails[key];
          return {
            ...member,
            tenure_days: t?.days || 0,
            tenure_as_of: t?.as_of,
          };
        });
        
        return NextResponse.json({
          source: "snapshot",
          date: snapshot.date,
          clanName: snapshot.clanName,
          meta: { clanTag, clanName: snapshot.clanName },
          members: enrichedMembers,
        }, { status: 200 });
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
      return NextResponse.json({ ok:false, error:`No members returned for ${clanTag}` }, { status:404 });
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
    const enriched = await Promise.all(members.map(async (m) => {
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
        };
      } finally {
        rateLimiter.release();
      }
    }))

    return NextResponse.json({
      source: "live",
      date: ymdNowUTC(),
      clanName: (info as any)?.name,
      meta: { clanTag, clanName: (info as any)?.name },
      members: (enriched || []).filter(Boolean),
    }, { status: 200 });
  } catch (e: any) {
    console.error('Roster API error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || "Internal server error",
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 });
  }
}
