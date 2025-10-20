// web-next/src/app/api/tenure/save/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cfg } from "../../../../lib/config";
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { applyTenureAction } from '@/lib/services/tenure-service';

type Update = {
  tag: string;
  tenure_days: number;
  clanTag?: string | null;
  player_name?: string | null;
  as_of?: string | null;
  reason?: string | null;
};
const TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/;

function ymdUTC(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const { json } = createApiContext(req, '/api/tenure/save');
  try {
    const body = await req.json().catch(() => ({}));
    const Schema = z.object({
      updates: z.array(
        z.object({
          tag: z.string(),
          tenure_days: z.number(),
          clanTag: z.string().optional(),
          player_name: z.string().optional(),
          as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          reason: z.string().optional(),
        }),
      ),
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return json({ success: false, error: "No updates" }, { status: 400 });
    const updates: Update[] = parsed.data.updates;

    const invalid: string[] = [];
    const cleaned = updates.map((u) => {
      const tag = String(u.tag || "").trim().toUpperCase();
      const base = Math.max(0, Math.min(20000, Math.round(Number(u.tenure_days))));
      if (!TAG_RE.test(tag)) invalid.push(tag || "(empty)");
      const asOf = u.as_of || ymdUTC();
      return {
        tag,
        base,
        clanTag: u.clanTag ?? cfg.homeClanTag ?? null,
        playerName: u.player_name ?? null,
        asOf,
        reason: u.reason ?? 'Manual tenure override',
      };
    });
    if (invalid.length) return json({ success: false, error: `Invalid tag(s): ${invalid.join(", ")}` }, { status: 400 });

    const results = [];
    for (const c of cleaned) {
      const result = await applyTenureAction({
        clanTag: c.clanTag,
        playerTag: c.tag,
        playerName: c.playerName ?? null,
        baseDays: c.base,
        asOf: c.asOf,
        reason: c.reason,
      });
      results.push({
        tag: result.playerTag,
        clanTag: result.clanTag,
        tenureDays: result.tenureDays,
        asOf: result.asOf,
        action: result.action,
      });
    }

    return json({
      success: true,
      data: {
        count: results.length,
        updates: results,
      },
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Save failed" }, { status: 500 });
  }
}
