// web-next/src/app/api/debug/player/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPlayer, extractHeroLevels } from "@/lib/coc";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tag = url.searchParams.get("tag");
    if (!tag) return NextResponse.json({ ok: false, error: "missing tag" }, { status: 400 });
    const p = await getPlayer(tag);
    const heroes = extractHeroLevels(p);
    return NextResponse.json({
      ok: true,
      name: p.name,
      tag: p.tag,
      townHallLevel: p.townHallLevel,
      rawHeroNames: (p.heroes || []).map(h => h.name),
      levels: heroes
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

