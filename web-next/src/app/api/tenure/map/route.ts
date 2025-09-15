// web-next/src/app/api/tenure/map/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import path from "path";
import { promises as fsp } from "fs";
import { cfg } from "../../../../lib/config";
import { createApiContext } from "@/lib/api/route-helpers";
import { cached } from "@/lib/cache";

const TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/;

function daysSince(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ""); if (!m) return 0;
  const a = Date.UTC(+m[1], +m[2]-1, +m[3], 0,0,0);
  const now = new Date();
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0,0,0);
  const d = Math.floor((b - a)/86400000);
  return d > 0 ? d : 0;
}

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/tenure/map');
  try {
    const ledger = path.join(process.cwd(), cfg.dataRoot, "tenure_ledger.jsonl");
    try { await fsp.stat(ledger); } catch { return json({ success: true, data: {} }); }
    const lines = await cached(['tenure','ledger','lines'], async () => {
      const raw = await fsp.readFile(ledger, "utf-8");
      return raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    }, 10);

    const latest: Record<string,string> = {};
    const base: Record<string,number> = {};
    const asof: Record<string,string> = {};

    for (const line of lines) {
      let row: any = null; try { row = JSON.parse(line); } catch { continue; }
      const tag = String(row?.tag || "").toUpperCase().trim();
      const ts  = String(row?.ts || "");
      if (!TAG_RE.test(tag) || !ts) continue;
      if (latest[tag] && latest[tag] >= ts) continue;
      latest[tag] = ts; base[tag] = Number(row?.base ?? row?.tenure_days ?? 0) || 0; asof[tag] = String(row?.as_of || "");
    }

    const map: Record<string,number> = {};
    for (const [tag, b] of Object.entries(base)) map[tag] = Math.max(0, Math.round(b + daysSince(asof[tag] || "")));
    return json({ success: true, data: map }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "map failed" }, { status: 500 });
  }
}
