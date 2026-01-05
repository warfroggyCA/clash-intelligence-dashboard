import { normalizeTag, isValidTag } from './tags';

export type AttendanceSyncResult = {
  dayIndex: number;
  rowCount: number;
};

export async function syncCwlAttendanceForDay(options: {
  supabase: any;
  seasonId: string;
  dayIndex: number;
  warTag?: string | null;
}): Promise<AttendanceSyncResult> {
  const { supabase, seasonId, dayIndex, warTag } = options;
  const { data: attacks, error } = await supabase
    .from('cwl_attack_results')
    .select('attacker_tag, attacker_name, attacker_th, attacker_map_position, attack_performed')
    .eq('cwl_season_id', seasonId)
    .eq('day_index', dayIndex)
    .eq('is_our_attack', true);

  if (error) {
    throw new Error(error.message || 'Failed to load attack results');
  }

  const byTag = new Map<string, {
    tag: string;
    name: string | null;
    townHall: number | null;
    mapPosition: number | null;
    attacksAvailable: number;
    attacksPerformed: number;
  }>();

  for (const row of attacks || []) {
    const tag = normalizeTag(row.attacker_tag || '');
    if (!tag || !isValidTag(tag)) continue;
    if (!byTag.has(tag)) {
      byTag.set(tag, {
        tag,
        name: row.attacker_name || null,
        townHall: Number.isFinite(row.attacker_th) ? row.attacker_th : null,
        mapPosition: Number.isFinite(row.attacker_map_position) ? row.attacker_map_position : null,
        attacksAvailable: 0,
        attacksPerformed: 0,
      });
    }
    const entry = byTag.get(tag)!;
    entry.attacksAvailable += 1;
    if (row.attack_performed) {
      entry.attacksPerformed += 1;
    }
    if (!entry.name && row.attacker_name) entry.name = row.attacker_name;
    if (entry.townHall == null && Number.isFinite(row.attacker_th)) entry.townHall = row.attacker_th;
    if (entry.mapPosition == null && Number.isFinite(row.attacker_map_position)) entry.mapPosition = row.attacker_map_position;
  }

  const computedAt = new Date().toISOString();
  const activityRows = Array.from(byTag.values()).map((entry) => ({
    cwl_season_id: seasonId,
    day_index: dayIndex,
    player_tag: entry.tag,
    player_name: entry.name,
    town_hall: entry.townHall,
    map_position: entry.mapPosition,
    attacks_available: entry.attacksAvailable,
    attacks_performed: entry.attacksPerformed,
    missed_attacks: Math.max(0, entry.attacksAvailable - entry.attacksPerformed),
    is_our_clan: true,
    war_tag: warTag || null,
    computed_at: computedAt,
    updated_at: computedAt,
  }));

  if (activityRows.length) {
    const { error: upsertError } = await supabase
      .from('cwl_player_day_activity')
      .upsert(activityRows, {
        onConflict: 'cwl_season_id,day_index,player_tag,is_our_clan',
      });

    if (upsertError) {
      throw new Error(upsertError.message || 'Failed to upsert attendance ledger');
    }
  }

  return { dayIndex, rowCount: activityRows.length };
}

