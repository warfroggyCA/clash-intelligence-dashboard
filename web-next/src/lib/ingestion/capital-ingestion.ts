// Capital Raid Data Ingestion Pipeline
// Fetches and stores capital raid data from Clash of Clans API

import { getClanCapitalRaidSeasons } from '@/lib/coc';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export interface CapitalIngestionResult {
  success: boolean;
  clanTag: string;
  seasonsIngested: number;
  weekendsIngested: number;
  participantsIngested: number;
  errors?: string[];
}

export interface CapitalIngestionOptions {
  clanTag?: string;
  seasonLimit?: number;
}

/**
 * Ingests capital raid data from Clash of Clans API and stores in Supabase
 */
export async function ingestCapitalData(options: CapitalIngestionOptions = {}): Promise<CapitalIngestionResult> {
  const { clanTag: providedTag, seasonLimit = 10 } = options;
  const clanTag = providedTag || cfg.homeClanTag;
  
  if (!clanTag) {
    throw new Error('No clan tag provided for capital ingestion');
  }

  const normalizedTag = normalizeTag(clanTag);
  if (!normalizedTag) {
    throw new Error(`Invalid clan tag: ${clanTag}`);
  }

  const supabase = getSupabaseAdminClient();
  const errors: string[] = [];
  let seasonsIngested = 0;
  let weekendsIngested = 0;
  let participantsIngested = 0;

  try {
    // Fetch capital raid seasons
    // Note: Ingestion is idempotent - existing records are updated, new ones are inserted
    console.log(`[CapitalIngestion] Fetching capital raid seasons for ${normalizedTag} (limit: ${seasonLimit})`);
    const seasons = await getClanCapitalRaidSeasons(normalizedTag, seasonLimit);
    
    if (!Array.isArray(seasons) || seasons.length === 0) {
      console.log(`[CapitalIngestion] No capital raid seasons found for ${normalizedTag}`);
      return {
        success: true,
        clanTag: normalizedTag,
        seasonsIngested: 0,
        weekendsIngested: 0,
        participantsIngested: 0,
      };
    }

    // Process each season
    for (const seasonEntry of seasons) {
      try {
        const result = await ingestCapitalSeason(seasonEntry, normalizedTag, supabase);
        if (result.seasonIngested) seasonsIngested++;
        weekendsIngested += result.weekendsIngested;
        participantsIngested += result.participantsIngested;
      } catch (error: any) {
        const errorMsg = `Failed to ingest season: ${error?.message || String(error)}`;
        console.error(`[CapitalIngestion] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      clanTag: normalizedTag,
      seasonsIngested,
      weekendsIngested,
      participantsIngested,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error(`[CapitalIngestion] Fatal error:`, error);
    return {
      success: false,
      clanTag: normalizedTag,
      seasonsIngested,
      weekendsIngested,
      participantsIngested,
      errors: [error?.message || String(error)],
    };
  }
}

/**
 * Ingests a single capital raid season
 * Note: API returns "seasons" but these are actually individual raid weekends
 */
async function ingestCapitalSeason(
  seasonEntry: any,
  clanTag: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<{
  seasonIngested: boolean;
  weekendsIngested: number;
  participantsIngested: number;
}> {
  const state = seasonEntry.state || 'ended';
  const startTime = seasonEntry.startTime;
  const endTime = seasonEntry.endTime;
  const seasonId = seasonEntry.id || `${clanTag}-${startTime}`; // Use API id or generate one

  if (!startTime || !endTime) {
    console.warn(`[CapitalIngestion] Skipping season entry without startTime/endTime`);
    return { seasonIngested: false, weekendsIngested: 0, participantsIngested: 0 };
  }

  // Parse ISO 8601 dates - handle formats like "20251107T070000.000Z" (no separators)
  // Convert to standard ISO format: "2025-11-07T07:00:00.000Z"
  const parseDate = (dateStr: string): Date => {
    // If it's already in standard format, use it directly
    if (dateStr.includes('-') && dateStr.includes(':')) {
      return new Date(dateStr);
    }
    // Handle format like "20251107T070000.000Z" - insert separators
    // Format: YYYYMMDDTHHMMSS.000Z -> YYYY-MM-DDTHH:MM:SS.000Z
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d{3})?Z?$/);
    if (match) {
      const [, year, month, day, hour, minute, second, millis = ''] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${millis}Z`);
    }
    // Fallback to standard Date parsing
    return new Date(dateStr);
  };

  const startDate = parseDate(startTime);
  const endDate = parseDate(endTime);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.warn(`[CapitalIngestion] Invalid dates: ${startTime}, ${endTime}`);
    return { seasonIngested: false, weekendsIngested: 0, participantsIngested: 0 };
  }

  // Check if season already exists (idempotent check)
  const { data: existingSeason } = await supabase
    .from('capital_raid_seasons')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();

  let seasonRecordId: string;

  if (existingSeason) {
    // Update existing season
    const { data: updated, error: updateError } = await supabase
      .from('capital_raid_seasons')
      .update({
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        total_raids: seasonEntry.raidsCompleted || null,
        total_loot: seasonEntry.capitalTotalLoot || 0,
        total_destruction: seasonEntry.enemyDistrictsDestroyed || null,
        raw: seasonEntry,
      })
      .eq('id', existingSeason.id)
      .select('id')
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update season: ${updateError?.message || 'Unknown error'}`);
    }

    seasonRecordId = updated.id;
    console.log(`[CapitalIngestion] Updated existing season ${seasonId}`);
  } else {
    // Insert new season
    const { data: inserted, error: insertError } = await supabase
      .from('capital_raid_seasons')
      .insert({
        clan_tag: clanTag,
        season_id: seasonId,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        total_raids: seasonEntry.raidsCompleted || null,
        total_loot: seasonEntry.capitalTotalLoot || 0,
        total_destruction: seasonEntry.enemyDistrictsDestroyed || null,
        raw: seasonEntry,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to insert season: ${insertError?.message || 'Unknown error'}`);
    }

    seasonRecordId = inserted.id;
    console.log(`[CapitalIngestion] Inserted new season ${seasonId}`);
  }

  // Each "season" in the API is actually a weekend, so create a weekend record
  const weekendId = seasonId; // Use same ID
  let weekendsIngested = 0;
  let participantsIngested = 0;

  // Check if weekend already exists
  const { data: existingWeekend } = await supabase
    .from('capital_raid_weekends')
    .select('id')
    .eq('season_id', seasonRecordId)
    .eq('weekend_id', weekendId)
    .maybeSingle();

  let weekendRecordId: string;

  if (existingWeekend) {
    // Update existing weekend
    const { data: updated, error: updateError } = await supabase
      .from('capital_raid_weekends')
      .update({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        state: state,
        enemy_count: seasonEntry.enemyDistrictsDestroyed || null,
        total_loot: seasonEntry.capitalTotalLoot || 0,
        total_destruction: seasonEntry.enemyDistrictsDestroyed || null,
        raw: seasonEntry,
      })
      .eq('id', existingWeekend.id)
      .select('id')
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update weekend: ${updateError?.message || 'Unknown error'}`);
    }

    weekendRecordId = updated.id;
  } else {
    // Insert new weekend
    const { data: inserted, error: insertError } = await supabase
      .from('capital_raid_weekends')
      .insert({
        season_id: seasonRecordId,
        weekend_id: weekendId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        state: state,
        enemy_count: seasonEntry.enemyDistrictsDestroyed || null,
        total_loot: seasonEntry.capitalTotalLoot || 0,
        total_destruction: seasonEntry.enemyDistrictsDestroyed || null,
        raw: seasonEntry,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to insert weekend: ${insertError?.message || 'Unknown error'}`);
    }

    weekendRecordId = inserted.id;
    weekendsIngested = 1;
  }

  // Process participants (members)
  if (Array.isArray(seasonEntry.members)) {
    console.log(`[CapitalIngestion] Processing ${seasonEntry.members.length} participants for weekend ${weekendId}`);
    for (const member of seasonEntry.members) {
      try {
        await ingestCapitalParticipant(weekendRecordId, member, supabase);
        participantsIngested++;
      } catch (error: any) {
        console.warn(`[CapitalIngestion] Failed to ingest participant ${member.tag}:`, error?.message);
        // Continue with other participants
      }
    }
  } else {
    console.warn(`[CapitalIngestion] No members array found for weekend ${weekendId}, members:`, seasonEntry.members);
  }

  return {
    seasonIngested: !existingSeason,
    weekendsIngested,
    participantsIngested,
  };
}

