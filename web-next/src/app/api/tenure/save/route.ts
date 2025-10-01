// web-next/src/app/api/tenure/save/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cfg } from "../../../../lib/config";
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { appendTenureLedgerEntry } from '@/lib/tenure';

type Update = { tag: string; tenure_days: number };
const TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/;

function ymdUTC(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const { json } = createApiContext(req, '/api/tenure/save');
  try {
    const body = await req.json().catch(() => ({}));
    const Schema = z.object({ updates: z.array(z.object({ tag: z.string(), tenure_days: z.number() })) });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return json({ success: false, error: "No updates" }, { status: 400 });
    const updates: Update[] = parsed.data.updates;

    const invalid: string[] = [];
    const cleaned = updates.map((u) => {
      const tag = String(u.tag || "").trim().toUpperCase();
      const base = Math.max(0, Math.min(20000, Math.round(Number(u.tenure_days))));
      if (!TAG_RE.test(tag)) invalid.push(tag || "(empty)");
      return { tag, base };
    });
    if (invalid.length) return json({ success: false, error: `Invalid tag(s): ${invalid.join(", ")}` }, { status: 400 });

    // Use Supabase-based tenure saving for production persistence
    const as_of = ymdUTC();
    for (const c of cleaned) {
      await appendTenureLedgerEntry(c.tag, c.base, as_of);
    }

    return json({ success: true, data: { count: cleaned.length } });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Save failed" }, { status: 500 });
  }
}
