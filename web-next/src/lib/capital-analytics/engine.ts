// Capital Analytics Engine
// Advanced analytics and metrics for capital raid performance

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';

export interface CapitalAnalyticsMetrics {
  playerTag: string;
  playerName: string;
  
  // Loot per Attack
  averageLootPerAttack: number;
  lootEfficiency: number; // 0-100 compared to clan average
  totalLoot: number;
  totalAttacks: number;
  
  // Carry Score
  carryScore: number; // 0-100 based on bonus attacks and loot contribution
  bonusAttacksEarned: number;
  bonusAttackRate: number; // Bonus attacks / total weekends
  contributionToTotalLoot: number; // Percentage of clan total
  
  // Participation Tracking
  participationRate: number; // Weekends participated / total weekends
  weekendsParticipated: number;
  totalWeekends: number;
  consecutiveWeekends: number;
  missedWeekends: number[];
  
  // District Performance (simplified - would need attack log for full analysis)
  averageDestruction: number;
  
  // ROI Analysis
  capitalGoldContributed: number; // Would need to fetch from member snapshots
  netContribution: number; // Loot gained - capital gold contributed
  roiScore: number; // 0-100 based on efficiency
  
  // Overall Performance
  overallScore: number; // 0-100 weighted composite
  performanceTier: 'excellent' | 'good' | 'average' | 'poor' | 'needs_improvement';
}

export interface CapitalAnalyticsResult {
  clanTag: string;
  periodStart: Date;
  periodEnd: Date;
  totalWeekends: number;
  weekendsWithParticipants?: number; // Weekends that have participant data
  metrics: CapitalAnalyticsMetrics[];
  clanAverages: {
    averageLootPerAttack: number;
    averageCarryScore: number;
    averageParticipation: number;
    averageROI: number;
    averageOverallScore: number;
  };
}

export interface CapitalAnalyticsOptions {
  clanTag: string;
  playerTag?: string; // If provided, only calculate for this player
  weeksBack?: number; // Default: 12 weeks (3 months)
  minWeekends?: number; // Minimum weekends required for metrics (default: 3)
}

/**
 * Calculate comprehensive capital analytics metrics for a clan or player
 */
