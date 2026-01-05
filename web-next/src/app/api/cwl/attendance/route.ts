import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';
import { isWarEnded } from '@/lib/cwl-war-state';
import { syncCwlAttendanceRollups } from '@/lib/cwl-attendance';

/**
 * GET /api/cwl/attendance
 *
 * Returns SSOT attendance rollups for lineup planning.
 *
 * Query params:
 * - clanTag: Our clan tag (defaults to homeClanTag)
 * - seasonId: CWL season ID (defaults to current)
 * - dayIndex: Target planning day (1-7). If omitted, uses next day after last completed war.
 * - refresh: If true, re-sync rollups before returning
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/attendance');
  const { searchParams } = new URL(request.url);

  const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag || '';
  const seasonId = searchParams.get('seasonId') || getDefaultCwlSeasonId();
  const dayIndexParam = searchParams.get('dayIndex');
  const refresh = searchParams.get('refresh') === 'true';

  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag || !isValidTag(clanTag)) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  if (!seasonId) {
    return json({ success: false, error: 'seasonId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: season } = await supabase
      .from('cwl_seasons')
      .select('id')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (!season?.id) {
      return json({ success: true, data: null });
    }

    let targetDayIndex = dayIndexParam ? parseInt(dayIndexParam, 10) : null;

    if (!targetDayIndex || targetDayIndex < 1 || targetDayIndex > 7) {
      const { data: dayResults } = await supabase
        .from('cwl_day_results')
        .select('day_index, war_state')
        .eq('cwl_season_id', season.id);
      const completedDays = (dayResults || [])
        .filter((row) => isWarEnded(row.war_state))
        .map((row) => Number(row.day_index))
        .filter((day) => Number.isFinite(day));
      const lastCompleted = completedDays.length ? Math.max(...completedDays) : 0;
      targetDayIndex = Math.min(Math.max(lastCompleted + 1, 1), 7);
    }

    if (refresh) {
      await syncCwlAttendanceRollups({ supabase, seasonId: season.id });
    }

    let { data: rollups } = await supabase
      .from('cwl_attendance_rollups')
      .select('*')
      .eq('cwl_season_id', season.id)
      .eq('day_index', targetDayIndex)
      .order('player_tag', { ascending: true });

    if (!rollups || rollups.length === 0) {
      await syncCwlAttendanceRollups({ supabase, seasonId: season.id });
      const { data: refreshed } = await supabase
        .from('cwl_attendance_rollups')
        .select('*')
        .eq('cwl_season_id', season.id)
        .eq('day_index', targetDayIndex)
        .order('player_tag', { ascending: true });
      rollups = refreshed || [];
    }

    const priorDays = Array.from({ length: Math.max(targetDayIndex - 1, 0) }, (_, i) => i + 1);

    const { data: activityRows } = priorDays.length
      ? await supabase
          .from('cwl_player_day_activity')
          .select('day_index, player_tag, attacks_available, attacks_performed, missed_attacks')
          .eq('cwl_season_id', season.id)
          .eq('is_our_clan', true)
          .in('day_index', priorDays)
      : { data: [] };

    const daysWithDataSet = new Set<number>();
    const missedByTag = new Map<string, Array<{ day: number; missed: number; slots: number }>>();

    for (const row of activityRows || []) {
      const dayIndex = Number(row.day_index);
      if (!Number.isFinite(dayIndex)) continue;
      daysWithDataSet.add(dayIndex);
      const tag = normalizeTag(row.player_tag || '');
      if (!tag) continue;
      const missed = Number(row.missed_attacks || 0);
      const slots = Number(row.attacks_available || 0);
      if (!missedByTag.has(tag)) missedByTag.set(tag, []);
      if (slots > 0 && missed > 0) {
        missedByTag.get(tag)!.push({ day: dayIndex, missed, slots });
      }
    }

    const daysWithData = Array.from(daysWithDataSet).sort((a, b) => a - b);
    const missingDays = priorDays.filter((day) => !daysWithDataSet.has(day));

    const players = (rollups || []).map((row) => ({
      tag: row.player_tag,
      name: row.player_name,
      townHall: row.town_hall,
      totalDays: row.total_days,
      daysWithData: row.days_with_data,
      attacksAvailable: row.attacks_available,
      attacksPerformed: row.attacks_performed,
      missedAttacks: row.missed_attacks,
      participationRate: row.participation_rate,
      status: row.status,
      lastAttackDay: row.last_attack_day,
      lastMissedDay: row.last_missed_day,
      missedByDay: missedByTag.get(normalizeTag(row.player_tag || '')) || [],
      updatedAt: row.updated_at || row.computed_at || null,
    }));

    const noShows = players
      .filter((p) => p.attacksAvailable > 0 && p.attacksPerformed === 0)
      .sort((a, b) => b.attacksAvailable - a.attacksAvailable);

    const missedAttacks = players
      .filter((p) => p.missedAttacks > 0 && p.attacksPerformed > 0)
      .sort((a, b) => b.missedAttacks - a.missedAttacks);

    const updatedAt = players
      .map((p) => p.updatedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

    return json({
      success: true,
      data: {
        clanTag,
        seasonId,
        targetDayIndex,
        priorDays,
        daysWithData,
        missingDays,
        updatedAt,
        players,
        noShows,
        missedAttacks,
      },
    });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Failed to load attendance rollups' }, { status: 500 });
  }
}
