// War Intelligence Metrics Utilities
// Helper functions for calculating and analyzing war metrics

import type { WarIntelligenceMetrics } from './engine';

/**
 * Calculate Attack Efficiency Index (AEI) from raw attack data
 */
export function calculateAEI(
  totalStars: number,
  totalDestruction: number,
  totalAttacks: number,
  cleanupAttacks: number
): number {
  if (totalAttacks === 0) return 0;

  const averageStars = totalStars / totalAttacks;
  const averageDestruction = totalDestruction / totalAttacks;
  const cleanupRate = cleanupAttacks / totalAttacks;

  // Weighted: stars 60%, destruction 30%, cleanup 10%
  return Math.min(100, Math.round(
    (averageStars / 3) * 60 +
    (averageDestruction / 100) * 30 +
    cleanupRate * 10
  ));
}

/**
 * Calculate Contribution Consistency Score
 */
export function calculateConsistencyScore(
  attacksUsed: number,
  attacksAvailable: number,
  consecutiveWars: number,
  totalWars: number
): number {
  const participationRate = attacksAvailable > 0 ? attacksUsed / attacksAvailable : 0;
  const streakBonus = totalWars > 0 ? consecutiveWars / totalWars : 0;

  return Math.min(100, Math.round(
    participationRate * 70 +
    streakBonus * 30
  ));
}

/**
 * Calculate Defensive Hold Rate
 */
export function calculateDefensiveHoldRate(
  defensesSurvived: number,
  totalDefenses: number,
  averageDestructionAllowed: number
): number | null {
  if (totalDefenses === 0) return null;

  // Hold rate = 1 - (average destruction allowed / 100)
  const holdRate = 1 - (averageDestructionAllowed / 100);
  
  // Adjust based on survival rate
  const survivalRate = defensesSurvived / totalDefenses;
  
  return Math.max(0, Math.min(1, (holdRate + survivalRate) / 2));
}

/**
 * Calculate Clutch Factor (late-war high-impact attacks)
 */
export function calculateClutchFactor(
  lateWarAttacks: number,
  totalAttacks: number,
  highStarAttacks: number
): number {
  if (totalAttacks === 0) return 0;

  // Clutch = attacks in last 25% of war that got 2+ stars
  return Math.min(1, lateWarAttacks / totalAttacks);
}

/**
 * Calculate Target Selection Quality
 */
export function calculateTargetSelectionQuality(
  successfulEqualOrHigherAttacks: number,
  totalEqualOrHigherAttacks: number
): number {
  if (totalEqualOrHigherAttacks === 0) return 50; // Default

  return Math.round((successfulEqualOrHigherAttacks / totalEqualOrHigherAttacks) * 100);
}

/**
 * Get performance tier from overall score
 */
export function getPerformanceTier(overallScore: number): WarIntelligenceMetrics['performanceTier'] {
  if (overallScore >= 80) return 'excellent';
  if (overallScore >= 65) return 'good';
  if (overallScore >= 50) return 'average';
  if (overallScore >= 35) return 'poor';
  return 'needs_coaching';
}

/**
 * Generate coaching recommendations based on metrics
 */
export function generateCoachingRecommendations(
  metrics: WarIntelligenceMetrics
): string[] {
  const recommendations: string[] = [];

  if (metrics.attackEfficiencyIndex < 50) {
    recommendations.push('Focus on improving attack efficiency - aim for 2+ stars per attack');
  }

  if (metrics.averageStarsPerAttack < 1.5) {
    recommendations.push('Work on attack strategies to consistently earn more stars');
  }

  if (metrics.cleanupEfficiency < 0.2) {
    recommendations.push('Take more cleanup attacks on lower Town Halls to maximize efficiency');
  }

  if (metrics.participationRate < 0.8) {
    recommendations.push('Improve war participation - use both attacks consistently');
  }

  if (metrics.consistencyScore < 60) {
    recommendations.push('Build consistency by participating in every war');
  }

  if (metrics.defensiveHoldRate != null && metrics.defensiveHoldRate < 0.5) {
    recommendations.push('Strengthen base defenses - focus on anti-3 star layouts');
  }

  if (metrics.failedAttacks > metrics.totalAttacks * 0.3) {
    recommendations.push('Reduce failed attacks - practice on equal/higher THs before war');
  }

  if (metrics.targetSelectionQuality < 60) {
    recommendations.push('Improve target selection - choose appropriate matchups');
  }

  if (metrics.clutchFactor < 0.1 && metrics.totalAttacks > 10) {
    recommendations.push('Save attacks for later in war when needed for clutch wins');
  }

  if (recommendations.length === 0) {
    recommendations.push('Keep up the excellent war performance!');
  }

  return recommendations;
}

/**
 * Compare player metrics to clan average
 */
export function compareToClanAverage(
  playerMetrics: WarIntelligenceMetrics,
  clanAverages: {
    averageAEI: number;
    averageConsistency: number;
    averageHoldRate: number;
    averageOverallScore: number;
  }
): {
  aeiDelta: number;
  consistencyDelta: number;
  holdRateDelta: number;
  overallDelta: number;
  relativePerformance: 'above_average' | 'average' | 'below_average';
} {
  const aeiDelta = playerMetrics.attackEfficiencyIndex - clanAverages.averageAEI;
  const consistencyDelta = playerMetrics.consistencyScore - clanAverages.averageConsistency;
  const holdRateDelta = playerMetrics.defensiveHoldRate != null
    ? playerMetrics.defensiveHoldRate - clanAverages.averageHoldRate
    : 0;
  const overallDelta = playerMetrics.overallScore - clanAverages.averageOverallScore;

  let relativePerformance: 'above_average' | 'average' | 'below_average';
  if (overallDelta > 10) relativePerformance = 'above_average';
  else if (overallDelta < -10) relativePerformance = 'below_average';
  else relativePerformance = 'average';

  return {
    aeiDelta: Math.round(aeiDelta),
    consistencyDelta: Math.round(consistencyDelta),
    holdRateDelta: Math.round(holdRateDelta * 100) / 100,
    overallDelta: Math.round(overallDelta),
    relativePerformance,
  };
}
