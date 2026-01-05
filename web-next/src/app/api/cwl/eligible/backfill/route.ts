import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';
import { getHeroLevelsByTag, hasHeroLevels } from '@/lib/cwl-eligible-heroes';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const clanTag = normalizeTag(searchParams.get('clanTag') || cfg.homeClanTag || '');
  const seasonId = searchParams.get('seasonId') || getDefaultCwlSeasonId();
  const warSize = Number(searchParams.get('warSize') || 15);

  if (!clanTag || !isValidTag(clanTag)) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    const { data: season, error: seasonError } = await supabase
      .from('cwl_seasons')
      .select('id')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (seasonError) throw seasonError;
    if (!season?.id) {
      return NextResponse.json({ success: false, error: 'Season not found' }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from('cwl_eligible_members')
      .select('*')
      .eq('cwl_season_id', season.id);
    if (error) throw error;

    const heroLevelsByTag = await getHeroLevelsByTag(supabase, clanTag);

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const row of rows || []) {
      if (hasHeroLevels(row.hero_levels)) {
        skipped += 1;
        continue;
      }
      const tag = normalizeTag(row.player_tag || '');
      const heroLevels = heroLevelsByTag.get(tag);
      if (!hasHeroLevels(heroLevels)) {
        missing += 1;
        continue;
      }
      const { error: updateError } = await supabase
        .from('cwl_eligible_members')
        .update({ hero_levels: heroLevels })
        .eq('cwl_season_id', season.id)
        .eq('player_tag', row.player_tag);
      if (updateError) throw updateError;
      updated += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        seasonId,
        warSize,
        updated,
        skipped,
        missing,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to backfill hero levels' }, { status: 500 });
  }
}
