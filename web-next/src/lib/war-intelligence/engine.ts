// War Performance Intelligence Engine
// Advanced analytics and metrics for war performance

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';

export interface WarIntelligenceMetrics {
  playerTag: string;
  playerName: string;
  
  // Attack Efficiency Index (AEI)
  attackEfficiencyIndex: number; // 0-100
  averageStarsPerAttack: number;
  averageDestructionPerAttack: number;
  cleanupEfficiency: number; // Attacks on lower THs / total attacks
  clutchFactor: number; // Late-war deciding attacks
  
  // Contribution Consistency Score
  participationRate: number; // Attacks used / attacks available
  consistencyScore: number; // 0-100 based on participation across wars
  consecutiveWarsWithAttacks: number;
  
  // Defensive Hold Rate
  defensiveHoldRate: number; // Defenses survived / attacks received
  averageDestructionAllowed: number;
  baseStrengthScore: number; // TH level + hero levels
  
  // Strategy Failure Detection
  failedAttacks: number; // 0-1 stars on equal/higher TH
  attackTimingScore: number; // 0-100 based on attack timing
  targetSelectionQuality: number; // 0-100 based on TH matchup success
  
  // Overall Performance
  overallScore: number; // 0-100 weighted composite
  performanceTier: 'excellent' | 'good' | 'average' | 'poor' | 'needs_coaching';
  
  // War History
  totalWars: number;
  totalAttacks: number;
  totalStars: number;
  totalDestruction: number;
  totalDefenses: number;
  totalDefenseDestruction: number;
}

export interface WarIntelligenceResult {
  clanTag: string;
  periodStart: Date;
  periodEnd: Date;
  totalWars: number;
  metrics: WarIntelligenceMetrics[];
  clanAverages: {
    averageAEI: number;
    averageConsistency: number;
    averageHoldRate: number;
    averageOverallScore: number;
  };
}

export interface WarIntelligenceOptions {
  clanTag: string;
  playerTag?: string; // If provided, only calculate for this player
  daysBack?: number; // Default: 90 days
  minWars?: number; // Minimum wars required for metrics (default: 3)
}

/**
 * Calculate comprehensive war intelligence metrics for a clan or player
 */
