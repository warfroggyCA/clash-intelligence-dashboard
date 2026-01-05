/**
 * CWL Statistics Service
 * 
 * Calculates CWL participation and performance metrics for players.
 * Used for leadership assessment, player profiles, and promotion decisions.
 */

import { getSupabaseAdminClient } from './supabase-admin';
import { normalizeTag } from './tags';
import { isWarEnded } from './cwl-war-state';

// =============================================================================
// Types
// =============================================================================

export interface CwlPlayerStats {
  playerTag: string;
  playerName: string | null;
  
  // Participation
  totalWars: number;           // How many CWL wars they were part of
  attacksUsed: number;         // Total attacks made
  attacksAvailable: number;    // Total attack slots logged (performed + unperformed)
  participationRate: number;   // attacksUsed / attacksAvailable (0-1)
  
  // Performance
  totalStars: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  zeroStarCount: number;
  avgStars: number;            // Average stars per attack
  avgDestruction: number;      // Average destruction %
  threeStarRate: number;       // threeStarCount / attacksUsed (0-1)
  
  // Matchup analysis
  avgThDelta: number;          // Average (attacker TH - defender TH), positive = hitting down
  hitsUp: number;              // Attacks against higher TH
  hitsEven: number;            // Attacks against same TH
  hitsDown: number;            // Attacks against lower TH
  
  // Seasons
  seasonsParticipated: number;
  lastSeasonId: string | null;
  
  // Raw data
  attacks: CwlAttackRecord[];
}

export interface CwlAttackRecord {
  seasonId: string;
  dayIndex: number;
  defenderTag: string;
  defenderName: string | null;
  defenderTh: number | null;
  attackerTh: number | null;
  stars: number;
  destructionPct: number | null;
}

export interface CwlClanStats {
  clanTag: string;
  seasonId: string;
  
  // Aggregate performance
  totalWars: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  
  // Attack usage
  totalAttacksUsed: number;
  totalAttacksAvailable: number;
  attackUsageRate: number;
  
  // Player breakdown
  playerStats: CwlPlayerStats[];
  
  // Top performers
  topByParticipation: CwlPlayerStats[];
  topByStars: CwlPlayerStats[];
  topByThreeStarRate: CwlPlayerStats[];
  
  // Concerns (for leadership review)
  lowParticipation: CwlPlayerStats[];  // < 80% attack usage
  missedAttacks: Array<{ playerTag: string; playerName: string | null; missedCount: number }>;
}

