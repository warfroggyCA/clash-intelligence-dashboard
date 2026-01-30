// Capital Metrics Calculation Engine
// Analyzes Clan Capital performance and contributions

import type { Member } from './clan-metrics';

export interface CapitalSeason {
  state: string;
  startTime: string;
  endTime: string;
  capitalTotalLoot: number;
  raidsCompleted: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  offensiveReward: number;
  defensiveReward: number;
  members?: CapitalMember[];
}

export interface CapitalMember {
  tag: string;
  name: string;
  attacks: number;
  attackLimit: number;
  bonusAttackLimit: number;
  capitalResourcesLooted: number;
}

export interface CapitalMetrics {
  currentRaid: {
    active: boolean;
    totalLoot: number;
    attacksUsed: number;
    districtsDestroyed: number;
  };
  performance: {
    avgLootPerAttack: number;
    participationRate: number;
    topContributors: CapitalMember[];
  };
}

export interface CapitalAlert {
  type: 'missed_attacks' | 'low_loot' | 'high_performer';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric?: string;
}

export function calculateCapitalMetrics(
  members: Member[],
  capitalData?: any
): CapitalMetrics {
  const currentSeason: CapitalSeason | undefined = capitalData?.[0]; // Assuming array of seasons
  const active = currentSeason?.state === 'ongoing';
  
  const seasonMembers = currentSeason?.members || [];
  const totalLoot = currentSeason?.capitalTotalLoot || 0;
  const attacksUsed = currentSeason?.totalAttacks || 0;
  
  const avgLootPerAttack = attacksUsed > 0 ? Math.round(totalLoot / attacksUsed) : 0;
  
  // Map tags for quick lookup
  const memberMap = new Map(members.map(m => [m.tag, m.name]));
  
  const topContributors = [...seasonMembers]
    .sort((a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted)
    .slice(0, 5)
    .map(m => ({
      ...m,
      name: memberMap.get(m.tag) || m.name
    }));

  return {
    currentRaid: {
      active,
      totalLoot,
      attacksUsed,
      districtsDestroyed: currentSeason?.enemyDistrictsDestroyed || 0
    },
    performance: {
      avgLootPerAttack,
      participationRate: members.length > 0 ? Math.round((seasonMembers.length / members.length) * 100) : 0,
      topContributors
    }
  };
}

export function generateCapitalAlerts(
  metrics: CapitalMetrics,
  thresholds: { capitalContributionMin: number }
): CapitalAlert[] {
  const alerts: CapitalAlert[] = [];

  if (metrics.currentRaid.active) {
    // Alert: Participation
    if (metrics.performance.participationRate < 50 && metrics.currentRaid.attacksUsed > 0) {
      alerts.push({
        type: 'missed_attacks',
        severity: 'medium',
        title: 'Low Capital Participation',
        description: `Only ${metrics.performance.participationRate}% of members have participated in the current raid.`,
        metric: `${metrics.performance.participationRate}% participation`
      });
    }

    // Alert: High Performer
    const hero = metrics.performance.topContributors[0];
    if (hero && hero.capitalResourcesLooted > thresholds.capitalContributionMin * 2) {
      alerts.push({
        type: 'high_performer',
        severity: 'low',
        title: 'Capital Hero Detected',
        description: `${hero.name} has contributed a massive ${hero.capitalResourcesLooted.toLocaleString()} gold this raid.`,
        metric: `${hero.capitalResourcesLooted.toLocaleString()} gold`
      });
    }
  }

  return alerts;
}
