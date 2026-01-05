import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

/**
 * GET /api/cwl/attacks
 * 
 * Fetches CWL attack results from the database.
 * 
 * Query params:
 * - clanTag: Our clan tag (defaults to homeClanTag)
 * - seasonId: CWL season ID (e.g., "2026-01")
 * - dayIndex: Specific day (1-7), or omit for all days
 * - playerTag: Filter by attacker tag
 * - isOurAttack: 'true' for our attacks only, 'false' for opponent attacks, omit for both
 * - includeUnperformed: 'true' to include unperformed attack slots
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/attacks');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag || '';
  const seasonId = searchParams.get('seasonId');
  const dayIndexParam = searchParams.get('dayIndex');
  const playerTagParam = searchParams.get('playerTag');
  const isOurAttackParam = searchParams.get('isOurAttack');
  const includeUnperformed = searchParams.get('includeUnperformed') === 'true';
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag || !isValidTag(clanTag)) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  if (!seasonId) {
    return json({ success: false, error: 'seasonId is required' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get season
    const { data: season } = await supabase
      .from('cwl_seasons')
      .select('id')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();
    
    if (!season) {
      return json({ success: true, data: [] });
    }
    
    // Build query
    let query = supabase
      .from('cwl_attack_results')
      .select('*')
      .eq('cwl_season_id', season.id)
      .order('day_index', { ascending: true })
      .order('attacker_map_position', { ascending: true })
      .order('attack_order', { ascending: true });
    
    // Optional filters
    if (dayIndexParam) {
      query = query.eq('day_index', parseInt(dayIndexParam, 10));
    }
    
    if (playerTagParam) {
      const playerTag = normalizeTag(playerTagParam);
      if (playerTag) {
        query = query.eq('attacker_tag', playerTag);
      }
    }
    
    if (isOurAttackParam !== null) {
      query = query.eq('is_our_attack', isOurAttackParam === 'true');
    }
    
    if (!includeUnperformed) {
      query = query.eq('attack_performed', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[cwl/attacks] Error:', error);
      return json({ success: false, error: 'Failed to fetch attacks' }, { status: 500 });
    }
    
    // Transform to camelCase for frontend
    const attacks = (data || []).map((row) => ({
      id: row.id,
      dayIndex: row.day_index,
      attackerTag: row.attacker_tag,
      attackerName: row.attacker_name,
      attackerTh: row.attacker_th,
      attackerMapPosition: row.attacker_map_position,
      defenderTag: row.defender_tag,
      defenderName: row.defender_name,
      defenderTh: row.defender_th,
      defenderMapPosition: row.defender_map_position,
      stars: row.stars,
      destructionPct: row.destruction_pct,
      attackOrder: row.attack_order,
      attackPerformed: row.attack_performed,
      isOurAttack: row.is_our_attack,
      warTag: row.war_tag,
      fetchedAt: row.fetched_at,
    }));
    
    // Add summary stats
    const performedAttacks = attacks.filter((a) => a.attackPerformed !== false);
    const ourAttacks = performedAttacks.filter((a) => a.isOurAttack);
    const theirAttacks = performedAttacks.filter((a) => !a.isOurAttack);
    
    const summary = {
      totalOurAttacks: ourAttacks.length,
      totalTheirAttacks: theirAttacks.length,
      ourTotalStars: ourAttacks.reduce((sum, a) => sum + (a.stars ?? 0), 0),
      theirTotalStars: theirAttacks.reduce((sum, a) => sum + (a.stars ?? 0), 0),
      ourAvgStars: ourAttacks.length ? (ourAttacks.reduce((sum, a) => sum + (a.stars ?? 0), 0) / ourAttacks.length).toFixed(2) : '0',
      theirAvgStars: theirAttacks.length ? (theirAttacks.reduce((sum, a) => sum + (a.stars ?? 0), 0) / theirAttacks.length).toFixed(2) : '0',
      ourThreeStars: ourAttacks.filter((a) => a.stars === 3).length,
      theirThreeStars: theirAttacks.filter((a) => a.stars === 3).length,
    };
    
    // Player performance breakdown (for our attacks)
    const playerPerformance: Record<string, {
      tag: string;
      name: string;
      attacks: number;
      totalStars: number;
      threeStars: number;
      avgStars: number;
      avgDestruction: number;
      thsAttacked: number[];
    }> = {};
    
    for (const attack of ourAttacks) {
      const tag = attack.attackerTag;
      if (!playerPerformance[tag]) {
        playerPerformance[tag] = {
          tag,
          name: attack.attackerName || tag,
          attacks: 0,
          totalStars: 0,
          threeStars: 0,
          avgStars: 0,
          avgDestruction: 0,
          thsAttacked: [],
        };
      }
      playerPerformance[tag].attacks++;
      playerPerformance[tag].totalStars += attack.stars ?? 0;
      if (attack.stars === 3) playerPerformance[tag].threeStars++;
      if (attack.defenderTh) playerPerformance[tag].thsAttacked.push(attack.defenderTh);
    }
    
    // Calculate averages
    Object.values(playerPerformance).forEach((p) => {
      p.avgStars = p.attacks ? p.totalStars / p.attacks : 0;
      const playerAttacks = ourAttacks.filter((a) => a.attackerTag === p.tag);
      const totalDestruction = playerAttacks.reduce((sum, a) => sum + (a.destructionPct ?? 0), 0);
      p.avgDestruction = playerAttacks.length ? totalDestruction / playerAttacks.length : 0;
    });
    
    return json({
      success: true,
      data: {
        attacks,
        summary,
        playerPerformance: Object.values(playerPerformance).sort((a, b) => b.avgStars - a.avgStars),
      },
    });
    
  } catch (error: any) {
    console.error('[cwl/attacks] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
