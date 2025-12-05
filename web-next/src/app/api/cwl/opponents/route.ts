"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

const BodySchema = z.object({
  seasonId: z.string().optional(),
  warSize: z.number().optional(),
  opponents: z.array(z.object({
    dayIndex: z.number().int().min(1).max(7),
    opponentTag: z.string(),
    opponentName: z.string().optional().nullable(),
    thDistribution: z.record(z.string(), z.number()).optional().nullable(),
    rosterSnapshot: z.any().optional().nullable(),
    fetchedAt: z.string().optional().nullable(),
  })),
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
    .insert({
      clan_tag: clanTag,
      season_id: seasonId,
      war_size: warSize,
    })
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
  const warSize = Number(searchParams.get('warSize') || 15);

  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    const seasonPk = await getOrCreateSeason(supabase, clanTag, seasonId, warSize);
    const { data: rows, error } = await supabase
      .from('cwl_opponents')
      .select('*')
      .eq('cwl_season_id', seasonPk)
      .order('day_index', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to load opponents' }, { status: 500 });
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
    const payload = body.opponents.map((o) => ({
      cwl_season_id: seasonPk,
      day_index: o.dayIndex,
      opponent_tag: normalizeTag(o.opponentTag),
      opponent_name: o.opponentName ?? null,
      th_distribution: o.thDistribution ?? null,
      roster_snapshot: o.rosterSnapshot ?? null,
      fetched_at: o.fetchedAt ?? null,
    }));
    const { error } = await supabase
      .from('cwl_opponents')
      .upsert(payload, { onConflict: 'cwl_season_id,day_index' });
    if (error) throw error;

    const { data: rows, error: fetchError } = await supabase
      .from('cwl_opponents')
      .select('*')
      .eq('cwl_season_id', seasonPk)
      .order('day_index', { ascending: true });
    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save opponents' }, { status: 500 });
  }
}
