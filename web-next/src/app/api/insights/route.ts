// web-next/src/app/api/insights/route.ts
// Unified endpoint for retrieving and storing smart insights payloads

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { cached } from '@/lib/cache';
import {
  getLatestSmartInsightsPayload,
  getSmartInsightsPayloadByDate,
  saveSmartInsightsPayloadOnly,
} from '@/lib/insights-storage';
import type { SmartInsightsPayload } from '@/lib/smart-insights';

const CACHE_TTL_SECONDS = 10;

const QuerySchema = z.object({
  clanTag: z.string().min(1, 'clanTag is required'),
  date: z.string().optional(),
  _refresh: z.string().optional(), // Cache-busting parameter (ignored but allows bypass)
  nocache: z.string().optional(), // Force bypass server-side cache
});

const SaveSchema = z.object({
  payload: z
    .object({
      metadata: z.object({
        clanTag: z.string().min(1, 'metadata.clanTag is required'),
        snapshotDate: z.string().min(1, 'metadata.snapshotDate is required'),
        generatedAt: z.string().optional(),
        source: z.string().optional(),
        schemaVersion: z.string().optional(),
        snapshotId: z.string().nullable().optional(),
      }),
    })
    .passthrough(),
});

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/insights');

  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    const { clanTag, date, nocache } = parsed.data;
    const bypassCache = Boolean(nocache || parsed.data._refresh); // Bypass cache if nocache or _refresh param present

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = `insights:${clanTag}:${date ?? 'latest'}:${ip}`;
    const limit = await rateLimitAllow(rateKey, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return json({
        success: false,
        error: 'Too many requests',
      }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        },
      });
    }

    // Bypass cache if nocache or _refresh parameter is present
    const payload = bypassCache
      ? (date
          ? await getSmartInsightsPayloadByDate(clanTag, date)
          : await getLatestSmartInsightsPayload(clanTag))
      : (date
          ? await cached(['insights', clanTag, date], () => getSmartInsightsPayloadByDate(clanTag, date), CACHE_TTL_SECONDS)
          : await cached(['insights', clanTag, 'latest'], () => getLatestSmartInsightsPayload(clanTag), CACHE_TTL_SECONDS));

    if (!payload) {
      return json({ success: false, error: 'No insights payload available' }, { status: 404 });
    }

    return json({
      success: true,
      data: {
        clanTag: payload.metadata?.clanTag ?? clanTag,
        snapshotDate: payload.metadata?.snapshotDate ?? date ?? null,
        smartInsightsPayload: payload,
        payload,
      },
    });
  } catch (error: any) {
    console.error('[API] Error fetching smart insights payload:', error);
    return json({ success: false, error: error?.message ?? 'Failed to fetch smart insights payload' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/insights');

  try {
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${adminKey}`) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const parsed = SaveSchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid payload body' }, { status: 400 });
    }

    const payload = parsed.data.payload as unknown as SmartInsightsPayload;

    const stored = await saveSmartInsightsPayloadOnly(payload);
    if (!stored) {
      return json({ success: false, error: 'Failed to persist smart insights payload' }, { status: 500 });
    }

    return json({
      success: true,
      data: {
        smartInsightsPayload: payload,
        payload,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Error saving smart insights payload:', error);
    return json({ success: false, error: error?.message ?? 'Failed to save smart insights payload' }, { status: 500 });
  }
}
