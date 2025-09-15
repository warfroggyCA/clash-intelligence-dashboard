import { NextRequest, NextResponse } from "next/server";
import { getPlayer, extractHeroLevels } from "@/lib/coc";
import { z } from "zod";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { rateLimitAllow, formatRateLimitHeaders } from "@/lib/inbound-rate-limit";
import { rateLimiter } from "@/lib/rate-limiter";
import type { ApiResponse } from "@/types";
import { createApiContext } from "@/lib/api/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const { logger, json } = createApiContext(request, '/api/player/[tag]');
  const Schema = z.object({ tag: z.string() });
  const parsed = Schema.safeParse(params);
  if (!parsed.success || !parsed.data.tag) {
    return json({ success: false, error: "Player tag is required" }, { status: 400 });
  }
  const normalized = normalizeTag(parsed.data.tag);
  if (!isValidTag(normalized)) {
    return json({ success: false, error: "Provide a valid player tag like #XXXXXXX" }, { status: 400 });
  }
  const cleanTag = normalized.slice(1);
  
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `player:get:${normalized}:${ip}`;
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

    await rateLimiter.acquire();
    
    try {
      const playerData = await getPlayer(cleanTag);
      
      // Extract hero levels the same way the roster API does
      const heroes = extractHeroLevels(playerData);
      const processedPlayerData = {
        ...playerData,
        bk: typeof heroes.bk === "number" ? heroes.bk : null,
        aq: typeof heroes.aq === "number" ? heroes.aq : null,
        gw: typeof heroes.gw === "number" ? heroes.gw : null,
        rc: typeof heroes.rc === "number" ? heroes.rc : null,
        mp: typeof heroes.mp === "number" ? heroes.mp : null,
      };
      const res = json({ success: true, data: processedPlayerData });
      logger.info('Served player', { tag: normalized });
      return res;
    } finally {
      rateLimiter.release();
    }
  } catch (error: any) {
    console.error('Error fetching player data:', error);
    
    // Provide more specific error messages
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return json({ success: false, error: `Player with tag #${cleanTag} not found. Please check the tag and try again.` }, { status: 404 });
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return json({ success: false, error: "API access denied. Please check your API key and IP allowlist." }, { status: 403 });
    } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      return json({ success: false, error: "API rate limit exceeded. Please try again in a moment." }, { status: 429 });
    }
    
    return json({ success: false, error: error.message || "Failed to fetch player data" }, { status: 500 });
  }
}
