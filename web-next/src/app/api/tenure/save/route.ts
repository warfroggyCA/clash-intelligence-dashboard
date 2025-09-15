// web-next/src/app/api/tenure/save/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as fsp } from "fs";
import path from "path";
import { cfg } from "../../../../lib/config";
import { z } from 'zod';
import type { ApiResponse } from '@/types';

type Update = { tag: string; tenure_days: number };
const TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/;

function ymdUTC(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const Schema = z.object({ updates: z.array(z.object({ tag: z.string(), tenure_days: z.number() })) });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json<ApiResponse>({ success: false, error: "No updates" }, { status: 400 });
    const updates: Update[] = parsed.data.updates;

    const invalid: string[] = [];
    const cleaned = updates.map((u) => {
      const tag = String(u.tag || "").trim().toUpperCase();
      const base = Math.max(0, Math.min(20000, Math.round(Number(u.tenure_days))));
      if (!TAG_RE.test(tag)) invalid.push(tag || "(empty)");
      return { tag, base };
    });
    if (invalid.length) return NextResponse.json<ApiResponse>({ success: false, error: `Invalid tag(s): ${invalid.join(", ")}` }, { status: 400 });

    const outDir = path.join(process.cwd(), cfg.dataRoot);
    const ledger = path.join(outDir, "tenure_ledger.jsonl");
    await fsp.mkdir(outDir, { recursive: true });

    try {
      await fsp.stat(ledger);
      const bak = path.join(outDir, `tenure_ledger_backup_${ymdUTC()}.jsonl`);
      try { await fsp.stat(bak); } catch { await fsp.copyFile(ledger, bak); }
    } catch { /* first write; no ledger yet */ }

    const as_of = ymdUTC(); const ts = new Date().toISOString();
    const lines = cleaned.map((c) => JSON.stringify({ tag: c.tag, base: c.base, as_of, ts }));
    await fsp.appendFile(ledger, lines.join("\n") + "\n", "utf-8");

    return NextResponse.json<ApiResponse>({ success: true, data: { count: cleaned.length } });
  } catch (e: any) {
    return NextResponse.json<ApiResponse>({ success: false, error: e?.message || "Save failed" }, { status: 500 });
  }
}
