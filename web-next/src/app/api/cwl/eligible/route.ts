"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';
import { getHeroLevelsByTag, hasHeroLevels } from '@/lib/cwl-eligible-heroes';

const BodySchema = z.object({
  seasonId: z.string().optional(),
  warSize: z.number().optional(),
  force: z.boolean().optional(),
  members: z.array(z.object({
    playerTag: z.string(),
    playerName: z.string().optional(),
    townHall: z.number().optional(),
    heroLevels: z.record(z.string(), z.number().nullable()).optional(),
  })),
});

async function getOrCreateSeason(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanTag: string,
  seasonId: string,
  warSize: number,
) {
  const { data: existing, error: selectError } = await supabase
    .from('cwl_seasons')
    .select('id, locked_at')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return existing as { id: string; locked_at: string | null };
  const { data: inserted, error: insertError } = await supabase
    .from('cwl_seasons')
    .insert({ clan_tag: clanTag, season_id: seasonId, war_size: warSize })
    .select('id, locked_at')
    .maybeSingle();
  if (insertError) throw insertError;
  return inserted as { id: string; locked_at: string | null };
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const clanTag = normalizeTag(searchParams.get('clanTag') || cfg.homeClanTag || '');
  const seasonId = searchParams.get('seasonId') || getDefaultCwlSeasonId();
  const warSize = Number(searchParams.get('warSize') || 15);

  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    const season = await getOrCreateSeason(supabase, clanTag, seasonId, warSize);
    const { data: rows, error } = await supabase
      .from('cwl_eligible_members')
      .select('*')
      .eq('cwl_season_id', season.id);
    if (error) throw error;
    let rosterRows = rows ?? [];
    const needsBackfill = rosterRows.some((row) => !hasHeroLevels(row.hero_levels));
    if (needsBackfill) {
      const heroLevelsByTag = await getHeroLevelsByTag(supabase, clanTag);
      let didUpdate = false;
      for (const row of rosterRows) {
        if (hasHeroLevels(row.hero_levels)) continue;
        const tag = normalizeTag(row.player_tag || '');
        const heroLevels = heroLevelsByTag.get(tag);
        if (!hasHeroLevels(heroLevels)) continue;
        const { error: updateError } = await supabase
          .from('cwl_eligible_members')
          .update({ hero_levels: heroLevels })
          .eq('cwl_season_id', season.id)
          .eq('player_tag', row.player_tag);
        if (updateError) {
          throw updateError;
        }
        didUpdate = true;
      }
      if (didUpdate) {
        const { data: refreshed, error: refreshError } = await supabase
          .from('cwl_eligible_members')
          .select('*')
          .eq('cwl_season_id', season.id);
        if (refreshError) throw refreshError;
        rosterRows = refreshed ?? rosterRows;
      }
    }
    return NextResponse.json({ success: true, data: rosterRows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to load eligible members' }, { status: 500 });
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
  const force = body.force === true;

  try {
    const season = await getOrCreateSeason(supabase, clanTag, seasonId, warSize);
    if (season.locked_at && !force) {
      return NextResponse.json(
        { success: false, error: 'CWL roster is locked. Unlock to edit or use force override.' },
        { status: 423 },
      );
    }
    let rows = body.members.map((m) => ({
      cwl_season_id: season.id,
      player_tag: normalizeTag(m.playerTag),
      player_name: m.playerName ?? null,
      town_hall: m.townHall ?? null,
      hero_levels: m.heroLevels ?? null,
    }));
    const needsBackfill = rows.some((row) => !hasHeroLevels(row.hero_levels));
    if (needsBackfill) {
      const heroLevelsByTag = await getHeroLevelsByTag(supabase, clanTag);
      rows = rows.map((row) => {
        if (hasHeroLevels(row.hero_levels)) return row;
        const heroLevels = heroLevelsByTag.get(normalizeTag(row.player_tag));
        if (!hasHeroLevels(heroLevels)) return row;
        return { ...row, hero_levels: heroLevels as Record<string, number | null> | null };
      });
    }
    // replace strategy: delete existing then insert
    await supabase.from('cwl_eligible_members').delete().eq('cwl_season_id', season.id);
    const { error: insertError } = await supabase.from('cwl_eligible_members').insert(rows);
    if (insertError) throw insertError;
    const { data: refreshed } = await supabase
      .from('cwl_eligible_members')
      .select('*')
      .eq('cwl_season_id', season.id);
    return NextResponse.json({ success: true, data: refreshed ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save eligible members' }, { status: 500 });
  }
}