/**
 * Ingests a capital raid participant record
 */
async function ingestCapitalParticipant(
  weekendId: string,
  memberData: any,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<void> {
  const playerTag = memberData.tag;
  if (!playerTag) {
    console.warn(`[CapitalIngestion] Skipping participant without tag`);
    return;
  }

  const attacks = memberData.attacks || 0;
  const attackLimit = memberData.attackLimit || 5;
  const bonusAttackLimit = memberData.bonusAttackLimit || 0;
  const capitalResourcesLooted = memberData.capitalResourcesLooted || 0;
  
  // Calculate bonus loot (bonus attacks indicate strong performance)
  // Bonus attacks are earned by destroying districts, so we estimate bonus loot
  const bonusLoot = bonusAttackLimit > 0 ? Math.round(capitalResourcesLooted * 0.1) : 0;

  const { error } = await supabase
    .from('capital_raid_participants')
    .upsert({
      weekend_id: weekendId,
      player_tag: playerTag,
      player_name: memberData.name || null,
      attack_count: attacks,
      total_loot: capitalResourcesLooted,
      bonus_loot: bonusLoot,
      capital_resources_looted: capitalResourcesLooted,
      raw: memberData,
    }, {
      onConflict: 'weekend_id,player_tag',
    });

  if (error) {
    throw new Error(`Failed to upsert participant: ${error.message}`);
  }
}

