// web-next/src/app/api/sync/heroes/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import { promises as fsp } from "fs";
import { cfg } from "@/lib/config";
import { getClanMembers, getPlayer, extractHeroLevels } from "@/lib/coc";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { rateLimiter } from "@/lib/rate-limiter";
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';

// Concurrency is governed by the shared rateLimiter

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/sync/heroes');
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("clanTag") || cfg.homeClanTag || '';
    const clanTag = normalizeTag(raw);
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: "Missing clanTag" }, { status: 400 });
    }

    // Rate limit (expensive writer)
    const ip = (request.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `sync:heroes:${clanTag}:${ip}`;
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

    // 1) List members from CoC
    const members = await getClanMembers(clanTag);
    if (!members.length) {
      return json({ success: false, error: "No members from API" }, { status: 404 });
    }

    // 2) Pull each player (heroes) with modest concurrency
    const results = await Promise.all(members.map(async (m) => {
      await rateLimiter.acquire();
      try {
        const p = await getPlayer(m.tag);
        const heroes = extractHeroLevels(p); // maps to {bk,aq,gw,rc,mp}
        return { tag: normalizeTag(m.tag), heroes };
      } finally {
        rateLimiter.release();
      }
    }));

    // 3) Write hero_index.json (fallback data used by /api/roster when live is unavailable)
    const heroIndex: Record<string, any> = {};
    for (const r of results) {
      if (!r) continue;
      heroIndex[r.tag] = r.heroes;
    }

    const outDir = path.join(process.cwd(), cfg.fallbackDataRoot);
    await fsp.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, "hero_index.json");

    // daily backup (first write of the day)
    try {
      const bak = path.join(outDir, `hero_index_${new Date().toISOString().slice(0,10)}.json.bak`);
      try { await fsp.stat(bak); } catch {
        const old = await fsp.readFile(outPath, "utf-8").catch(() => "");
        if (old) await fsp.writeFile(bak, old, "utf-8");
      }
    } catch {}

    await fsp.writeFile(outPath, JSON.stringify(heroIndex, null, 2) + "\n", "utf-8");

    return json({
      success: true,
      data: {
        clanTag,
        members: members.length,
        heroesWritten: Object.keys(heroIndex).length,
        outPath
      }
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "sync failed" }, { status: 500 });
  }
}
