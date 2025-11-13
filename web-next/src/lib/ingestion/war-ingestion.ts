// War Data Ingestion Pipeline
// Fetches and stores clan war data from Clash of Clans API

import { getClanWarLog, getClanCurrentWar } from '@/lib/coc';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export interface WarIngestionResult {
  success: boolean;
  clanTag: string;
  warsIngested: number;
  currentWarIngested: boolean;
  errors?: string[];
}

export interface WarIngestionOptions {
  clanTag?: string;
  warLogLimit?: number;
  skipCurrentWar?: boolean;
}

/**
 * Ingests war log data from Clash of Clans API and stores in Supabase
 */
export async function ingestWarData(options: WarIngestionOptions = {}): Promise<WarIngestionResult> {
  const { clanTag: providedTag, warLogLimit = 20, skipCurrentWar = false } = options;
  const clanTag = providedTag || cfg.homeClanTag;
  
  if (!clanTag) {
    throw new Error('No clan tag provided for war ingestion');
  }

  const normalizedTag = normalizeTag(clanTag);
  if (!normalizedTag) {
    throw new Error(`Invalid clan tag: ${clanTag}`);
  }

  const supabase = getSupabaseAdminClient();
  const errors: string[] = [];
  let warsIngested = 0;
  let currentWarIngested = false;

  try {
    // Fetch war log
    console.log(`[WarIngestion] Fetching war log for ${normalizedTag} (limit: ${warLogLimit})`);
    const warLog = await getClanWarLog(normalizedTag, warLogLimit);
    
    if (!Array.isArray(warLog) || warLog.length === 0) {
      console.log(`[WarIngestion] No wars found in war log for ${normalizedTag}`);
      return {
        success: true,
        clanTag: normalizedTag,
        warsIngested: 0,
        currentWarIngested: false,
      };
    }

    // Process each war in the log
    for (const warEntry of warLog) {
      try {
        const ingested = await ingestWarEntry(warEntry, normalizedTag, supabase);
        if (ingested) {
          warsIngested++;
        }
      } catch (error: any) {
        const errorMsg = `Failed to ingest war entry: ${error?.message || String(error)}`;
        console.error(`[WarIngestion] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Fetch and ingest current war (if active)
    if (!skipCurrentWar) {
      try {
        console.log(`[WarIngestion] Checking for current war for ${normalizedTag}`);
        const currentWar = await getClanCurrentWar(normalizedTag);
        
        if (currentWar && currentWar.state && currentWar.state !== 'notInWar') {
          const ingested = await ingestCurrentWar(currentWar, normalizedTag, supabase);
          if (ingested) {
            currentWarIngested = true;
            console.log(`[WarIngestion] Ingested current war (state: ${currentWar.state})`);
          }
        } else {
          console.log(`[WarIngestion] No active war for ${normalizedTag}`);
        }
      } catch (error: any) {
        // Current war API can return 404/403 - that's OK, just log and continue
        if (error?.status !== 404 && error?.status !== 403) {
          const errorMsg = `Failed to fetch current war: ${error?.message || String(error)}`;
          console.warn(`[WarIngestion] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    return {
      success: errors.length === 0,
      clanTag: normalizedTag,
      warsIngested,
      currentWarIngested,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error(`[WarIngestion] Fatal error:`, error);
    return {
      success: false,
      clanTag: normalizedTag,
      warsIngested,
      currentWarIngested,
      errors: [error?.message || String(error)],
    };
  }
}

/**
 * Ingests a single war log entry
 */
async function ingestWarEntry(
  warEntry: any,
  clanTag: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<boolean> {
  // Extract war data
  const result = warEntry.result || 'unknown';
  const teamSize = warEntry.teamSize || 0;
  const endTime = warEntry.endTime;
  const clan = warEntry.clan || {};
  const opponent = warEntry.opponent || {};

  if (!endTime) {
    console.warn(`[WarIngestion] Skipping war entry without endTime`);
    return false;
  }

  // Parse battle end time (war log entries use endTime as battle_end)
  const battleEnd = new Date(endTime);
  if (isNaN(battleEnd.getTime())) {
    console.warn(`[WarIngestion] Invalid endTime: ${endTime}`);
    return false;
  }

  // Calculate battle start (typically 24 hours before end for regular wars)
  const battleStart = new Date(battleEnd.getTime() - 24 * 60 * 60 * 1000);
  const preparationStart = new Date(battleStart.getTime() - 24 * 60 * 60 * 1000);

  // Check if war already exists (idempotent check)
  const { data: existingWar } = await supabase
    .from('clan_wars')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('war_type', 'regular')
    .eq('battle_start', battleStart.toISOString())
    .maybeSingle();

  if (existingWar) {
    console.log(`[WarIngestion] War already exists (battle_start: ${battleStart.toISOString()}), skipping`);
    return false;
  }

  // Insert war record
  const { data: warRecord, error: warError } = await supabase
    .from('clan_wars')
    .insert({
      clan_tag: clanTag,
      opponent_tag: opponent.tag || null,
      opponent_name: opponent.name || null,
      opponent_level: opponent.clanLevel || null,
      war_type: 'regular',
      state: 'ended',
      result: result,
      preparation_start: preparationStart.toISOString(),
      battle_start: battleStart.toISOString(),
      battle_end: battleEnd.toISOString(),
      team_size: teamSize,
      attacks_per_member: 2, // Default for regular wars
      clan_stars: clan.stars || 0,
      clan_destruction: clan.destructionPercentage || 0,
      opponent_stars: opponent.stars || 0,
      opponent_destruction: opponent.destructionPercentage || 0,
      raw: warEntry,
    })
    .select('id')
    .single();

  if (warError || !warRecord) {
    throw new Error(`Failed to insert war: ${warError?.message || 'Unknown error'}`);
  }

  const warId = warRecord.id;

  // Insert clan records (both home and opponent)
  await ingestWarClan(warId, clanTag, clan, true, supabase);
  if (opponent.tag) {
    await ingestWarClan(warId, opponent.tag, opponent, false, supabase);
  }

  // Insert member records
  if (Array.isArray(clan.members)) {
    for (const member of clan.members) {
      await ingestWarMember(warId, clanTag, member, true, supabase);
    }
  }

  if (Array.isArray(opponent.members)) {
    for (const member of opponent.members) {
      await ingestWarMember(warId, opponent.tag || '', member, false, supabase);
    }
  }

  // Insert attack records
  if (Array.isArray(clan.members)) {
    for (const member of clan.members) {
      if (Array.isArray(member.attacks)) {
        for (let i = 0; i < member.attacks.length; i++) {
          const attack = member.attacks[i];
          await ingestWarAttack(warId, member.tag, attack, i, clanTag, supabase);
        }
      }
    }
  }

  if (Array.isArray(opponent.members)) {
    for (const member of opponent.members) {
      if (Array.isArray(member.attacks)) {
        for (let i = 0; i < member.attacks.length; i++) {
          const attack = member.attacks[i];
          await ingestWarAttack(warId, member.tag, attack, i, opponent.tag || '', supabase);
        }
      }
    }
  }

  return true;
}

/**
 * Ingests current war (if active)
 */
async function ingestCurrentWar(
  currentWar: any,
  clanTag: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<boolean> {
  const state = currentWar.state;
  const teamSize = currentWar.teamSize || 0;
  const preparationStart = currentWar.preparationStartTime;
  const battleStart = currentWar.startTime;
  const battleEnd = currentWar.endTime;
  const clan = currentWar.clan || {};
  const opponent = currentWar.opponent || {};

  if (!battleStart) {
    console.warn(`[WarIngestion] Current war missing startTime`);
    return false;
  }

  const battleStartDate = new Date(battleStart);

  // Check if current war already exists
  const { data: existingWar } = await supabase
    .from('clan_wars')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('war_type', 'regular')
    .eq('battle_start', battleStartDate.toISOString())
    .maybeSingle();

  if (existingWar) {
    // Update existing war with latest state
    const { error: updateError } = await supabase
      .from('clan_wars')
      .update({
        state: state,
        clan_stars: clan.stars || 0,
        clan_destruction: clan.destructionPercentage || 0,
        opponent_stars: opponent.stars || 0,
        opponent_destruction: opponent.destructionPercentage || 0,
        raw: currentWar,
      })
      .eq('id', existingWar.id);

    if (updateError) {
      throw new Error(`Failed to update current war: ${updateError.message}`);
    }

    // Update members and attacks
    const warId = existingWar.id;
    if (Array.isArray(clan.members)) {
      for (const member of clan.members) {
        await ingestWarMember(warId, clanTag, member, true, supabase);
        if (Array.isArray(member.attacks)) {
          for (let i = 0; i < member.attacks.length; i++) {
            await ingestWarAttack(warId, member.tag, member.attacks[i], i, clanTag, supabase);
          }
        }
      }
    }

    return true;
  }

  // Insert new current war
  const { data: warRecord, error: warError } = await supabase
    .from('clan_wars')
    .insert({
      clan_tag: clanTag,
      opponent_tag: opponent.tag || null,
      opponent_name: opponent.name || null,
      opponent_level: opponent.clanLevel || null,
      war_type: 'regular',
      state: state,
      result: null, // Will be set when war ends
      preparation_start: preparationStart ? new Date(preparationStart).toISOString() : null,
      battle_start: battleStartDate.toISOString(),
      battle_end: battleEnd ? new Date(battleEnd).toISOString() : null,
      team_size: teamSize,
      attacks_per_member: 2,
      clan_stars: clan.stars || 0,
      clan_destruction: clan.destructionPercentage || 0,
      opponent_stars: opponent.stars || 0,
      opponent_destruction: opponent.destructionPercentage || 0,
      raw: currentWar,
    })
    .select('id')
    .single();

  if (warError || !warRecord) {
    throw new Error(`Failed to insert current war: ${warError?.message || 'Unknown error'}`);
  }

  const warId = warRecord.id;

  // Insert clan, member, and attack records
  await ingestWarClan(warId, clanTag, clan, true, supabase);
  if (opponent.tag) {
    await ingestWarClan(warId, opponent.tag, opponent, false, supabase);
  }

  if (Array.isArray(clan.members)) {
    for (const member of clan.members) {
      await ingestWarMember(warId, clanTag, member, true, supabase);
      if (Array.isArray(member.attacks)) {
        for (let i = 0; i < member.attacks.length; i++) {
          await ingestWarAttack(warId, member.tag, member.attacks[i], i, clanTag, supabase);
        }
      }
    }
  }

  return true;
}

/**
 * Ingests a war clan record
 */
async function ingestWarClan(
  warId: string,
  clanTag: string,
  clanData: any,
  isHome: boolean,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<void> {
  const { error } = await supabase
    .from('clan_war_clans')
    .upsert({
      war_id: warId,
      clan_tag: clanTag,
      clan_name: clanData.name || null,
      clan_level: clanData.clanLevel || null,
      badge: clanData.badgeUrls || null,
      stars: clanData.stars || 0,
      destruction: clanData.destructionPercentage || 0,
      attacks_used: clanData.attacks || 0,
      exp_earned: clanData.expEarned || 0,
      is_home: isHome,
    }, {
      onConflict: 'war_id,clan_tag',
    });

  if (error) {
    throw new Error(`Failed to upsert war clan: ${error.message}`);
  }
}

/**
 * Ingests a war member record
 */
async function ingestWarMember(
  warId: string,
  clanTag: string,
  memberData: any,
  isHome: boolean,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<void> {
  const attacks = Array.isArray(memberData.attacks) ? memberData.attacks.length : 0;
  let totalStars = 0;
  let totalDestruction = 0;

  if (Array.isArray(memberData.attacks)) {
    for (const attack of memberData.attacks) {
      totalStars += attack.stars || 0;
      totalDestruction += attack.destructionPercentage || 0;
    }
  }

  const defenses = Array.isArray(memberData.opponentAttacks) ? memberData.opponentAttacks.length : 0;
  let defenseDestruction = 0;
  if (Array.isArray(memberData.opponentAttacks)) {
    for (const defense of memberData.opponentAttacks) {
      defenseDestruction += defense.destructionPercentage || 0;
    }
  }

  const { error } = await supabase
    .from('clan_war_members')
    .upsert({
      war_id: warId,
      clan_tag: clanTag,
      player_tag: memberData.tag || '',
      player_name: memberData.name || null,
      town_hall_level: memberData.townhallLevel || null,
      map_position: memberData.mapPosition || null,
      attacks: attacks,
      stars: totalStars,
      destruction: totalDestruction,
      defense_count: defenses,
      defense_destruction: defenseDestruction,
      is_home: isHome,
      raw: memberData,
    }, {
      onConflict: 'war_id,player_tag',
    });

  if (error) {
    throw new Error(`Failed to upsert war member: ${error.message}`);
  }
}

/**
 * Ingests a war attack record
 */
async function ingestWarAttack(
  warId: string,
  attackerTag: string,
  attackData: any,
  orderIndex: number,
  attackerClanTag: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<void> {
  const defenderTag = attackData.defenderTag || '';
  const defenderName = attackData.defenderName || '';
  const defenderClanTag = attackData.defenderClanTag || '';

  const { error } = await supabase
    .from('clan_war_attacks')
    .upsert({
      war_id: warId,
      attacker_tag: attackerTag,
      attacker_name: attackData.attackerName || null,
      defender_tag: defenderTag,
      defender_name: defenderName,
      attacker_clan_tag: attackerClanTag,
      defender_clan_tag: defenderClanTag,
      order_index: orderIndex,
      stars: attackData.stars || 0,
      destruction: attackData.destructionPercentage || 0,
      duration: attackData.duration || null,
      is_best_attack: attackData.bestOpponentAttack === true,
      attack_time: attackData.order ? new Date(attackData.order).toISOString() : null,
      raw: attackData,
    }, {
      onConflict: 'war_id,attacker_tag,defender_tag,order_index',
    });

  if (error) {
    throw new Error(`Failed to upsert war attack: ${error.message}`);
  }
}

