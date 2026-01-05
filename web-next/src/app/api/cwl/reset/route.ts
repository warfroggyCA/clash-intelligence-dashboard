"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';

const BodySchema = z.object({
  seasonId: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const clanTag = normalizeTag(cfg.homeClanTag || '');
  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid home clan tag' }, { status: 400 });
  }

  const seasonId = parsed.data.seasonId || getDefaultCwlSeasonId();

  try {
    const { data: season, error: selectError } = await supabase
      .from('cwl_seasons')
      .select('id')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!season?.id) {
      return NextResponse.json({ success: true, cleared: false });
    }

    const seasonIdPk = season.id as string;
    const tables = [
      'cwl_opponents',
      'cwl_eligible_members',
      'cwl_day_lineups',
      'cwl_day_results',
      'cwl_attack_results',
      'cwl_player_day_activity',
      'cwl_attendance_rollups',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('cwl_season_id', seasonIdPk);
      if (error) throw error;
    }

    await supabase
      .from('cwl_seasons')
      .update({ locked_at: null })
      .eq('id', seasonIdPk);

    return NextResponse.json({ success: true, cleared: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to reset CWL' }, { status: 500 });
  }
}