export async function calculateCapitalAnalytics(
  options: CapitalAnalyticsOptions
): Promise<CapitalAnalyticsResult> {
  const { clanTag, playerTag, weeksBack = 12, minWeekends = 3 } = options;
  const normalizedClanTag = normalizeTag(clanTag);
  
  if (!normalizedClanTag) {
    throw new Error(`Invalid clan tag: ${clanTag}`);
  }

  const supabase = getSupabaseAdminClient();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000);

  // Fetch capital raid weekends in the period
  const { data: weekends, error: weekendsError } = await supabase
    .from('capital_raid_weekends')
    .select(`
      id,
      weekend_id,
      start_time,
      end_time,
      state,
      total_loot,
      total_destruction,
      season_id,
      capital_raid_seasons!inner(clan_tag)
    `)
    .eq('capital_raid_seasons.clan_tag', normalizedClanTag)
    .gte('start_time', periodStart.toISOString())
    .lte('start_time', periodEnd.toISOString())
    .order('start_time', { ascending: false });

  if (weekendsError) {
    throw new Error(`Failed to fetch weekends: ${weekendsError.message}`);
  }

  if (!weekends || weekends.length < minWeekends) {
    return {
      clanTag: normalizedClanTag,
      periodStart,
      periodEnd,
      totalWeekends: weekends?.length || 0,
      metrics: [],
      clanAverages: {
        averageLootPerAttack: 0,
        averageCarryScore: 0,
        averageParticipation: 0,
        averageROI: 0,
        averageOverallScore: 0,
      },
    };
  }

  const weekendIds = weekends.map(w => w.id);

  // Fetch all participants for these weekends
  const participantQuery = supabase
    .from('capital_raid_participants')
    .select('weekend_id, player_tag, player_name, attack_count, total_loot, bonus_loot, capital_resources_looted')
    .in('weekend_id', weekendIds);

  if (playerTag) {
    participantQuery.eq('player_tag', normalizeTag(playerTag));
  }

  const { data: participants, error: participantsError } = await participantQuery;

  if (participantsError) {
    throw new Error(`Failed to fetch participants: ${participantsError.message}`);
  }

  console.log(`[CapitalAnalytics] Found ${weekends.length} weekends and ${participants?.length || 0} participants for clan ${normalizedClanTag}`);

  // Group data by player
  const playerData = new Map<string, {
    name: string;
    weekends: Set<string>;
    totalAttacks: number;
    totalLoot: number;
    bonusAttacks: number;
    weekendParticipations: Array<{
      weekendId: string;
      startTime: Date;
      attacks: number;
      loot: number;
      bonusLoot: number;
    }>;
  }>();

  // Process participants
  participants?.forEach(participant => {
    const tag = participant.player_tag;
    if (!tag) return;

    if (!playerData.has(tag)) {
      playerData.set(tag, {
        name: participant.player_name || tag,
        weekends: new Set(),
        totalAttacks: 0,
        totalLoot: 0,
        bonusAttacks: 0,
        weekendParticipations: [],
      });
    }

    const data = playerData.get(tag)!;
    const weekend = weekends.find(w => w.id === participant.weekend_id);
    if (!weekend) return;

    data.weekends.add(participant.weekend_id);
    data.totalAttacks += participant.attack_count || 0;
    data.totalLoot += participant.total_loot || 0;
    if (participant.bonus_loot && participant.bonus_loot > 0) {
      data.bonusAttacks += 1; // Count weekends with bonus attacks
    }

    data.weekendParticipations.push({
      weekendId: participant.weekend_id,
      startTime: weekend.start_time ? new Date(weekend.start_time) : new Date(),
      attacks: participant.attack_count || 0,
      loot: participant.total_loot || 0,
      bonusLoot: participant.bonus_loot || 0,
    });
  });

  // Filter weekends to only those with participants
  const weekendsWithParticipants = new Set(participants?.map(p => p.weekend_id) || []);
  const validWeekends = weekends.filter(w => weekendsWithParticipants.has(w.id));
  
  if (validWeekends.length < minWeekends) {
    console.log(`[CapitalAnalytics] Only ${validWeekends.length} weekends have participants, need ${minWeekends}. Note: Clash API only returns member data for the current/ongoing weekend.`);
    return {
      clanTag: normalizedClanTag,
      periodStart,
      periodEnd,
      totalWeekends: weekends.length,
      weekendsWithParticipants: validWeekends.length,
      metrics: [],
      clanAverages: {
        averageLootPerAttack: 0,
        averageCarryScore: 0,
        averageParticipation: 0,
        averageROI: 0,
        averageOverallScore: 0,
      },
    };
  }

  // Calculate metrics for each player
  const metrics: CapitalAnalyticsMetrics[] = [];
  const totalWeekends = validWeekends.length;
  const clanTotalLoot = validWeekends.reduce((sum, w) => sum + (w.total_loot || 0), 0);

  for (const [tag, data] of playerData.entries()) {
    if (data.weekends.size < minWeekends) continue;

    const weekendsParticipated = data.weekends.size;
    const participationRate = totalWeekends > 0 ? weekendsParticipated / totalWeekends : 0;

    // Loot per Attack
    const averageLootPerAttack = data.totalAttacks > 0 ? data.totalLoot / data.totalAttacks : 0;

    // Carry Score (based on bonus attacks and loot contribution)
    const bonusAttackRate = totalWeekends > 0 ? data.bonusAttacks / totalWeekends : 0;
    const contributionToTotalLoot = clanTotalLoot > 0 ? (data.totalLoot / clanTotalLoot) * 100 : 0;
    
    // Carry score = bonus attacks (40%) + loot contribution (40%) + participation (20%)
    const carryScore = Math.min(100, Math.round(
      bonusAttackRate * 40 +
      Math.min(contributionToTotalLoot / 10, 1) * 40 + // Normalize contribution (max 10% = 100)
      participationRate * 20
    ));

    // Calculate consecutive weekends
    const sortedWeekends = [...data.weekendParticipations].sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    );
    
    let consecutiveWeekends = 0;
    let maxConsecutive = 0;
    let currentStreak = 0;
    const missedWeekends: number[] = [];

    // Check for consecutive participation
    for (let i = 0; i < weekends.length; i++) {
      const weekend = weekends[i];
      const participated = data.weekends.has(weekend.id);
      
      if (participated) {
        currentStreak++;
        maxConsecutive = Math.max(maxConsecutive, currentStreak);
      } else {
        if (currentStreak > 0) {
          // End of streak, record missed weekend
          missedWeekends.push(i);
        }
        currentStreak = 0;
      }
    }
    consecutiveWeekends = maxConsecutive;

    // ROI Analysis (simplified - would need capital contributions from member snapshots)
    // For now, estimate based on loot vs. expected contribution
    const expectedContribution = weekendsParticipated * 50000; // Rough estimate
    const netContribution = data.totalLoot - expectedContribution;
    const roiScore = expectedContribution > 0
      ? Math.min(100, Math.max(0, (netContribution / expectedContribution) * 100 + 50))
      : 50; // Default if no expected contribution

    // Overall Score (weighted composite)
    const overallScore = Math.round(
      (averageLootPerAttack / 10000) * 30 + // Normalize loot per attack (max ~10k)
      carryScore * 0.30 +
      participationRate * 100 * 0.25 +
      roiScore * 0.15
    );

    // Performance tier
    let performanceTier: 'excellent' | 'good' | 'average' | 'poor' | 'needs_improvement';
    if (overallScore >= 80) performanceTier = 'excellent';
    else if (overallScore >= 65) performanceTier = 'good';
    else if (overallScore >= 50) performanceTier = 'average';
    else if (overallScore >= 35) performanceTier = 'poor';
    else performanceTier = 'needs_improvement';

    // Calculate average destruction (would need attack log for accurate calculation)
    const averageDestruction = 0; // Placeholder - would calculate from attack log

    metrics.push({
      playerTag: tag,
      playerName: data.name,
      averageLootPerAttack: Math.round(averageLootPerAttack),
      lootEfficiency: 0, // Will calculate after clan average is known
      totalLoot: data.totalLoot,
      totalAttacks: data.totalAttacks,
      carryScore,
      bonusAttacksEarned: data.bonusAttacks,
      bonusAttackRate: Math.round(bonusAttackRate * 100) / 100,
      contributionToTotalLoot: Math.round(contributionToTotalLoot * 100) / 100,
      participationRate: Math.round(participationRate * 100) / 100,
      weekendsParticipated,
      totalWeekends,
      consecutiveWeekends,
      missedWeekends: [],
      averageDestruction,
      capitalGoldContributed: expectedContribution, // Estimated
      netContribution: Math.round(netContribution),
      roiScore: Math.round(roiScore),
      overallScore,
      performanceTier,
    });
  }

  // Calculate clan averages
  const averageLootPerAttack = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.averageLootPerAttack, 0) / metrics.length
    : 0;
  const averageCarryScore = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.carryScore, 0) / metrics.length
    : 0;
  const averageParticipation = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.participationRate, 0) / metrics.length
    : 0;
  const averageROI = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.roiScore, 0) / metrics.length
    : 0;
  const averageOverallScore = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.overallScore, 0) / metrics.length
    : 0;

  // Calculate loot efficiency relative to clan average
  metrics.forEach(metric => {
    metric.lootEfficiency = averageLootPerAttack > 0
      ? Math.round((metric.averageLootPerAttack / averageLootPerAttack) * 100)
      : 100;
  });

  // Sort by overall score (best first)
  metrics.sort((a, b) => b.overallScore - a.overallScore);

  return {
    clanTag: normalizedClanTag,
    periodStart,
    periodEnd,
    totalWeekends,
    metrics,
    clanAverages: {
      averageLootPerAttack: Math.round(averageLootPerAttack),
      averageCarryScore: Math.round(averageCarryScore),
      averageParticipation: Math.round(averageParticipation * 100) / 100,
      averageROI: Math.round(averageROI),
      averageOverallScore: Math.round(averageOverallScore),
    },
  };
}

