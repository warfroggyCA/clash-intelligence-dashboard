// web-next/src/app/api/full-snapshots/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { 
  loadFullSnapshot, 
  getLatestFullSnapshot, 
  getAvailableSnapshotDates 
} from "@/lib/full-snapshot";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { z } from "zod";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export async function GET(req: NextRequest) {
  const { logger, json } = createApiContext(req, '/api/full-snapshots');
  try {
    const url = new URL(req.url);
    const Schema = z.object({
      clanTag: z.string(),
      date: z.string().optional(),
      latest: z.string().optional(),
    });
    const parsed = Schema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    const date = parsed.data.date;
    const latest = parsed.data.latest === 'true';
    
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    // Inbound rate limit per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const key = `full-snapshots:${clanTag}:${ip}`;
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

    if (latest) {
      // Get the most recent snapshot
      const snapshot = await getLatestFullSnapshot(clanTag);
      if (!snapshot) {
        return json({ success: false, error: 'No snapshots found for this clan' }, { status: 404 });
      }
      
      const res = json({ success: true, data: snapshot }, { 
        headers: { 'Cache-Control': 'private, max-age=60' } 
      });
      logger.info('Served latest full snapshot', { clanTag, date: snapshot.fetchedAt });
      return res;
    } else if (date) {
      // Get specific date's snapshot
      const snapshot = await loadFullSnapshot(clanTag, date);
      if (!snapshot) {
        return json({ success: false, error: 'Snapshot not found for this date' }, { status: 404 });
      }
      
      const res = json({ success: true, data: snapshot }, { 
        headers: { 'Cache-Control': 'private, max-age=300' } 
      });
      logger.info('Served full snapshot by date', { clanTag, date });
      return res;
    } else {
      // Get all available dates
      const dates = await getAvailableSnapshotDates(clanTag);
      
      const res = json({ success: true, data: { dates } }, { 
        headers: { 'Cache-Control': 'private, max-age=60' } 
      });
      logger.info('Served available snapshot dates', { clanTag, count: dates.length });
      return res;
    }
  } catch (error: any) {
    console.error('Error fetching full snapshots:', error);
    return json({ success: false, error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
  }
}
