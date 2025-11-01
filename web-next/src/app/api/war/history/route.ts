// web-next/src/app/api/war/history/route.ts
// Records and retrieves war opponent history

export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const PostSchema = z.object({ 
  ourClanTag: z.string().min(2), 
  opponentTag: z.string().min(2),
  opponentName: z.string().optional()
});

const GetSchema = z.object({ 
  ourClanTag: z.string().min(2),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
});

export async function POST(request: Request) {
  const { json } = createApiContext(request, '/api/war/history');
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid body' }, { status: 400 });
    }
    const ip = (typeof (request as any).ip === 'string' && (request as any).ip) || 'unknown';
    const limit = await rateLimitAllow(`war:history:post:${parsed.data.ourClanTag}:${ip}`, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, { status: 429, headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 30) });
    }
    const our = normalizeTag(parsed.data.ourClanTag);
    const opp = normalizeTag(parsed.data.opponentTag);
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('war_opponent_history')
      .insert({ 
        our_clan_tag: our, 
        opponent_tag: opp,
        opponent_name: parsed.data.opponentName || null
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[API] War history POST error:', error);
    return json({ success: false, error: error?.message || 'Failed to record war history' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/war/history');
  try {
    const { searchParams } = new URL(request.url);
    const parsed = GetSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'ourClanTag required' }, { status: 400 });
    }
    const ip = (typeof (request as any).ip === 'string' && (request as any).ip) || 'unknown';
    const limit = await rateLimitAllow(`war:history:get:${parsed.data.ourClanTag}:${ip}`, { windowMs: 60_000, max: 120 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, { status: 429, headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 120) });
    }
    const our = normalizeTag(parsed.data.ourClanTag);
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('war_opponent_history')
      .select('*')
      .eq('our_clan_tag', our)
      .order('fought_at', { ascending: false })
      .limit(parsed.data.limit);
    if (error) {
      throw new Error(error.message);
    }
    return json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('[API] War history GET error:', error);
    return json({ success: false, error: error?.message || 'Failed to get war history' }, { status: 500 });
  }
}

