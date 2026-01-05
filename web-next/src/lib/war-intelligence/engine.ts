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
  defensiveHoldRate: number | null; // Defenses survived / attacks received
  averageDestructionAllowed: number | null;
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
  weeklySeries?: Array<{
    weekStart: string;
    aei: number;
    overall: number;
    attacks: number;
    wars: number;
  }>;
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
  latestWarSummary?: WarSummary | null;
}

export interface WarSummary {
  warId: string;
  startTime: Date | null;
  endTime: Date | null;
  teamSize: number | null;
  result: string | null;
  clanStars: number;
  opponentStars: number;
  attacksUsed: number;
  attacksAvailable: number;
  averageStars: number;
  missedAttacks: number;
  topAttackers: Array<{
    playerTag: string;
    playerName: string;
    totalStars: number;
    averageDestruction: number;
    attacks: number;
  }>;
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
    .in('war_type', ['regular', 'cwl', 'league'])
    .gte('battle_start', periodStart.toISOString())
    .lte('battle_start', periodEnd.toISOString())
    .order('battle_start', { ascending: false });

  if (warsError) {
    throw new Error(`Failed to fetch wars: ${warsError.message}`);
  }

  const latestWarSummary =
    wars && wars.length
      ? await buildLatestWarSummary(wars[0], normalizedClanTag, supabase)
      : null;

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
      latestWarSummary,
    };
  }

  const warIds = wars.map(w => w.id);
  const weekKeyForDate = (date: Date) => {
    const utcDay = date.getUTCDay();
    const diff = utcDay === 0 ? -6 : 1 - utcDay;
    const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
    return weekStart.toISOString().slice(0, 10);
  };
  const warWeekMap = new Map<string, string>();
  wars.forEach((war) => {
    if (!war.battle_start) return;
    const start = new Date(war.battle_start);
    if (Number.isNaN(start.getTime())) return;
    warWeekMap.set(war.id, weekKeyForDate(start));
  });
  const warWindows = wars.map((war) => ({
    id: war.id,
    start: war.battle_start ? new Date(war.battle_start) : null,
    end: war.battle_end ? new Date(war.battle_end) : null,
  }));

  // Fetch all war members for these wars
  const memberQuery = supabase
    .from('clan_war_members')
    .select('war_id, player_tag, player_name, attacks, stars, destruction, defense_count, defense_destruction, town_hall_level, raw')
    .in('war_id', warIds);

  if (!playerTag) {
    memberQuery.eq('clan_tag', normalizedClanTag);
  }

  if (playerTag) {
    memberQuery.eq('player_tag', normalizeTag(playerTag));
  }

  const { data: warMembers, error: membersError } = await memberQuery;

  if (membersError) {
    throw new Error(`Failed to fetch war members: ${membersError.message}`);
  }

  // Fetch all attacks for these wars
  const attacksQuery = supabase
    .from('clan_war_attacks')
    .select('war_id, attacker_tag, attacker_name, defender_tag, stars, destruction, attack_time, order_index')
    .in('war_id', warIds)
    .eq('attacker_clan_tag', normalizedClanTag)
    .order('attack_time', { ascending: true });

  if (playerTag) {
    attacksQuery.eq('attacker_tag', normalizeTag(playerTag));
  }

  const { data: attacks, error: attacksError } = await attacksQuery;

  if (attacksError) {
    throw new Error(`Failed to fetch attacks: ${attacksError.message}`);
  }

  // Fallback: if player-specific query returns no attacks, try activity events
  let activityAttacks: Array<{
    warId: string | null;
    attackerTag: string;
    attackerName: string | null;
    stars: number;
    destruction: number;
    attackTime: Date | null;
    orderIndex: number;
  }> = [];

  if (playerTag && (!attacks || attacks.length === 0)) {
    const { data: activityEvents } = await supabase
      .from('player_activity_events')
      .select('player_tag, value, occurred_at, metadata')
      .eq('clan_tag', normalizedClanTag)
      .eq('player_tag', normalizeTag(playerTag))
      .eq('event_type', 'war_attack')
      .gte('occurred_at', periodStart.toISOString())
      .lte('occurred_at', periodEnd.toISOString());

    activityAttacks = (activityEvents || []).map((event: any) => {
      const occurredAt = event.occurred_at ? new Date(event.occurred_at) : null;
      const orderIndex = Number(event?.metadata?.order_index ?? 0) || 0;
      const stars = Number(event?.value ?? 0) || 0;
      const destruction = Number(event?.metadata?.destruction ?? 0) || 0;
      const warMatch = occurredAt
        ? warWindows.find((war) => war.start && war.end && occurredAt >= war.start && occurredAt <= war.end)
        : null;
      return {
        warId: warMatch?.id ?? null,
        attackerTag: normalizeTag(event.player_tag) || event.player_tag,
        attackerName: null,
        stars,
        destruction,
        attackTime: occurredAt,
        orderIndex,
      };
    });
  }

  // Fetch defender TH levels for matchup analysis
  const defenderTags = new Set(attacks?.map(a => a.defender_tag) || []);
  const { data: defenders, error: defendersError } = await supabase
    .from('clan_war_members')
    .select('war_id, player_tag, town_hall_level')
    .in('war_id', warIds)
    .in('player_tag', Array.from(defenderTags))
    .or('is_home.eq.false,is_home.is.null');

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

  const weeklyAggByPlayer = new Map<string, Map<string, {
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
  }>>();

  const getWeeklyAgg = (tag: string, weekKey: string) => {
    if (!weeklyAggByPlayer.has(tag)) {
      weeklyAggByPlayer.set(tag, new Map());
    }
    const bucket = weeklyAggByPlayer.get(tag)!;
    if (!bucket.has(weekKey)) {
      bucket.set(weekKey, {
        wars: new Set(),
        totalAttacks: 0,
        totalStars: 0,
        totalDestruction: 0,
        totalDefenses: 0,
        totalDefenseDestruction: 0,
        attacks: [],
      });
    }
    return bucket.get(weekKey)!;
  };

  // Process war members
  warMembers?.forEach(member => {
    const tag = member.player_tag;
    if (!tag) return;
    const rawAttacks = Array.isArray((member as any)?.raw?.attacks) ? (member as any).raw.attacks.length : 0;
    const attacksValue = Number(member.attacks);
    let attacksCount = Number.isFinite(attacksValue) && attacksValue > 0 ? attacksValue : rawAttacks;
    if (!attacksCount && (member.stars ?? 0) > 0) {
      attacksCount = 1;
    }

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
    data.totalAttacks += attacksCount || 0;
    data.totalStars += member.stars || 0;
    data.totalDestruction += member.destruction || 0;
    data.totalDefenses += member.defense_count || 0;
    data.totalDefenseDestruction += member.defense_destruction || 0;

    const weekKey = warWeekMap.get(member.war_id);
    if (weekKey) {
      const weekly = getWeeklyAgg(tag, weekKey);
      weekly.wars.add(member.war_id);
      weekly.totalAttacks += attacksCount || 0;
      weekly.totalStars += member.stars || 0;
      weekly.totalDestruction += member.destruction || 0;
      weekly.totalDefenses += member.defense_count || 0;
      weekly.totalDefenseDestruction += member.defense_destruction || 0;
    }
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

    const fallbackTime = attack.attack_time ? new Date(attack.attack_time) : null;
    const weekKey = warWeekMap.get(warId) || (fallbackTime ? weekKeyForDate(fallbackTime) : null);
    if (weekKey) {
      const weekly = getWeeklyAgg(tag, weekKey);
      weekly.attacks.push({
        warId,
        stars: attack.stars || 0,
        destruction: attack.destruction || 0,
        attackTime: attack.attack_time ? new Date(attack.attack_time) : null,
        orderIndex: attack.order_index || 0,
        defenderTH,
        attackerTH,
      });
    }
  });

  // Process fallback activity attacks for player-specific queries
  activityAttacks.forEach((attack) => {
    const tag = attack.attackerTag;
    if (!tag || !playerData.has(tag)) return;

    const data = playerData.get(tag)!;
    if (attack.warId) {
      data.wars.add(attack.warId);
    }
    data.totalAttacks += attack.stars ? 1 : 1;
    data.totalStars += attack.stars || 0;
    data.totalDestruction += attack.destruction || 0;
    data.attacks.push({
      warId: attack.warId || 'activity',
      stars: attack.stars || 0,
      destruction: attack.destruction || 0,
      attackTime: attack.attackTime,
      orderIndex: attack.orderIndex || 0,
    });

    const fallbackTime = attack.attackTime;
    const weekKey = attack.warId ? warWeekMap.get(attack.warId) : (fallbackTime ? weekKeyForDate(fallbackTime) : null);
    if (weekKey) {
      const weekly = getWeeklyAgg(tag, weekKey);
      weekly.attacks.push({
        warId: attack.warId || 'activity',
        stars: attack.stars || 0,
        destruction: attack.destruction || 0,
        attackTime: attack.attackTime,
        orderIndex: attack.orderIndex || 0,
      });
    }
  });

  const computeWarScores = (data: {
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
  }) => {
    const totalWars = data.wars.size;
    const totalAttacks = data.totalAttacks || data.attacks.length;
    const totalStars = data.totalStars || data.attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0);
    const totalDestruction = data.totalDestruction || data.attacks.reduce((sum, attack) => sum + (attack.destruction || 0), 0);
    if (!totalAttacks) return null;

    const averageStarsPerAttack = totalStars / totalAttacks;
    const averageDestructionPerAttack = totalDestruction / totalAttacks;
    const cleanupAttacks = data.attacks.filter(a =>
      a.attackerTH && a.defenderTH && a.attackerTH > a.defenderTH
    ).length;
    const cleanupEfficiency = totalAttacks > 0 ? cleanupAttacks / totalAttacks : 0;
    const sortedAttacks = [...data.attacks].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const totalAttackCount = sortedAttacks.length;
    const lastQuarterStart = Math.floor(totalAttackCount * 0.75);
    const clutchAttacks = sortedAttacks.slice(lastQuarterStart).filter(a => a.stars >= 2).length;
    const attackEfficiencyIndex = Math.min(100, Math.round(
      (averageStarsPerAttack / 3) * 60 +
      (averageDestructionPerAttack / 100) * 30 +
      cleanupEfficiency * 10
    ));
    const expectedAttacks = totalWars * 2;
    const participationRate = expectedAttacks > 0 ? totalAttacks / expectedAttacks : 0;
    const consistencyScore = Math.min(100, Math.round(participationRate * 100));
    const defenseAvailable = data.totalDefenses > 0;
    const defensiveHoldRate = defenseAvailable
      ? 1 - (data.totalDefenseDestruction / (data.totalDefenses * 100))
      : null;
    const timingScores = sortedAttacks.map(a => {
      if (!a.orderIndex || totalAttackCount === 0) return 50;
      const percentile = (a.orderIndex / totalAttackCount) * 100;
      if (percentile >= 25 && percentile <= 75) return 100;
      return 75;
    });
    const attackTimingScore = timingScores.length > 0
      ? timingScores.reduce((sum, s) => sum + s, 0) / timingScores.length
      : 50;
    const baseWeight = 0.40 + 0.30 + 0.10 + (defenseAvailable ? 0.20 : 0);
    const overallScore = Math.round(
      attackEfficiencyIndex * (0.40 / baseWeight) +
      consistencyScore * (0.30 / baseWeight) +
      (defensiveHoldRate != null ? (defensiveHoldRate * 100) : 0) * (defenseAvailable ? (0.20 / baseWeight) : 0) +
      attackTimingScore * (0.10 / baseWeight)
    );

    return { attackEfficiencyIndex, overallScore, totalAttacks, totalWars };
  };

  // Calculate metrics for each player
  const metrics: WarIntelligenceMetrics[] = [];

  for (const [tag, data] of playerData.entries()) {
    if (data.wars.size < minWars) continue;

    if (data.attacks.length && (!data.totalAttacks || !data.totalStars || !data.totalDestruction)) {
      const attacksCount = data.attacks.length;
      const starsFromAttacks = data.attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0);
      const destructionFromAttacks = data.attacks.reduce((sum, attack) => sum + (attack.destruction || 0), 0);
      if (!data.totalAttacks) data.totalAttacks = attacksCount;
      if (!data.totalStars) data.totalStars = starsFromAttacks;
      if (!data.totalDestruction) data.totalDestruction = destructionFromAttacks;
    }

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
    const defenseAvailable = data.totalDefenses > 0;
    const defensiveHoldRate = defenseAvailable
      ? 1 - (data.totalDefenseDestruction / (data.totalDefenses * 100))
      : null;
    
    const averageDestructionAllowed = defenseAvailable
      ? data.totalDefenseDestruction / data.totalDefenses
      : null;

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
    const baseWeight = 0.40 + 0.30 + 0.10 + (defenseAvailable ? 0.20 : 0);
    const overallScore = Math.round(
      attackEfficiencyIndex * (0.40 / baseWeight) +
      consistencyScore * (0.30 / baseWeight) +
      (defensiveHoldRate != null ? (defensiveHoldRate * 100) : 0) * (defenseAvailable ? (0.20 / baseWeight) : 0) +
      attackTimingScore * (0.10 / baseWeight)
    );

    // Performance tier
    let performanceTier: 'excellent' | 'good' | 'average' | 'poor' | 'needs_coaching';
    if (overallScore >= 80) performanceTier = 'excellent';
    else if (overallScore >= 65) performanceTier = 'good';
    else if (overallScore >= 50) performanceTier = 'average';
    else if (overallScore >= 35) performanceTier = 'poor';
    else performanceTier = 'needs_coaching';

    const weeklySeries = weeklyAggByPlayer.get(tag);
    const weeklyData = weeklySeries
      ? Array.from(weeklySeries.entries())
          .map(([weekStart, weekAgg]) => {
            const scores = computeWarScores(weekAgg);
            if (!scores) return null;
            return {
              weekStart,
              aei: scores.attackEfficiencyIndex,
              overall: scores.overallScore,
              attacks: scores.totalAttacks,
              wars: scores.totalWars,
            };
          })
          .filter(Boolean)
          .sort((a, b) => (a!.weekStart < b!.weekStart ? -1 : 1))
      : [];

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
      defensiveHoldRate: defensiveHoldRate != null ? Math.round(defensiveHoldRate * 100) / 100 : null,
      averageDestructionAllowed: averageDestructionAllowed != null ? Math.round(averageDestructionAllowed * 100) / 100 : null,
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
      weeklySeries: weeklyData.length ? (weeklyData as Array<{ weekStart: string; aei: number; overall: number; attacks: number; wars: number }>) : undefined,
    });
  }

  // Calculate clan averages
  const averageAEI = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.attackEfficiencyIndex, 0) / metrics.length
    : 0;
  const averageConsistency = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.consistencyScore, 0) / metrics.length
    : 0;
  const holdRates = metrics.map((m) => m.defensiveHoldRate).filter((value): value is number => typeof value === 'number');
  const averageHoldRate = holdRates.length > 0
    ? holdRates.reduce((sum, value) => sum + value, 0) / holdRates.length
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
    latestWarSummary,
  };
}

