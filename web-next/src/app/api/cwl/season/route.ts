"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';

const BodySchema = z.object({
  seasonId: z.string().optional(),
  warSize: z.number().optional(),
  seasonLabel: z.string().optional(),
  lock: z.boolean().optional(),
});

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const clanTag = normalizeTag(searchParams.get('clanTag') || cfg.homeClanTag || '');
  const seasonId = searchParams.get('seasonId') || getDefaultCwlSeasonId();
  const warSize = Number(searchParams.get('warSize') || 15);
  const fallbackLabel = `CWL ${seasonId}`;

  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from('cwl_seasons')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) {
      const data = {
        ...existing,
        season_label: existing.season_label ?? fallbackLabel,
      };
      return NextResponse.json({ success: true, data });
    }
    const { data: inserted, error: insertError } = await supabase
      .from('cwl_seasons')
      .insert({ clan_tag: clanTag, season_id: seasonId, war_size: warSize, season_label: fallbackLabel })
      .select('*')
      .maybeSingle();
    if (insertError) throw insertError;
    return NextResponse.json({ success: true, data: inserted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to load season' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const body = parsed.data;
  const clanTag = normalizeTag(cfg.homeClanTag || '');
  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid home clan tag' }, { status: 400 });
  }
  const seasonId = body.seasonId || getDefaultCwlSeasonId();
  const warSize = body.warSize || 15;
  const seasonLabel = (body.seasonLabel || `CWL ${seasonId}`).trim();
  const lock = body.lock;

  try {
    const payload: Record<string, unknown> = {
      clan_tag: clanTag,
      season_id: seasonId,
      war_size: warSize,
      season_label: seasonLabel,
    };
    if (typeof lock === 'boolean') {
      payload.locked_at = lock ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase
      .from('cwl_seasons')
      .upsert(
        payload,
        { onConflict: 'clan_tag,season_id' },
      )
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save season' }, { status: 500 });
  }
}
