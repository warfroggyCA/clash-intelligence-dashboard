// web-next/src/app/api/debug/player/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPlayer, extractHeroLevels } from "@/lib/coc";
import { z } from 'zod';
import type { ApiResponse } from '@/types';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const Schema = z.object({ tag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return NextResponse.json<ApiResponse>({ success: false, error: "missing tag" }, { status: 400 });
    const tag = parsed.data.tag;
    const p = await getPlayer(tag);
    const heroes = extractHeroLevels(p);
    return NextResponse.json<ApiResponse>({ success: true, data: { name: p.name, tag: p.tag, townHallLevel: p.townHallLevel, rawHeroNames: (p.heroes || []).map(h => h.name), levels: heroes } });
  } catch (e: any) {
    return NextResponse.json<ApiResponse>({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