async function buildLatestWarSummary(
  war: any,
  clanTag: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<WarSummary> {
  const [membersRes, attacksRes] = await Promise.all([
    supabase
      .from('clan_war_members')
      .select('player_tag, player_name, attacks, stars, destruction')
      .eq('war_id', war.id)
      .eq('is_home', true),
    supabase
      .from('clan_war_attacks')
      .select('attacker_tag, attacker_name, stars, destruction')
      .eq('war_id', war.id)
      .eq('attacker_clan_tag', clanTag),
  ]);

  const members = membersRes.data ?? [];
  const attacks = attacksRes.data ?? [];
  const attacksUsed = members.reduce((sum, member) => sum + (member.attacks || 0), 0);
  const attacksAvailable = (war.team_size || members.length) * 2;
  const attackStats = new Map<
    string,
    { playerTag: string; playerName: string; stars: number; destruction: number; count: number }
  >();

  attacks.forEach((attack) => {
    if (!attack.attacker_tag) return;
    const entry =
      attackStats.get(attack.attacker_tag) ||
      {
        playerTag: attack.attacker_tag,
        playerName: attack.attacker_name || attack.attacker_tag,
        stars: 0,
        destruction: 0,
        count: 0,
      };
    entry.stars += attack.stars || 0;
    entry.destruction += attack.destruction || 0;
    entry.count += 1;
    attackStats.set(attack.attacker_tag, entry);
  });

  const topAttackers = Array.from(attackStats.values())
    .sort((a, b) => b.stars - a.stars || b.destruction - a.destruction)
    .slice(0, 5)
    .map((entry) => ({
      playerTag: entry.playerTag,
      playerName: entry.playerName,
      totalStars: entry.stars,
      averageDestruction: entry.count > 0 ? Math.round((entry.destruction / entry.count) * 10) / 10 : 0,
      attacks: entry.count,
    }));

  const totalStars = attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0);
  const averageStars = attacksUsed > 0 ? Math.round((totalStars / attacksUsed) * 100) / 100 : 0;
  const missedAttacks = Math.max(attacksAvailable - attacksUsed, 0);

  return {
    warId: war.id,
    startTime: war.battle_start ? new Date(war.battle_start) : null,
    endTime: war.battle_end ? new Date(war.battle_end) : null,
    teamSize: war.team_size ?? null,
    result: war.result ?? null,
    clanStars: war.clan_stars ?? 0,
    opponentStars: war.opponent_stars ?? 0,
    attacksUsed,
    attacksAvailable,
    averageStars,
    missedAttacks,
    topAttackers,
  };
}
