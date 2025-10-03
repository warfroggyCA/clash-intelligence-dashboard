// web-next/src/app/api/war/pin/route.ts
// Stores and retrieves the pinned opponent for a clan (cross-device persistence).

export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const GetSchema = z.object({ ourClanTag: z.string().min(2) });
const PostSchema = z.object({ 
  ourClanTag: z.string().min(2), 
  opponentTag: z.string().min(2),
  profileData: z.any().optional()
});

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/war/pin');
  try {
    const { searchParams } = new URL(request.url);
    const parsed = GetSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'ourClanTag required' }, { status: 400 });
    }
    const ip = (typeof (request as any).ip === 'string' && (request as any).ip) || 'unknown';
    const limit = await rateLimitAllow(`war:pin:get:${parsed.data.ourClanTag}:${ip}`, { windowMs: 60_000, max: 120 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, { status: 429, headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 120) });
    }
    const our = normalizeTag(parsed.data.ourClanTag);
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('war_prep_pins')
      .select('*')
      .eq('our_clan_tag', our)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[API] War pin GET error:', error);
    return json({ success: false, error: error?.message || 'Failed to get pin' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { json } = createApiContext(request, '/api/war/pin');
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid body' }, { status: 400 });
    }
    const ip = (typeof (request as any).ip === 'string' && (request as any).ip) || 'unknown';
    const limit = await rateLimitAllow(`war:pin:post:${parsed.data.ourClanTag}:${ip}`, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, { status: 429, headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 30) });
    }
    const our = normalizeTag(parsed.data.ourClanTag);
    const opp = normalizeTag(parsed.data.opponentTag);
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('war_prep_pins')
      .upsert({ 
        our_clan_tag: our, 
        opponent_tag: opp,
        profile_data: parsed.data.profileData || null
      }, { onConflict: 'our_clan_tag' })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[API] War pin POST error:', error);
    return json({ success: false, error: error?.message || 'Failed to save pin' }, { status: 500 });
  }
}

