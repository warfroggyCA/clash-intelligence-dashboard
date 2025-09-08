// web-next/src/app/api/sync/heroes/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import { promises as fsp } from "fs";
import { cfg } from "@/lib/config";
import { getClanMembers, getPlayer, extractHeroLevels } from "@/lib/coc";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Tiny concurrency helper to be gentle with the API
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (x: T, i: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let i = 0, active = 0;
  return new Promise((resolve) => {
    const launch = () => {
      if (i >= items.length && active === 0) return resolve(out);
      while (active < limit && i < items.length) {
        const idx = i++, it = items[idx]; active++;
        fn(it, idx)
          .then((res) => { out[idx] = res; })
          .catch((_e) => { out[idx] = undefined as any; })
          .finally(() => { active--; launch(); });
      }
    };
    launch();
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clanTag = url.searchParams.get("clanTag") || cfg.homeClanTag;
    if (!clanTag) {
      return NextResponse.json({ ok: false, error: "Missing clanTag" }, { status: 400 });
    }

    // 1) List members from CoC
    const members = await getClanMembers(clanTag);
    if (!members.length) {
      return NextResponse.json({ ok: false, error: "No members from API" }, { status: 404 });
    }

    // 2) Pull each player (heroes) with modest concurrency
    const results = await mapLimit(members, 5, async (m) => {
      await sleep(60); // tiny jitter
      const p = await getPlayer(m.tag);
      const heroes = extractHeroLevels(p); // maps to {bk,aq,gw,rc,mp}
      return { tag: m.tag.toUpperCase(), heroes };
    });

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

    return NextResponse.json({
      ok: true,
      summary: {
        clanTag,
        members: members.length,
        heroesWritten: Object.keys(heroIndex).length,
        outPath
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "sync failed" }, { status: 500 });
  }
}

