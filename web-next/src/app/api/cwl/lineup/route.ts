"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

const BodySchema = z.object({
  seasonId: z.string().optional(),
  warSize: z.number().optional(),
  dayIndex: z.number().int().min(1).max(7),
  ourLineup: z.array(z.string()),
  opponentLineup: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

async function getOrCreateSeason(supabase: ReturnType<typeof getSupabaseAdminClient>, clanTag: string, seasonId: string, warSize: number) {
  const { data: existing, error: selectError } = await supabase
    .from('cwl_seasons')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return existing.id as string;
  const { data: inserted, error: insertError } = await supabase
    .from('cwl_seasons')
    .insert({ clan_tag: clanTag, season_id: seasonId, war_size: warSize })
    .select('id')
    .maybeSingle();
  if (insertError) throw insertError;
  return inserted?.id as string;
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const clanTag = normalizeTag(searchParams.get('clanTag') || cfg.homeClanTag || '');
  const seasonId = searchParams.get('seasonId') || '2025-07';
  const dayIndex = searchParams.get('dayIndex') ? Number(searchParams.get('dayIndex')) : null;
  const warSize = Number(searchParams.get('warSize') || 15);

  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    const seasonPk = await getOrCreateSeason(supabase, clanTag, seasonId, warSize);
    let query = supabase
      .from('cwl_day_lineups')
      .select('*')
      .eq('cwl_season_id', seasonPk);
    if (dayIndex) query = query.eq('day_index', dayIndex);
    const { data: rows, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to load lineups' }, { status: 500 });
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
  const seasonId = body.seasonId || '2025-07';
  const warSize = body.warSize || 15;

  try {
    const seasonPk = await getOrCreateSeason(supabase, clanTag, seasonId, warSize);
    const { error } = await supabase
      .from('cwl_day_lineups')
      .upsert({
        cwl_season_id: seasonPk,
        day_index: body.dayIndex,
        our_lineup: body.ourLineup.map((t) => normalizeTag(t)),
        opponent_lineup: (body.opponentLineup || []).map((t) => normalizeTag(t)),
        notes: body.notes ?? null,
      }, { onConflict: 'cwl_season_id,day_index' });
    if (error) throw error;

    const { data: row } = await supabase
      .from('cwl_day_lineups')
      .select('*')
      .eq('cwl_season_id', seasonPk)
      .eq('day_index', body.dayIndex)
      .maybeSingle();

    return NextResponse.json({ success: true, data: row });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save lineup' }, { status: 500 });
  }
}