export async function calculateWarIntelligence(
  options: WarIntelligenceOptions
): Promise<WarIntelligenceResult> {
  const { clanTag, playerTag, daysBack = 90, minWars = 3 } = options;
  const normalizedClanTag = normalizeTag(clanTag);
  
  if (!normalizedClanTag) {
    throw new Error(`Invalid clan tag: ${clanTag}`);
  }

  const supabase = getSupabaseAdminClient();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // Fetch wars in the period
  const { data: wars, error: warsError } = await supabase
    .from('clan_wars')
    .select('id, battle_start, battle_end, team_size, result, clan_stars, opponent_stars')
    .eq('clan_tag', normalizedClanTag)
    .eq('war_type', 'regular')
    .gte('battle_start', periodStart.toISOString())
    .lte('battle_start', periodEnd.toISOString())
    .order('battle_start', { ascending: false });

  if (warsError) {
    throw new Error(`Failed to fetch wars: ${warsError.message}`);
  }

  if (!wars || wars.length < minWars) {
    return {
      clanTag: normalizedClanTag,
      periodStart,
      periodEnd,
      totalWars: wars?.length || 0,
      metrics: [],
      clanAverages: {
        averageAEI: 0,
        averageConsistency: 0,
        averageHoldRate: 0,
        averageOverallScore: 0,
      },
    };
  }

  const warIds = wars.map(w => w.id);

  // Fetch all war members for these wars
  const memberQuery = supabase
    .from('clan_war_members')
    .select('war_id, player_tag, player_name, attacks, stars, destruction, defense_count, defense_destruction, town_hall_level')
    .in('war_id', warIds)
    .eq('is_home', true);

  if (playerTag) {
    memberQuery.eq('player_tag', normalizeTag(playerTag));
  }

  const { data: warMembers, error: membersError } = await memberQuery;

  if (membersError) {
    throw new Error(`Failed to fetch war members: ${membersError.message}`);
  }

  // Fetch all attacks for these wars
  const { data: attacks, error: attacksError } = await supabase
    .from('clan_war_attacks')
    .select('war_id, attacker_tag, attacker_name, defender_tag, stars, destruction, attack_time, order_index')
    .in('war_id', warIds)
    .eq('attacker_clan_tag', normalizedClanTag)
    .order('attack_time', { ascending: true });

  if (attacksError) {
    throw new Error(`Failed to fetch attacks: ${attacksError.message}`);
  }

  // Fetch defender TH levels for matchup analysis
  const defenderTags = new Set(attacks?.map(a => a.defender_tag) || []);
  const { data: defenders, error: defendersError } = await supabase
    .from('clan_war_members')
    .select('war_id, player_tag, town_hall_level')
    .in('war_id', warIds)
    .in('player_tag', Array.from(defenderTags))
    .eq('is_home', false);

  if (defendersError) {
    console.warn(`Failed to fetch defender data: ${defendersError.message}`);
  }

  // Build defender TH lookup map
  const defenderTHMap = new Map<string, number>();
  defenders?.forEach(d => {
    const key = `${d.war_id}:${d.player_tag}`;
    if (d.town_hall_level) {
      defenderTHMap.set(key, d.town_hall_level);
    }
  });

  // Group data by player
  const playerData = new Map<string, {
    name: string;
    wars: Set<string>;
    totalAttacks: number;
    totalStars: number;
    totalDestruction: number;
    totalDefenses: number;
    totalDefenseDestruction: number;
    attacks: Array<{
      warId: string;
      stars: number;
      destruction: number;
      attackTime: Date | null;
      orderIndex: number;
      defenderTH?: number;
      attackerTH?: number;
    }>;
    consecutiveWars: number;
    maxConsecutive: number;
  }>();

  // Process war members
  warMembers?.forEach(member => {
    const tag = member.player_tag;
    if (!tag) return;

    if (!playerData.has(tag)) {
      playerData.set(tag, {
        name: member.player_name || tag,
        wars: new Set(),
        totalAttacks: 0,
        totalStars: 0,
        totalDestruction: 0,
        totalDefenses: 0,
        totalDefenseDestruction: 0,
        attacks: [],
        consecutiveWars: 0,
        maxConsecutive: 0,
      });
    }

    const data = playerData.get(tag)!;
    data.wars.add(member.war_id);
    data.totalAttacks += member.attacks || 0;
    data.totalStars += member.stars || 0;
    data.totalDestruction += member.destruction || 0;
    data.totalDefenses += member.defense_count || 0;
    data.totalDefenseDestruction += member.defense_destruction || 0;
  });

  // Process attacks
  attacks?.forEach(attack => {
    const tag = attack.attacker_tag;
    if (!tag || !playerData.has(tag)) return;

    const data = playerData.get(tag)!;
    const warId = attack.war_id;
    const defenderKey = `${warId}:${attack.defender_tag}`;
    const defenderTH = defenderTHMap.get(defenderKey);
    
    // Get attacker TH from war members
    const attackerMember = warMembers?.find(m => m.war_id === warId && m.player_tag === tag);
    const attackerTH = attackerMember?.town_hall_level;

    data.attacks.push({
      warId,
      stars: attack.stars || 0,
      destruction: attack.destruction || 0,
      attackTime: attack.attack_time ? new Date(attack.attack_time) : null,
      orderIndex: attack.order_index || 0,
      defenderTH,
      attackerTH,
    });
  });

  // Calculate metrics for each player
  const metrics: WarIntelligenceMetrics[] = [];

  for (const [tag, data] of playerData.entries()) {
    if (data.wars.size < minWars) continue;

    const totalWars = data.wars.size;
    const totalAttacks = data.totalAttacks;
    const totalStars = data.totalStars;
    const totalDestruction = data.totalDestruction;

    // Attack Efficiency Index (AEI)
    const averageStarsPerAttack = totalAttacks > 0 ? totalStars / totalAttacks : 0;
    const averageDestructionPerAttack = totalAttacks > 0 ? totalDestruction / totalAttacks : 0;
    
    // Cleanup efficiency (attacks on lower THs)
    const cleanupAttacks = data.attacks.filter(a => 
      a.attackerTH && a.defenderTH && a.attackerTH > a.defenderTH
    ).length;
    const cleanupEfficiency = totalAttacks > 0 ? cleanupAttacks / totalAttacks : 0;

    // Clutch factor (attacks in last 25% of war, with high stars)
    const sortedAttacks = [...data.attacks].sort((a, b) => 
      (a.orderIndex || 0) - (b.orderIndex || 0)
    );
    const totalAttackCount = sortedAttacks.length;
    const lastQuarterStart = Math.floor(totalAttackCount * 0.75);
    const clutchAttacks = sortedAttacks.slice(lastQuarterStart).filter(a => a.stars >= 2).length;
    const clutchFactor = totalAttacks > 0 ? clutchAttacks / totalAttacks : 0;

    // AEI = weighted combination (stars 60%, destruction 30%, cleanup 10%)
    const attackEfficiencyIndex = Math.min(100, Math.round(
      (averageStarsPerAttack / 3) * 60 +
      (averageDestructionPerAttack / 100) * 30 +
      cleanupEfficiency * 10
    ));

    // Contribution Consistency Score
    const expectedAttacks = totalWars * 2; // 2 attacks per war
    const participationRate = expectedAttacks > 0 ? totalAttacks / expectedAttacks : 0;
    
    // Calculate consecutive wars with attacks
    const warIdsArray = Array.from(data.wars).sort();
    let consecutiveWars = 0;
    let maxConsecutive = 0;
    let currentStreak = 0;
    
    for (const warId of warIdsArray) {
      const hasAttacks = data.attacks.some(a => a.warId === warId);
      if (hasAttacks) {
        currentStreak++;
        maxConsecutive = Math.max(maxConsecutive, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    consecutiveWars = maxConsecutive;

    // Consistency score based on participation rate and streak
    const consistencyScore = Math.min(100, Math.round(
      participationRate * 70 +
      (consecutiveWars / totalWars) * 30
    ));

    // Defensive Hold Rate
    const defensiveHoldRate = data.totalDefenses > 0 
      ? 1 - (data.totalDefenseDestruction / (data.totalDefenses * 100))
      : 0.5; // Default if no defenses
    
    const averageDestructionAllowed = data.totalDefenses > 0
      ? data.totalDefenseDestruction / data.totalDefenses
      : 50; // Default

    // Base strength (simplified - would need hero data for full calculation)
    const baseStrengthScore = 50; // Placeholder - would calculate from TH + heroes

    // Strategy Failure Detection
    const failedAttacks = data.attacks.filter(a => 
      a.stars <= 1 && a.attackerTH && a.defenderTH && a.attackerTH >= a.defenderTH
    ).length;
    
    // Attack timing score (earlier attacks = better, but not too early)
    const timingScores = data.attacks.map(a => {
      if (!a.orderIndex) return 50; // Default if no order
      // Ideal: attack in middle 50% of war (not first 25%, not last 25%)
      const percentile = (a.orderIndex / totalAttackCount) * 100;
      if (percentile >= 25 && percentile <= 75) return 100;
      if (percentile < 25) return 75; // Too early
      return 75; // Too late
    });
    const attackTimingScore = timingScores.length > 0
      ? timingScores.reduce((sum, s) => sum + s, 0) / timingScores.length
      : 50;

    // Target selection quality (success rate on equal/higher THs)
    const equalOrHigherAttacks = data.attacks.filter(a => 
      a.attackerTH && a.defenderTH && a.attackerTH <= a.defenderTH
    );
    const successfulEqualOrHigher = equalOrHigherAttacks.filter(a => a.stars >= 2).length;
    const targetSelectionQuality = equalOrHigherAttacks.length > 0
      ? (successfulEqualOrHigher / equalOrHigherAttacks.length) * 100
      : 50;

    // Overall Score (weighted composite)
    const overallScore = Math.round(
      attackEfficiencyIndex * 0.40 +
      consistencyScore * 0.30 +
      (defensiveHoldRate * 100) * 0.20 +
      attackTimingScore * 0.10
    );

    // Performance tier
    let performanceTier: 'excellent' | 'good' | 'average' | 'poor' | 'needs_coaching';
    if (overallScore >= 80) performanceTier = 'excellent';
    else if (overallScore >= 65) performanceTier = 'good';
    else if (overallScore >= 50) performanceTier = 'average';
    else if (overallScore >= 35) performanceTier = 'poor';
    else performanceTier = 'needs_coaching';

    metrics.push({
      playerTag: tag,
      playerName: data.name,
      attackEfficiencyIndex,
      averageStarsPerAttack: Math.round(averageStarsPerAttack * 100) / 100,
      averageDestructionPerAttack: Math.round(averageDestructionPerAttack * 100) / 100,
      cleanupEfficiency: Math.round(cleanupEfficiency * 100) / 100,
      clutchFactor: Math.round(clutchFactor * 100) / 100,
      participationRate: Math.round(participationRate * 100) / 100,
      consistencyScore,
      consecutiveWarsWithAttacks: consecutiveWars,
      defensiveHoldRate: Math.round(defensiveHoldRate * 100) / 100,
      averageDestructionAllowed: Math.round(averageDestructionAllowed * 100) / 100,
      baseStrengthScore,
      failedAttacks,
      attackTimingScore: Math.round(attackTimingScore),
      targetSelectionQuality: Math.round(targetSelectionQuality),
      overallScore,
      performanceTier,
      totalWars,
      totalAttacks,
      totalStars,
      totalDestruction,
      totalDefenses: data.totalDefenses,
      totalDefenseDestruction: Math.round(data.totalDefenseDestruction * 100) / 100,
    });
  }

  // Calculate clan averages
  const averageAEI = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.attackEfficiencyIndex, 0) / metrics.length
    : 0;
  const averageConsistency = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.consistencyScore, 0) / metrics.length
    : 0;
  const averageHoldRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.defensiveHoldRate, 0) / metrics.length
    : 0;
  const averageOverallScore = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.overallScore, 0) / metrics.length
    : 0;

  // Sort by overall score (best first)
  metrics.sort((a, b) => b.overallScore - a.overallScore);

  return {
    clanTag: normalizedClanTag,
    periodStart,
    periodEnd,
    totalWars: wars.length,
    metrics,
    clanAverages: {
      averageAEI: Math.round(averageAEI),
      averageConsistency: Math.round(averageConsistency),
      averageHoldRate: Math.round(averageHoldRate * 100) / 100,
      averageOverallScore: Math.round(averageOverallScore),
    },
  };
}