export async function syncCwlAttendanceRollups(options: {
  supabase: any;
  seasonId: string;
  maxDay?: number;
}): Promise<{ rowCount: number }> {
  const { supabase, seasonId } = options;
  const maxDay = options.maxDay ?? 7;

  const [{ data: eligibleRows, error: eligibleError }, { data: activityRows, error: activityError }] = await Promise.all([
    supabase
      .from('cwl_eligible_members')
      .select('player_tag, player_name, town_hall')
      .eq('cwl_season_id', seasonId),
    supabase
      .from('cwl_player_day_activity')
      .select('day_index, player_tag, player_name, town_hall, attacks_available, attacks_performed, missed_attacks')
      .eq('cwl_season_id', seasonId)
      .eq('is_our_clan', true),
  ]);

  if (eligibleError) {
    throw new Error(eligibleError.message || 'Failed to load CWL roster');
  }
  if (activityError) {
    throw new Error(activityError.message || 'Failed to load attendance ledger');
  }

  const tagSet = new Set<string>();
  const nameByTag = new Map<string, string | null>();
  const thByTag = new Map<string, number | null>();

  for (const row of eligibleRows || []) {
    const tag = normalizeTag(row.player_tag || '');
    if (!tag || !isValidTag(tag)) continue;
    tagSet.add(tag);
    if (!nameByTag.has(tag)) nameByTag.set(tag, row.player_name || null);
    if (!thByTag.has(tag)) thByTag.set(tag, Number.isFinite(row.town_hall) ? row.town_hall : null);
  }

  const activityByTag = new Map<string, Map<number, any>>();
  for (const row of activityRows || []) {
    const tag = normalizeTag(row.player_tag || '');
    if (!tag || !isValidTag(tag)) continue;
    tagSet.add(tag);
    if (!activityByTag.has(tag)) activityByTag.set(tag, new Map());
    activityByTag.get(tag)!.set(Number(row.day_index), row);
    if (!nameByTag.has(tag)) nameByTag.set(tag, row.player_name || null);
    if (!thByTag.has(tag)) thByTag.set(tag, Number.isFinite(row.town_hall) ? row.town_hall : null);
  }

  const rollupRows: any[] = [];
  const computedAt = new Date().toISOString();
  const dayCap = Math.min(7, Math.max(1, maxDay));

  for (let targetDay = 1; targetDay <= dayCap; targetDay += 1) {
    const priorDays = Array.from({ length: targetDay - 1 }, (_, i) => i + 1);
    const totalDays = priorDays.length;

    for (const tag of tagSet) {
      const dayMap = activityByTag.get(tag) || new Map();
      let attacksAvailable = 0;
      let attacksPerformed = 0;
      let missedAttacks = 0;
      let daysWithData = 0;
      let lastAttackDay: number | null = null;
      let lastMissedDay: number | null = null;

      for (const dayIndex of priorDays) {
        const row = dayMap.get(dayIndex);
        if (!row) continue;
        const available = Number(row.attacks_available || 0);
        const performed = Number(row.attacks_performed || 0);
        const missed = Number(row.missed_attacks || 0);
        if (available > 0) daysWithData += 1;
        attacksAvailable += available;
        attacksPerformed += performed;
        missedAttacks += missed;
        if (performed > 0) lastAttackDay = dayIndex;
        if (missed > 0) lastMissedDay = dayIndex;
      }

      let status = 'unknown';
      if (attacksAvailable > 0 && attacksPerformed === 0) {
        status = 'no_show';
      } else if (missedAttacks > 0) {
        status = 'risk';
      } else if (attacksPerformed > 0) {
        status = 'reliable';
      }

      const participationRate = attacksAvailable > 0
        ? Number((attacksPerformed / attacksAvailable).toFixed(4))
        : null;

      rollupRows.push({
        cwl_season_id: seasonId,
        day_index: targetDay,
        player_tag: tag,
        player_name: nameByTag.get(tag) || null,
        town_hall: thByTag.get(tag) ?? null,
        total_days: totalDays,
        days_with_data: daysWithData,
        attacks_available: attacksAvailable,
        attacks_performed: attacksPerformed,
        missed_attacks: missedAttacks,
        participation_rate: participationRate,
        status,
        last_attack_day: lastAttackDay,
        last_missed_day: lastMissedDay,
        computed_at: computedAt,
        updated_at: computedAt,
      });
    }
  }

  if (rollupRows.length) {
    const { error: upsertError } = await supabase
      .from('cwl_attendance_rollups')
      .upsert(rollupRows, { onConflict: 'cwl_season_id,day_index,player_tag' });

    if (upsertError) {
      throw new Error(upsertError.message || 'Failed to upsert attendance rollups');
    }
  }

  return { rowCount: rollupRows.length };
}
