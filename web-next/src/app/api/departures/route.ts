import { NextRequest, NextResponse } from 'next/server';
import { readDepartures, addDeparture, getActiveDepartures, checkForRejoins, markDepartureResolved } from '../../../lib/departures';
import { z } from 'zod';
import { normalizeTag, isValidTag } from '@/lib/tags';
import type { ApiResponse } from '@/types';
import { createRequestLogger } from '@/lib/logger';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';

// GET /api/departures?clanTag=#TAG
export async function GET(request: NextRequest) {
  try {
    const logger = createRequestLogger(request, { route: '/api/departures' });
    const { searchParams } = new URL(request.url);
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    
    if (!clanTag || !isValidTag(clanTag)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `departures:list:${clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Too many requests' } satisfies ApiResponse), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        }
      });
    }
    
    const departures = await readDepartures(clanTag);
    
    return NextResponse.json<ApiResponse>({ success: true, data: departures }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error: any) {
    console.error('Error reading departures:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

// POST /api/departures
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const Schema = z.object({
      clanTag: z.string(),
      action: z.enum(['add', 'resolve', 'clear_all']),
      departure: z
        .object({
          memberTag: z.string(),
          memberName: z.string().optional(),
          departureDate: z.string().optional(),
          departureReason: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { clanTag: rawTag, departure, action } = parsed.data;
    const clanTag = normalizeTag(rawTag);
    if (!isValidTag(clanTag)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }
    
    if (action === 'add' && departure) {
      await addDeparture(clanTag, departure);
      return NextResponse.json<ApiResponse>({ success: true });
    }
    
    if (action === 'resolve' && departure?.memberTag) {
      await markDepartureResolved(clanTag, departure.memberTag);
      return NextResponse.json<ApiResponse>({ success: true });
    }
    
    if (action === 'clear_all') {
      // Clear all departures for this clan
      const { writeDepartures } = await import('../../../lib/departures');
      await writeDepartures(clanTag, []);
      return NextResponse.json<ApiResponse>({ success: true });
    }
    
    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing departures:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
