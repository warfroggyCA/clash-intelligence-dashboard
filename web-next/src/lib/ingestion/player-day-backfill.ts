import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '../supabase-server';
import { generatePlayerDayRow, type CanonicalPlayerState } from '../player-day';

interface CanonicalSnapshot {
  player_tag: string;
  clan_tag: string;
  snapshot_date: string;
  payload: any;
}

export interface PlayerDayBackfillOptions {
  /**
   * Optional Supabase client. When omitted the service role client is used.
   */
  supabase?: SupabaseClient;
  /**
   * Optional clan tag filter to limit the backfill scope.
   */
  clanTag?: string;
  /**
   * Optional callback fired after each player is processed – useful for logging.
   */
  onPlayerProcessed?: (payload: { playerTag: string; snapshots: number; inserted: number; updated: number; skipped: number }) => void;
}

export interface PlayerDayBackfillResult {
  playersProcessed: number;
  snapshotsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  membersWithoutPayload: number;
}

function toCanonicalPlayerState(snapshot: CanonicalSnapshot): CanonicalPlayerState | null {
  const member = snapshot.payload?.member;
  if (!member) {
    return null;
  }

  return {
    date: snapshot.snapshot_date,
    clanTag: snapshot.clan_tag,
    playerTag: snapshot.player_tag,
    th: member.townHallLevel ?? null,
    league: member.ranked?.leagueName ?? member.league?.name ?? null,
    trophies: member.ranked?.trophies ?? member.trophies ?? null,
    donations: member.donations?.given ?? null,
    donationsReceived: member.donations?.received ?? null,
    warStars: member.war?.stars ?? null,
    capitalContrib: member.capitalContributions ?? null,
    legendAttacks: null,
    heroLevels: member.heroLevels ?? null,
    equipmentLevels: member.equipmentLevels ?? null,
    pets: member.pets ?? null,
    superTroopsActive: member.superTroopsActive ?? null,
    achievements: member.achievements ?? null,
    rushPercent: member.rushPercent ?? null,
    expLevel: member.expLevel ?? null,
  };
}

/**
 * Backfills the player_day table using canonical_member_snapshots.
 * Designed so it can be reused by scripts, cron jobs, or manual operations.
 */
export async function backfillPlayerDay(options: PlayerDayBackfillOptions = {}): Promise<PlayerDayBackfillResult> {
  const supabase = options.supabase ?? getSupabaseServerClient();

  let query = supabase
    .from('canonical_member_snapshots')
    .select('player_tag, clan_tag, snapshot_date, payload')
    .order('player_tag')
    .order('snapshot_date');

  if (options.clanTag) {
    query = query.eq('clan_tag', options.clanTag);
  }

  const { data: snapshots, error: fetchError } = await query;
  if (fetchError) {
    throw new Error(`Failed to fetch canonical snapshots: ${fetchError.message}`);
  }

  if (!snapshots || snapshots.length === 0) {
    return {
      playersProcessed: 0,
      snapshotsProcessed: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsSkipped: 0,
      membersWithoutPayload: 0,
    };
  }

  const grouped = new Map<string, CanonicalSnapshot[]>();
  for (const snapshot of snapshots) {
    if (!grouped.has(snapshot.player_tag)) {
      grouped.set(snapshot.player_tag, []);
    }
    grouped.get(snapshot.player_tag)!.push(snapshot);
  }

  const result: PlayerDayBackfillResult = {
    playersProcessed: 0,
    snapshotsProcessed: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    membersWithoutPayload: 0,
  };

  for (const [playerTag, playerSnapshots] of grouped) {
    playerSnapshots.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

    let previousState: CanonicalPlayerState | null = null;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const snapshot of playerSnapshots) {
      result.snapshotsProcessed += 1;

      const currentState = toCanonicalPlayerState(snapshot);
      if (!currentState) {
        result.membersWithoutPayload += 1;
        skipped += 1;
        result.rowsSkipped += 1;
        continue;
      }

      try {
        const dayRow = generatePlayerDayRow(previousState, currentState);

        const { data: existingRow, error: existingError } = await supabase
          .from('player_day')
          .select('date, snapshot_hash')
          .eq('player_tag', dayRow.playerTag)
          .eq('date', dayRow.date)
          .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
          throw existingError;
        }

        if (existingRow?.snapshot_hash === dayRow.snapshotHash) {
          skipped += 1;
          result.rowsSkipped += 1;
          previousState = currentState;
          continue;
        }

        const { error: upsertError } = await supabase
          .from('player_day')
          .upsert(
            {
              player_tag: dayRow.playerTag,
              clan_tag: dayRow.clanTag,
              date: dayRow.date,
              th: dayRow.th,
              league: dayRow.league,
              trophies: dayRow.trophies,
              donations: dayRow.donations,
              donations_rcv: dayRow.donationsReceived,
              war_stars: dayRow.warStars,
              capital_contrib: dayRow.capitalContrib,
              legend_attacks: dayRow.legendAttacks,
              hero_levels: dayRow.heroLevels,
              equipment_levels: dayRow.equipmentLevels,
              pets: dayRow.pets,
              super_troops_active: dayRow.superTroopsActive,
              achievements: dayRow.achievements,
              rush_percent: dayRow.rushPercent,
              exp_level: dayRow.expLevel,
              deltas: dayRow.deltas,
              events: dayRow.events,
              notability: dayRow.notability,
              snapshot_hash: dayRow.snapshotHash,
            },
            { onConflict: 'player_tag,date', ignoreDuplicates: false },
          );

        if (upsertError) {
          throw upsertError;
        }

        if (existingRow) {
          updated += 1;
          result.rowsUpdated += 1;
        } else {
          inserted += 1;
          result.rowsInserted += 1;
        }

        previousState = currentState;
      } catch (error) {
        // If anything fails for this snapshot we skip it but keep processing the rest.
        skipped += 1;
        result.rowsSkipped += 1;
        console.warn('[player-day-backfill] Failed to process snapshot', {
          playerTag,
          snapshotDate: snapshot.snapshot_date,
          error,
        });
      }
    }

    result.playersProcessed += 1;
    options.onPlayerProcessed?.({
      playerTag,
      snapshots: playerSnapshots.length,
      inserted,
      updated,
      skipped,
    });
  }

  return result;
}
