// web-next/src/app/api/ai/batch-results/route.ts
// API endpoint for retrieving automated insights bundles

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLatestInsightsBundle, getInsightsBundleByDate } from '@/lib/insights-storage';
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai/batch-results');
  try {
    const { searchParams } = new URL(request.url);
    const Schema = z.object({ clanTag: z.string(), date: z.string().optional() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }
    const { clanTag, date } = parsed.data;

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `ai:batch-results:${clanTag}:${ip}`;
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

    let results;
    if (date) {
      results = await cached(['ai','batch-results', clanTag, date], () => getInsightsBundleByDate(clanTag, date), 10);
    } else {
      results = await cached(['ai','batch-results','latest', clanTag], () => getLatestInsightsBundle(clanTag), 10);
    }

    if (!results) {
      return json({ success: false, error: 'No insights bundle found' }, { status: 404 });
    }

    return json({ success: true, data: results });

  } catch (error: any) {
    console.error('[API] Error fetching insights bundle:', error);
    return json({ success: false, error: error.message || 'Failed to fetch insights bundle' }, { status: 500 });
  }
}
