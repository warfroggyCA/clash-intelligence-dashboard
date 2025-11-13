// Capital Analytics Metrics Utilities
// Helper functions for calculating and analyzing capital raid metrics

import type { CapitalAnalyticsMetrics } from './engine';

/**
 * Calculate Loot per Attack efficiency
 */
export function calculateLootEfficiency(
  playerLootPerAttack: number,
  clanAverageLootPerAttack: number
): number {
  if (clanAverageLootPerAttack === 0) return 100;
  return Math.round((playerLootPerAttack / clanAverageLootPerAttack) * 100);
}

/**
 * Calculate Carry Score
 */
export function calculateCarryScore(
  bonusAttacksEarned: number,
  totalWeekends: number,
  contributionToTotalLoot: number,
  participationRate: number
): number {
  const bonusAttackRate = totalWeekends > 0 ? bonusAttacksEarned / totalWeekends : 0;
  
  return Math.min(100, Math.round(
    bonusAttackRate * 40 +
    Math.min(contributionToTotalLoot / 10, 1) * 40 +
    participationRate * 20
  ));
}

/**
 * Calculate ROI Score
 */
export function calculateROIScore(
  lootGained: number,
  capitalGoldContributed: number
): number {
  if (capitalGoldContributed === 0) return 50; // Default if no contribution data

  const netContribution = lootGained - capitalGoldContributed;
  const roi = capitalGoldContributed > 0 
    ? (netContribution / capitalGoldContributed) * 100 + 50
    : 50;

  return Math.min(100, Math.max(0, Math.round(roi)));
}

/**
 * Get performance tier from overall score
 */
export function getCapitalPerformanceTier(
  overallScore: number
): CapitalAnalyticsMetrics['performanceTier'] {
  if (overallScore >= 80) return 'excellent';
  if (overallScore >= 65) return 'good';
  if (overallScore >= 50) return 'average';
  if (overallScore >= 35) return 'poor';
  return 'needs_improvement';
}

/**
 * Generate coaching recommendations based on capital metrics
 */
export function generateCapitalCoachingRecommendations(
  metrics: CapitalAnalyticsMetrics
): string[] {
  const recommendations: string[] = [];

  if (metrics.averageLootPerAttack < 5000) {
    recommendations.push('Focus on maximizing loot per attack - aim for 5,000+ gold per attack');
  }

  if (metrics.participationRate < 0.8) {
    recommendations.push('Improve raid weekend participation - aim for 80%+ attendance');
  }

  if (metrics.bonusAttacksEarned === 0 && metrics.totalWeekends >= 3) {
    recommendations.push('Work on earning bonus attacks by destroying districts efficiently');
  }

  if (metrics.carryScore < 50) {
    recommendations.push('Increase contribution to clan raids - focus on high-value targets');
  }

  if (metrics.consecutiveWeekends < 3 && metrics.totalWeekends >= 5) {
    recommendations.push('Build consistency by participating in consecutive raid weekends');
  }

  if (metrics.roiScore < 50) {
    recommendations.push('Improve ROI by contributing capital gold and maximizing raid loot');
  }

  if (metrics.totalAttacks < metrics.totalWeekends * 4) {
    recommendations.push('Use more attacks per weekend - aim for 4-5 attacks per raid weekend');
  }

  if (recommendations.length === 0) {
    recommendations.push('Keep up the excellent capital raid performance!');
  }

  return recommendations;
}

/**
 * Compare player metrics to clan average
 */
export function compareCapitalToClanAverage(
  playerMetrics: CapitalAnalyticsMetrics,
  clanAverages: {
    averageLootPerAttack: number;
    averageCarryScore: number;
    averageParticipation: number;
    averageROI: number;
    averageOverallScore: number;
  }
): {
  lootDelta: number;
  carryDelta: number;
  participationDelta: number;
  roiDelta: number;
  overallDelta: number;
  relativePerformance: 'above_average' | 'average' | 'below_average';
} {
  const lootDelta = playerMetrics.averageLootPerAttack - clanAverages.averageLootPerAttack;
  const carryDelta = playerMetrics.carryScore - clanAverages.averageCarryScore;
  const participationDelta = playerMetrics.participationRate - clanAverages.averageParticipation;
  const roiDelta = playerMetrics.roiScore - clanAverages.averageROI;
  const overallDelta = playerMetrics.overallScore - clanAverages.averageOverallScore;

  let relativePerformance: 'above_average' | 'average' | 'below_average';
  if (overallDelta > 10) relativePerformance = 'above_average';
  else if (overallDelta < -10) relativePerformance = 'below_average';
  else relativePerformance = 'average';

  return {
    lootDelta: Math.round(lootDelta),
    carryDelta: Math.round(carryDelta),
    participationDelta: Math.round(participationDelta * 100) / 100,
    roiDelta: Math.round(roiDelta),
    overallDelta: Math.round(overallDelta),
    relativePerformance,
  };
}

