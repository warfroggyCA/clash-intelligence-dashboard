import CwlDayPageClientSimple, { type CwlDayInitialData } from './CwlDayPageClientSimple';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';
import { resolveHeroPower } from '@/lib/roster-derivations';
import { normalizeWarState } from '@/lib/cwl-war-state';

async function getCurrentRosterTags(supabase: ReturnType<typeof getSupabaseServerClient>, clanTag: string) {
  try {
    const { data: clanRow } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .maybeSingle();
    if (!clanRow?.id) return new Set<string>();
    const { data: snapshotRow } = await supabase
      .from('roster_snapshots')
      .select('id')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!snapshotRow?.id) return new Set<string>();
    const { data: memberRows } = await supabase
      .from('member_snapshot_stats')
      .select('member_id')
      .eq('snapshot_id', snapshotRow.id);
    const memberIds = memberRows?.map((row) => row.member_id).filter(Boolean) ?? [];
    if (!memberIds.length) return new Set<string>();
    const { data: members } = await supabase
      .from('members')
      .select('tag')
      .in('id', memberIds);
    const tags = new Set<string>();
    for (const row of members || []) {
      if (row?.tag) tags.add(normalizeTag(row.tag));
    }
    return tags;
  } catch {
    return new Set<string>();
  }
}

export default async function CwlDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const dayIndex = Number(day) || 1;
  const clanTag = normalizeTag(cfg.homeClanTag || '');
  const seasonId = getDefaultCwlSeasonId();
  const initialData: CwlDayInitialData = {
    season: {
      seasonId,
      warSize: 15,
      seasonLabel: `CWL ${seasonId}`,
      lockedAt: null,
    },
  };

  if (clanTag && isValidTag(clanTag)) {
    const supabase = getSupabaseServerClient();
    const { data: seasonRow } = await supabase
      .from('cwl_seasons')
      .select('id, season_id, war_size, season_label, locked_at')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (seasonRow?.id) {
      initialData.season = {
        seasonId: seasonRow.season_id || seasonId,
        warSize: seasonRow.war_size ?? 15,
        seasonLabel: seasonRow.season_label ?? `CWL ${seasonId}`,
        lockedAt: seasonRow.locked_at ?? null,
      };

      const seasonPk = seasonRow.id as string;
      const [currentRosterTags, { data: eligibleRows }, { data: opponentRows }, { data: lineupRows }, { data: dayResultRow }] = await Promise.all([
        getCurrentRosterTags(supabase, clanTag),
        supabase
          .from('cwl_eligible_members')
          .select('player_tag, player_name, town_hall, hero_levels')
          .eq('cwl_season_id', seasonPk),
        supabase
          .from('cwl_opponents')
          .select('day_index, opponent_tag, opponent_name, th_distribution, roster_snapshot, fetched_at')
          .eq('cwl_season_id', seasonPk)
          .order('day_index', { ascending: true }),
        supabase
          .from('cwl_day_lineups')
          .select('day_index, our_lineup, opponent_lineup, updated_at')
          .eq('cwl_season_id', seasonPk)
          .eq('day_index', dayIndex)
          .limit(1),
        supabase
          .from('cwl_day_results')
          .select('result, our_stars, opponent_stars, our_destruction_pct, opponent_destruction_pct, war_state, opponent_name')
          .eq('cwl_season_id', seasonPk)
          .eq('day_index', dayIndex)
          .maybeSingle(),
      ]);

      if (eligibleRows?.length) {
        let ghostCount = 0;
        initialData.roster = {
          members: eligibleRows.map((row) => {
            const tag = normalizeTag(row.player_tag);
            const isGhost = currentRosterTags.size > 0 && !currentRosterTags.has(tag);
            if (isGhost) ghostCount += 1;
            return {
              tag,
              name: row.player_name || row.player_tag,
              townHall: row.town_hall ?? null,
              heroPower: resolveHeroPower({ hero_levels: row.hero_levels }),
              heroes: row.hero_levels ?? null,
              isGhost,
              mapPosition: null,
            };
          }),
          ghostCount,
          source: 'cwl',
        };
      }

      if (opponentRows?.length) {
        initialData.opponents = opponentRows.map((row) => ({
          dayIndex: row.day_index,
          clanTag: row.opponent_tag || '',
          clanName: row.opponent_name || '',
          thDistribution: row.th_distribution ?? null,
          rosterSnapshot: row.roster_snapshot ?? null,
          fetchedAt: row.fetched_at ?? null,
          status: row.roster_snapshot ? 'roster_loaded' : 'not_loaded',
        }));
      }

      const lineupRow = lineupRows?.[0];
      if (lineupRow) {
        initialData.lineup = {
          ourLineup: Array.isArray(lineupRow.our_lineup) ? lineupRow.our_lineup : [],
          opponentLineup: Array.isArray(lineupRow.opponent_lineup) ? lineupRow.opponent_lineup : [],
          updatedAt: lineupRow.updated_at ?? null,
        };
      }

      if (dayResultRow) {
        initialData.dayResult = {
          result: dayResultRow.result ?? null,
          ourStars: dayResultRow.our_stars ?? 0,
          opponentStars: dayResultRow.opponent_stars ?? 0,
          ourDestructionPct: dayResultRow.our_destruction_pct ?? 0,
          opponentDestructionPct: dayResultRow.opponent_destruction_pct ?? 0,
          warState: normalizeWarState(dayResultRow.war_state),
          opponentName: dayResultRow.opponent_name ?? null,
        };
      }
    }
  }

  return <CwlDayPageClientSimple day={day} initialData={initialData} />;
}
