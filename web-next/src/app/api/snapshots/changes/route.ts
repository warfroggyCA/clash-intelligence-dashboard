// web-next/src/app/api/snapshots/changes/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAllChangeSummaries, loadChangeSummary } from "@/lib/snapshots";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { z } from "zod";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";
import { cached } from "@/lib/cache";

// Simple in-memory cache for change summaries (resets on server restart)
const changeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

export async function GET(req: NextRequest) {
  const { logger, json } = createApiContext(req, '/api/snapshots/changes');
  try {
    const url = new URL(req.url);
    const Schema = z.object({
      clanTag: z.string(),
      date: z.string().optional(),
    });
    const parsed = Schema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    const date = parsed.data.date;
    
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    // inbound rate limit per ip
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `snapshots:changes:${clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        }
      });
    }

    if (date) {
      // Get specific date's changes
      const changeSummary = await cached(['changes','by-date', clanTag, date], () => loadChangeSummary(clanTag, date), 10);
      const res = json({ success: true, data: changeSummary }, { headers: { 'Cache-Control': 'private, max-age=30' } });
      logger.info('Served changes by date', { clanTag, date, has: Boolean(changeSummary) });
      return res;
    } else {
      // Get all changes for the clan with caching
      const cacheKey = `changes_${clanTag}`;
      const cached = changeCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        const res = json({ success: true, data: cached.data }, { headers: { 'Cache-Control': 'private, max-age=30' } });
        logger.info('Served changes (cache)', { clanTag, count: cached.data?.length || 0 });
        return res;
      }
      
      const allChanges = await getAllChangeSummaries(clanTag);
      changeCache.set(cacheKey, { data: allChanges, timestamp: now });
      
      const res = json({ success: true, data: allChanges }, { headers: { 'Cache-Control': 'private, max-age=30' } });
      logger.info('Served changes (fresh)', { clanTag, count: allChanges.length });
      return res;
    }
  } catch (error: any) {
    console.error('Error fetching changes:', error);
    return json({ success: false, error: error.message || 'Failed to fetch changes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { json } = createApiContext(req, '/api/snapshots/changes');
  try {
    const body = await req.json();
    
    // Handle saving AI summaries
    if (body.action === 'save' && body.changeSummary) {
      const { saveChangeSummary } = await import('@/lib/snapshots');
      await saveChangeSummary(body.changeSummary);
      
      return json({ success: true, message: "Insights summary saved successfully" });
    }
    
    // Handle existing read/actioned actions
    const { clanTag, date, action } = body;
    
    if (!clanTag || !date || !action) {
      return json({ success: false, error: "clanTag, date, and action are required" }, { status: 400 });
    }

    if (!['read', 'actioned'].includes(action)) {
      return json({ success: false, error: "Action must be 'read' or 'actioned'" }, { status: 400 });
    }

    // Load the change summary
    const changeSummary = await loadChangeSummary(clanTag, date);
    
    if (!changeSummary) {
      return json({ success: false, error: "Change summary not found" }, { status: 404 });
    }

    // Update the status
    if (action === 'read') {
      changeSummary.unread = false;
    } else if (action === 'actioned') {
      changeSummary.actioned = true;
      changeSummary.unread = false;
    }

    // Save the updated summary
    const { saveChangeSummary } = await import('@/lib/snapshots');
    await saveChangeSummary(changeSummary);

    // Invalidate cache for this clan
    const cacheKey = `changes_${clanTag}`;
    changeCache.delete(cacheKey);

    return json({ success: true, data: changeSummary });
  } catch (error: any) {
    console.error('Error updating changes:', error);
    return json({ success: false, error: error.message || 'Failed to update changes' }, { status: 500 });
  }
}
