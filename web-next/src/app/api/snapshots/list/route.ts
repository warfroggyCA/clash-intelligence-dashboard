import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeTag, isValidTag, safeTagForFilename } from '@/lib/tags';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { cached } from '@/lib/cache';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/snapshots/list?clanTag=#TAG
export async function GET(request: NextRequest) {
  const { logger, json } = createApiContext(request, '/api/snapshots/list');
  try {
    const { searchParams } = new URL(request.url);
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag);
    
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    // Basic inbound rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `snapshots:list:${clanTag}:${ip}`;
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
    
    const safeTag = safeTagForFilename(clanTag);
    
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    try {
      // Try new table first
      const { data: snapshots, error } = await supabase!
        .from('clan_snapshots')
        .select('snapshot_date, fetched_at, metadata, clan, member_summaries')
        .eq('clan_tag', safeTag)
        .order('snapshot_date', { ascending: false });

      let formattedSnapshots: any[] = [];

      if (error) {
        // New table doesn't exist or has no data, will fallback to legacy
      } else {
        formattedSnapshots = snapshots?.map((snapshot: any) => ({
          date: snapshot.snapshot_date,
          memberCount: snapshot.metadata?.memberCount ?? snapshot.member_summaries?.length ?? null,
          clanName: snapshot.clan?.name || null,
          timestamp: snapshot.fetched_at,
        })) || [];
      }

      // Fallback to legacy table if no new snapshots are found
      if (!formattedSnapshots.length) {
        const { data: legacySnapshots, error: legacyError } = await supabase!
          .from('snapshots')
          .select('*')
          .eq('clan_tag', safeTag)
          .order('timestamp', { ascending: false });
        if (legacyError) {
          console.error('Legacy database query error:', legacyError);
        } else {
          formattedSnapshots = legacySnapshots?.map((snapshot: any) => ({
            date: snapshot.date,
            memberCount: snapshot.member_count,
            clanName: snapshot.clan_name,
            timestamp: snapshot.timestamp,
            url: snapshot.file_url,
            filename: snapshot.filename
          })) || [];
        }
      }

      // Deduplicate by date using Map to ensure we keep the most recent for each date
      const dateMap = new Map();
      formattedSnapshots.forEach((snapshot: any) => {
        if (!snapshot?.date) return;
        if (!dateMap.has(snapshot.date)) {
          dateMap.set(snapshot.date, snapshot);
        }
      });
      const uniqueSnapshots = Array.from(dateMap.values());

      const res = json({ success: true, data: uniqueSnapshots }, { headers: { 'Cache-Control': 'private, max-age=60' } });
      logger.info('Served snapshot list', { clanTag, count: uniqueSnapshots.length });
      return res;
    } catch (error) {
      console.error('Error querying snapshots:', error);
      return json({ success: true, data: [] });
    }
  } catch (error: any) {
    console.error('Error listing snapshots:', error);
    return json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
