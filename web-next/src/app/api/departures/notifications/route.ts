import { NextRequest, NextResponse } from 'next/server';
import { checkForRejoins, getActiveDepartures } from '../../../../lib/departures';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';
import { cached } from '@/lib/cache';
import type { ApiResponse } from '@/types';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/departures/notifications?clanTag=#TAG
export async function GET(request: NextRequest) {
  const { logger, json } = createApiContext(request, '/api/departures/notifications');
  try {
    const { searchParams } = new URL(request.url);
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    // Rate limit (burst protection)
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `departures:notifications:${clanTag}:${ip}`;
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
    
    // Get current members from the roster API
    const rosterResponse = await cached(['departures','notifications','roster', clanTag], () => fetch(`${request.nextUrl.origin}/api/roster?mode=live&clanTag=${encodeURIComponent(clanTag)}`), 10);
    const rosterJson = await rosterResponse.json();
    const rosterData = rosterJson?.data ?? rosterJson;
    
    if (!rosterData?.members) {
      return json({ success: false, error: 'Failed to fetch current members' }, { status: 500 });
    }
    
    const currentMembers = rosterData.members.map((m: any) => ({
      tag: m.tag,
      name: m.name
    }));
    
    // Check for rejoins
    const rejoins = await checkForRejoins(clanTag, currentMembers);
    
    // Get active departures
    const activeDepartures = await getActiveDepartures(clanTag, currentMembers);
    
    const res = json({
      success: true,
      data: {
        rejoins,
        activeDepartures,
        hasNotifications: rejoins.length > 0 || activeDepartures.length > 0
      }
    });
    logger.info('Served departure notifications', { clanTag, rejoins: rejoins.length, active: activeDepartures.length });
    return res;
  } catch (error: any) {
    console.error('Error checking departure notifications:', error);
    return json({ success: false, error: error.message || 'Internal server error', message: process.env.NODE_ENV === 'development' ? error?.stack : undefined }, { status: 500 });
  }
}