export interface GetCwlStatsOptions {
  clanTag: string;
  seasonId?: string;           // Specific season, or omit for all-time
  playerTag?: string;          // Specific player, or omit for all
  seasonsBack?: number;        // How many seasons to look back (default: all)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get CWL statistics for a clan and optionally a specific player
 */
export async function getCwlStats(options: GetCwlStatsOptions): Promise<CwlClanStats | null> {
  const supabase = getSupabaseAdminClient();
  const clanTag = normalizeTag(options.clanTag);
  
  if (!clanTag) {
    throw new Error('Invalid clan tag');
  }
  
  // Get seasons for this clan
  let seasonsQuery = supabase
    .from('cwl_seasons')
    .select('id, season_id, war_size')
    .eq('clan_tag', clanTag)
    .order('season_id', { ascending: false });
  
  if (options.seasonId) {
    seasonsQuery = seasonsQuery.eq('season_id', options.seasonId);
  } else if (options.seasonsBack) {
    seasonsQuery = seasonsQuery.limit(options.seasonsBack);
  }
  
  const { data: seasons, error: seasonsError } = await seasonsQuery;
  
  if (seasonsError || !seasons?.length) {
    return null;
  }
  
  const seasonIds = seasons.map(s => s.id);
  const latestSeasonId = seasons[0].season_id;
  
  // Get day results for win/loss tracking
  const { data: dayResults } = await supabase
    .from('cwl_day_results')
    .select('*')
    .in('cwl_season_id', seasonIds);
  
  // Get all attacks (performed + unperformed)
  let attacksQuery = supabase
    .from('cwl_attack_results')
    .select('*')
    .in('cwl_season_id', seasonIds)
    .eq('is_our_attack', true);
  
  if (options.playerTag) {
    const playerTag = normalizeTag(options.playerTag);
    if (playerTag) {
      attacksQuery = attacksQuery.eq('attacker_tag', playerTag);
    }
  }
  
  const { data: attacks, error: attacksError } = await attacksQuery;
  
  if (attacksError) {
    console.error('[cwl-stats] Error fetching attacks:', attacksError);
    throw new Error('Failed to fetch CWL attacks');
  }
  
  // Get eligible members per season to calculate participation
  const { data: eligibleMembers } = await supabase
    .from('cwl_eligible_members')
    .select('cwl_season_id, player_tag, player_name')
    .in('cwl_season_id', seasonIds);
  
  // Calculate stats
  const completedWars = dayResults?.filter(r => isWarEnded(r.war_state)) || [];
  const wins = completedWars.filter(r => r.result === 'W').length;
  const losses = completedWars.filter(r => r.result === 'L').length;
  const ties = completedWars.filter(r => r.result === 'T').length;
  const totalWars = completedWars.length;
  
  // Build season-to-members map
  const seasonMembersMap = new Map<string, Set<string>>();
  for (const em of eligibleMembers || []) {
    if (!seasonMembersMap.has(em.cwl_season_id)) {
      seasonMembersMap.set(em.cwl_season_id, new Set());
    }
    seasonMembersMap.get(em.cwl_season_id)!.add(normalizeTag(em.player_tag));
  }
  
  // Build player stats
  const playerStatsMap = new Map<string, CwlPlayerStats>();
  
  // Initialize from eligible members
  for (const em of eligibleMembers || []) {
    const tag = normalizeTag(em.player_tag);
    if (!playerStatsMap.has(tag)) {
      playerStatsMap.set(tag, {
        playerTag: tag,
        playerName: em.player_name,
        totalWars: 0,
        attacksUsed: 0,
        attacksAvailable: 0,
        participationRate: 0,
        totalStars: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0,
        zeroStarCount: 0,
        avgStars: 0,
        avgDestruction: 0,
        threeStarRate: 0,
        avgThDelta: 0,
        hitsUp: 0,
        hitsEven: 0,
        hitsDown: 0,
        seasonsParticipated: 0,
        lastSeasonId: null,
        attacks: [],
      });
    }
  }
  
  const warDaysByPlayer = new Map<string, Set<string>>();
  
  // Process attacks
  let totalThDelta = 0;
  let thDeltaCount = 0;
  
  for (const attack of attacks || []) {
    const tag = normalizeTag(attack.attacker_tag);
    let stats = playerStatsMap.get(tag);
    
    if (!stats) {
      // Player has attacks but wasn't in eligible members list
      stats = {
        playerTag: tag,
        playerName: attack.attacker_name,
        totalWars: 0,
        attacksUsed: 0,
        attacksAvailable: 0,
        participationRate: 0,
        totalStars: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0,
        zeroStarCount: 0,
        avgStars: 0,
        avgDestruction: 0,
        threeStarRate: 0,
        avgThDelta: 0,
        hitsUp: 0,
        hitsEven: 0,
        hitsDown: 0,
        seasonsParticipated: 0,
        lastSeasonId: null,
        attacks: [],
      };
      playerStatsMap.set(tag, stats);
    }
    
    // Find season ID from UUID
    const season = seasons.find(s => s.id === attack.cwl_season_id);
    const seasonIdStr = season?.season_id || null;
    const warKey = `${seasonIdStr || 'unknown'}::${attack.day_index}`;
    if (!warDaysByPlayer.has(tag)) {
      warDaysByPlayer.set(tag, new Set());
    }
    warDaysByPlayer.get(tag)!.add(warKey);
    stats.attacksAvailable++;
    
    if (attack.attack_performed === false || attack.stars == null) {
      continue;
    }
    
    stats.attacksUsed++;
    stats.totalStars += attack.stars;
    
    if (attack.stars === 3) stats.threeStarCount++;
    else if (attack.stars === 2) stats.twoStarCount++;
    else if (attack.stars === 1) stats.oneStarCount++;
    else stats.zeroStarCount++;
    
    // TH matchup
    const attackerTh = attack.attacker_th ?? null;
    const defenderTh = attack.defender_th ?? null;
    if (attackerTh != null && defenderTh != null) {
      const delta = attackerTh - defenderTh;
      totalThDelta += delta;
      thDeltaCount++;
      
      if (delta < 0) stats.hitsUp++;
      else if (delta > 0) stats.hitsDown++;
      else stats.hitsEven++;
    }
    
    // Track last season
    if (seasonIdStr && (!stats.lastSeasonId || seasonIdStr > stats.lastSeasonId)) {
      stats.lastSeasonId = seasonIdStr;
    }
    
    // Add to attacks array
    stats.attacks.push({
      seasonId: seasonIdStr || 'unknown',
      dayIndex: attack.day_index,
      defenderTag: attack.defender_tag,
      defenderName: attack.defender_name,
      defenderTh: attack.defender_th,
      attackerTh: attack.attacker_th,
      stars: attack.stars,
      destructionPct: attack.destruction_pct,
    });
  }
  
  // Calculate averages and rates
  const playerStats: CwlPlayerStats[] = [];
  let totalAttacksUsed = 0;
  let totalAttacksAvailable = 0;
  
  for (const stats of playerStatsMap.values()) {
    // Calculate participation rate
    if (stats.attacksAvailable > 0) {
      stats.participationRate = stats.attacksUsed / stats.attacksAvailable;
    }
    
    // Calculate attack averages
    if (stats.attacksUsed > 0) {
      stats.avgStars = stats.totalStars / stats.attacksUsed;
      stats.threeStarRate = stats.threeStarCount / stats.attacksUsed;
      
      // Calculate avg destruction
      const totalDestruction = stats.attacks.reduce((sum, a) => sum + (a.destructionPct ?? 0), 0);
      stats.avgDestruction = totalDestruction / stats.attacksUsed;
      
      // Calculate avg TH delta
      const thDeltas = stats.attacks
        .filter(a => a.attackerTh != null && a.defenderTh != null)
        .map(a => (a.attackerTh! - a.defenderTh!));
      if (thDeltas.length > 0) {
        stats.avgThDelta = thDeltas.reduce((sum, d) => sum + d, 0) / thDeltas.length;
      }
    }
    
    const warDays = warDaysByPlayer.get(stats.playerTag);
    stats.totalWars = warDays ? warDays.size : 0;
    if (warDays) {
      const seasonIds = new Set(Array.from(warDays).map((key) => key.split('::')[0]));
      stats.seasonsParticipated = seasonIds.size;
    }
    
    totalAttacksUsed += stats.attacksUsed;
    totalAttacksAvailable += stats.attacksAvailable;
    
    playerStats.push(stats);
  }
  
  // Sort and identify top performers and concerns
  const sortedByParticipation = [...playerStats]
    .filter(p => p.attacksAvailable > 0)
    .sort((a, b) => b.participationRate - a.participationRate);
  
  const sortedByStars = [...playerStats]
    .filter(p => p.attacksUsed >= 3) // Minimum sample size
    .sort((a, b) => b.avgStars - a.avgStars);
  
  const sortedByThreeStarRate = [...playerStats]
    .filter(p => p.attacksUsed >= 3)
    .sort((a, b) => b.threeStarRate - a.threeStarRate);
  
  const lowParticipation = sortedByParticipation
    .filter(p => p.participationRate < 0.8 && p.attacksAvailable > 0);
  
  const missedAttacks = playerStats
    .filter(p => p.attacksAvailable > p.attacksUsed)
    .map(p => ({
      playerTag: p.playerTag,
      playerName: p.playerName,
      missedCount: p.attacksAvailable - p.attacksUsed,
    }))
    .sort((a, b) => b.missedCount - a.missedCount);
  
  return {
    clanTag,
    seasonId: options.seasonId || latestSeasonId,
    totalWars,
    wins,
    losses,
    ties,
    winRate: totalWars > 0 ? wins / totalWars : 0,
    totalAttacksUsed,
    totalAttacksAvailable,
    attackUsageRate: totalAttacksAvailable > 0 ? totalAttacksUsed / totalAttacksAvailable : 0,
    playerStats,
    topByParticipation: sortedByParticipation.slice(0, 5),
    topByStars: sortedByStars.slice(0, 5),
    topByThreeStarRate: sortedByThreeStarRate.slice(0, 5),
    lowParticipation,
    missedAttacks,
  };
}

/**
 * Get CWL stats for a single player across all seasons
 */
export async function getPlayerCwlStats(clanTag: string, playerTag: string): Promise<CwlPlayerStats | null> {
  const clanStats = await getCwlStats({ clanTag, playerTag });
  if (!clanStats) return null;
  
  const stats = clanStats.playerStats.find(p => p.playerTag === normalizeTag(playerTag));
  return stats || null;
}

/**
 * Calculate a CWL reliability score (0-100) for leadership assessment
 * 
 * Factors:
 * - Attack participation rate (50%)
 * - Average stars (30%)
 * - Three-star rate (20%)
 */
export function calculateCwlReliabilityScore(stats: CwlPlayerStats | null): number {
  if (!stats || stats.attacksAvailable === 0) {
    return 50; // Neutral score if no CWL data
  }
  
  // Participation: 0-100 scaled, 50% weight
  const participationScore = Math.min(stats.participationRate * 100, 100) * 0.5;
  
  // Average stars: 0-3 scaled to 0-100, 30% weight
  const starsScore = Math.min((stats.avgStars / 3) * 100, 100) * 0.3;
  
  // Three-star rate: 0-100, 20% weight
  const threeStarScore = Math.min(stats.threeStarRate * 100, 100) * 0.2;
  
  return Math.round(participationScore + starsScore + threeStarScore);
}

/**
 * Get a human-readable summary of player's CWL performance
 */
export function summarizeCwlPerformance(stats: CwlPlayerStats | null): string {
  if (!stats || stats.attacksAvailable === 0) {
    return 'No CWL participation data';
  }
  
  const parts: string[] = [];
  
  // Participation
  const participationPct = Math.round(stats.participationRate * 100);
  if (participationPct === 100) {
    parts.push('✅ Perfect attack usage');
  } else if (participationPct >= 80) {
    parts.push(`✅ ${participationPct}% attack usage`);
  } else if (participationPct >= 50) {
    parts.push(`⚠️ ${participationPct}% attack usage`);
  } else {
    parts.push(`❌ ${participationPct}% attack usage (${stats.attacksAvailable - stats.attacksUsed} missed)`);
  }
  
  // Performance
  if (stats.attacksUsed > 0) {
    const avgStars = stats.avgStars.toFixed(1);
    const threeStarPct = Math.round(stats.threeStarRate * 100);
    parts.push(`${avgStars}★ avg (${threeStarPct}% triples)`);
  }
  
  // Matchups
  if (stats.hitsUp > 0) {
    parts.push(`${stats.hitsUp} hits up`);
  }
  
  return parts.join(' • ');
}
