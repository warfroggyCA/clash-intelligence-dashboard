import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getClanWarLeagueGroup, getCwlWar } from '@/lib/coc';
import { isWarEnded, normalizeWarState } from '@/lib/cwl-war-state';
import { syncCwlAttendanceForDay, syncCwlAttendanceRollups } from '@/lib/cwl-attendance';

/**
 * GET /api/cwl/fetch-results
 * 
 * Fetches CWL war results from the CoC API and stores them in the database.
 * 
 * Query params:
 * - clanTag: Our clan tag (defaults to homeClanTag)
 * - seasonId: CWL season ID (e.g., "2026-01")
 * - dayIndex: Specific day to fetch (1-7), or omit to fetch all completed days
 * - force: If true, re-fetch even if already stored
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/fetch-results');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag || '';
  const seasonId = searchParams.get('seasonId');
  const dayIndexParam = searchParams.get('dayIndex');
  const force = searchParams.get('force') === 'true';
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag || !isValidTag(clanTag)) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  if (!seasonId) {
    return json({ success: false, error: 'seasonId is required' }, { status: 400 });
  }
  
  const dayIndex = dayIndexParam ? parseInt(dayIndexParam, 10) : null;
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get or create season
    let seasonUuid: string;
    const { data: existingSeason } = await supabase
      .from('cwl_seasons')
      .select('id, war_size')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();
    
    if (existingSeason) {
      seasonUuid = existingSeason.id;
    } else {
      const { data: created, error } = await supabase
        .from('cwl_seasons')
        .insert({ clan_tag: clanTag, season_id: seasonId, war_size: 15 })
        .select('id')
        .single();
      if (error) throw new Error('Failed to create season');
      seasonUuid = created.id;
    }
    
    // Fetch CWL league group from CoC API
    console.log('[fetch-results] Fetching league group for', clanTag);
    const leagueGroup = await getClanWarLeagueGroup(clanTag);
    
    if (!leagueGroup?.rounds?.length) {
      return json({ 
        success: false, 
        error: 'No CWL league group found - CWL may not be active' 
      }, { status: 404 });
    }
    
    const results: Array<{
      dayIndex: number;
      status: 'fetched' | 'skipped' | 'not_ready' | 'error';
      message?: string;
      data?: any;
    }> = [];
    let rollupNeedsRefresh = false;
    let rollupError: string | null = null;
    
    // Determine which days to process
    const daysToProcess = dayIndex 
      ? [dayIndex] 
      : Array.from({ length: leagueGroup.rounds.length }, (_, i) => i + 1);
    
    for (const day of daysToProcess) {
      const roundIndex = day - 1;
      if (roundIndex < 0 || roundIndex >= leagueGroup.rounds.length) {
        results.push({ dayIndex: day, status: 'error', message: 'Invalid day index' });
        continue;
      }
      
      // Check if we already have results for this day (skip if not forcing)
      if (!force) {
        const { data: existingResult } = await supabase
          .from('cwl_day_results')
          .select('id, war_state')
          .eq('cwl_season_id', seasonUuid)
          .eq('day_index', day)
          .maybeSingle();
        
        if (isWarEnded(existingResult?.war_state)) {
          results.push({ dayIndex: day, status: 'skipped', message: 'Already fetched' });
          continue;
        }
      }
      
      // Find our war for this day
      const warTags = leagueGroup.rounds[roundIndex]?.warTags || [];
      let ourWar: Awaited<ReturnType<typeof getCwlWar>> | null = null;
      let ourWarTag: string | null = null;
      
      for (const warTag of warTags) {
        if (!warTag || !isValidTag(warTag)) continue;
        
        try {
          const war = await getCwlWar(warTag);
          if (!war?.clan?.tag || !war?.opponent?.tag) continue;
          
          const warClanTag = normalizeTag(war.clan.tag);
          const warOppTag = normalizeTag(war.opponent.tag);
          
          if (warClanTag === clanTag || warOppTag === clanTag) {
            ourWar = war;
            ourWarTag = normalizeTag(warTag);
            break;
          }
        } catch (err) {
          console.warn(`[fetch-results] Failed to fetch war ${warTag}:`, err);
        }
      }
      
      if (!ourWar) {
        results.push({ dayIndex: day, status: 'error', message: 'Could not find our war' });
        continue;
      }
      
      const warState = normalizeWarState(ourWar.state) || 'unknown';
      const warEnded = isWarEnded(warState);
      
      // Check if war is complete
      if (!warEnded) {
        results.push({ 
          dayIndex: day, 
          status: 'not_ready', 
          message: `War state: ${warState}` 
        });
        continue;
      }
      
      // Determine which side is us
      const warClanTag = normalizeTag(ourWar.clan?.tag ?? '');
      const isWeTheClan = warClanTag === clanTag;
      const ourSide = isWeTheClan ? ourWar.clan : ourWar.opponent;
      const theirSide = isWeTheClan ? ourWar.opponent : ourWar.clan;
      
      // Extract results
      const ourStars = ourSide?.stars ?? 0;
      const opponentStars = theirSide?.stars ?? 0;
      const ourDestruction = ourSide?.destructionPercentage ?? 0;
      const opponentDestruction = theirSide?.destructionPercentage ?? 0;
      const ourAttacksUsed = ourSide?.attacks ?? 0;
      const opponentAttacksUsed = theirSide?.attacks ?? 0;
      
      // Determine result
      let result: 'W' | 'L' | 'T';
      if (ourStars > opponentStars) {
        result = 'W';
      } else if (ourStars < opponentStars) {
        result = 'L';
      } else if (ourDestruction > opponentDestruction) {
        result = 'W';
      } else if (ourDestruction < opponentDestruction) {
        result = 'L';
      } else {
        result = 'T';
      }
      
      // Upsert day results
      const opponentTagRaw = normalizeTag(theirSide?.tag ?? '');
      const opponentTag = opponentTagRaw && isValidTag(opponentTagRaw) ? opponentTagRaw : null;
      const dayResultRow = {
        cwl_season_id: seasonUuid,
        day_index: day,
        result,
        our_stars: ourStars,
        opponent_stars: opponentStars,
        our_destruction_pct: ourDestruction,
        opponent_destruction_pct: opponentDestruction,
        our_attacks_used: ourAttacksUsed,
        opponent_attacks_used: opponentAttacksUsed,
        war_tag: ourWarTag,
        war_state: warState,
        opponent_tag: opponentTag,
        opponent_name: theirSide?.name ?? null,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await supabase
        .from('cwl_day_results')
        .upsert(dayResultRow, { onConflict: 'cwl_season_id,day_index' });
      
      // CWL wars always have 1 attack per member (unlike regular wars which have 2)
      const attacksPerMember = 1;

      // Extract and store individual attacks
      const attackRows: Array<{
        cwl_season_id: string;
        day_index: number;
        attacker_tag: string;
        attacker_name: string | null;
        attacker_th: number | null;
        attacker_map_position: number | null;
        defender_tag: string | null;
        defender_name: string | null;
        defender_th: number | null;
        defender_map_position: number | null;
        stars: number | null;
        destruction_pct: number | null;
        attack_order: number;
        attack_performed: boolean;
        is_our_attack: boolean;
        war_tag: string | null;
        fetched_at: string;
      }> = [];
      const fetchedAt = new Date().toISOString();
      
      // Build member lookup maps
      const ourMemberMap = new Map<string, any>();
      const theirMemberMap = new Map<string, any>();
      
      for (const m of ourSide?.members || []) {
        if (m?.tag) ourMemberMap.set(normalizeTag(m.tag), m);
      }
      for (const m of theirSide?.members || []) {
        if (m?.tag) theirMemberMap.set(normalizeTag(m.tag), m);
      }
      
      const addAttackRowsForSide = (members: any[], defenderMap: Map<string, any>, isOurAttack: boolean) => {
        for (const member of members || []) {
          const attackerTag = normalizeTag(member.tag || '');
          if (!attackerTag || !isValidTag(attackerTag)) continue;
          const attacks = Array.isArray(member.attacks) ? member.attacks : [];
          const performedOrders = new Set<number>();

          attacks.forEach((attack: { attackerTag?: string; defenderTag?: string; stars?: number; destructionPercentage?: number; order?: number }, idx: number) => {
            const order = idx + 1;
            if (order > attacksPerMember) return;
            const defenderTag = normalizeTag(attack?.defenderTag || '');
            if (!defenderTag || !isValidTag(defenderTag)) return;
            if (performedOrders.has(order)) return;
            const defender = defenderMap.get(defenderTag);
            performedOrders.add(order);
            const starsRaw = Number(attack?.stars);
            const stars = Number.isFinite(starsRaw)
              ? Math.min(3, Math.max(0, Math.round(starsRaw)))
              : 0;
            const destructionRaw = Number(attack?.destructionPercentage);
            const destructionPct = Number.isFinite(destructionRaw)
              ? Math.min(100, Math.max(0, destructionRaw))
              : null;

            attackRows.push({
              cwl_season_id: seasonUuid,
              day_index: day,
              attacker_tag: attackerTag,
              attacker_name: member.name || null,
              attacker_th: member.townhallLevel ?? member.townHallLevel ?? null,
              attacker_map_position: member.mapPosition ?? null,
              defender_tag: defenderTag,
              defender_name: defender?.name || null,
              defender_th: defender?.townhallLevel ?? defender?.townHallLevel ?? null,
              defender_map_position: defender?.mapPosition ?? null,
              stars,
              destruction_pct: destructionPct,
              attack_order: order,
              attack_performed: true,
              is_our_attack: isOurAttack,
              war_tag: ourWarTag,
              fetched_at: fetchedAt,
            });
          });

          for (let order = 1; order <= attacksPerMember; order += 1) {
            if (performedOrders.has(order)) continue;
            attackRows.push({
              cwl_season_id: seasonUuid,
              day_index: day,
              attacker_tag: attackerTag,
              attacker_name: member.name || null,
              attacker_th: member.townhallLevel ?? member.townHallLevel ?? null,
              attacker_map_position: member.mapPosition ?? null,
              defender_tag: null,
              defender_name: null,
              defender_th: null,
              defender_map_position: null,
              stars: null,
              destruction_pct: null,
              attack_order: order,
              attack_performed: false,
              is_our_attack: isOurAttack,
              war_tag: ourWarTag,
              fetched_at: fetchedAt,
            });
          }
        }
      };

      // Process our attacks (include unperformed slots)
      addAttackRowsForSide(ourSide?.members || [], theirMemberMap, true);

      // Process their attacks (include unperformed slots)
      addAttackRowsForSide(theirSide?.members || [], ourMemberMap, false);
      
      // Upsert attack results
      let attackErrorMessage: string | null = null;
      if (attackRows.length > 0) {
        const { error: attackError } = await supabase
          .from('cwl_attack_results')
          .upsert(attackRows, { 
            onConflict: 'cwl_season_id,day_index,attacker_tag,attack_order,is_our_attack' 
          });
        
        if (attackError) {
          console.error('[fetch-results] Error upserting attacks:', attackError);
          attackErrorMessage = attackError.message || 'Failed to upsert attacks';
        }
      }
      if (attackErrorMessage) {
        results.push({
          dayIndex: day,
          status: 'error',
          message: attackErrorMessage,
        });
        continue;
      }

      try {
        await syncCwlAttendanceForDay({
          supabase,
          seasonId: seasonUuid,
          dayIndex: day,
          warTag: ourWarTag,
        });
        rollupNeedsRefresh = true;
      } catch (err: any) {
        results.push({
          dayIndex: day,
          status: 'error',
          message: err?.message || 'Failed to sync attendance ledger',
        });
        continue;
      }

      results.push({
        dayIndex: day,
        status: 'fetched',
        data: {
          result,
          ourStars,
          opponentStars,
          ourDestruction,
          opponentDestruction,
          attackCount: attackRows.filter(a => a.is_our_attack && a.attack_performed).length,
          opponent: theirSide?.name,
        },
      });
    }

    if (rollupNeedsRefresh) {
      try {
        await syncCwlAttendanceRollups({ supabase, seasonId: seasonUuid });
      } catch (err: any) {
        rollupError = err?.message || 'Failed to sync attendance rollups';
      }
    }

    return json({
      success: true,
      data: {
        seasonId,
        clanTag,
        results,
        rollupError,
        summary: {
          fetched: results.filter(r => r.status === 'fetched').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          notReady: results.filter(r => r.status === 'not_ready').length,
          errors: results.filter(r => r.status === 'error').length,
        },
      },
    });
    
  } catch (error: any) {
    console.error('[fetch-results] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
