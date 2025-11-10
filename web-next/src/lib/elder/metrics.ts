import type { ElderMetricInputs } from './types';

export const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const round1 = (value: number): number => Math.round(value * 10) / 10;

export function normalizeMetric(value: number | null | undefined): number {
  if (value == null) return 0;
  return clamp(Math.round(value), 0, 100);
}

export function computeElderScore(
  input: ElderMetricInputs,
  weights?: { consistency?: number; generosity?: number; performance?: number }
): number {
  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);

  // Default weights: 40% consistency, 35% generosity, 25% performance
  const wConsistency = weights?.consistency ?? 0.40;
  const wGenerosity = weights?.generosity ?? 0.35;
  const wPerformance = weights?.performance ?? 0.25;

  // Normalize weights to sum to 1.0
  const totalWeight = wConsistency + wGenerosity + wPerformance;
  const normalizedConsistency = totalWeight > 0 ? wConsistency / totalWeight : 0.40;
  const normalizedGenerosity = totalWeight > 0 ? wGenerosity / totalWeight : 0.35;
  const normalizedPerformance = totalWeight > 0 ? wPerformance / totalWeight : 0.25;

  const score = normalizedConsistency * consistency + normalizedGenerosity * generosity + normalizedPerformance * performance;
  return round1(score);
}

export function identifyFailingDimensions(
  input: ElderMetricInputs,
  threshold: number = 40,
  weights?: { consistency?: number; generosity?: number; performance?: number }
): string[] {
  const fails: string[] = [];
  
  // Only check dimensions that have non-zero weight (or default weight if not specified)
  const wConsistency = weights?.consistency ?? 0.40;
  const wGenerosity = weights?.generosity ?? 0.35;
  const wPerformance = weights?.performance ?? 0.25;
  
  // Skip checking dimensions with zero or negligible weight (< 5%)
  // This prevents small weights (like 2%) from triggering failing dimension checks
  // Only dimensions with meaningful contribution (>= 5%) are checked
  const MIN_WEIGHT_THRESHOLD = 0.05;
  if (wConsistency >= MIN_WEIGHT_THRESHOLD && normalizeMetric(input.consistency) < threshold) {
    fails.push(`Consistency < ${threshold}`);
  }
  if (wGenerosity >= MIN_WEIGHT_THRESHOLD && normalizeMetric(input.generosity) < threshold) {
    fails.push(`Generosity < ${threshold}`);
  }
  if (wPerformance >= MIN_WEIGHT_THRESHOLD && normalizeMetric(input.performance) < threshold) {
    fails.push(`Performance < ${threshold}`);
  }
  return fails;
}

export function formatStatsLine(input: ElderMetricInputs): string {
  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);
  return `Consistency | Generosity | Performance: ${consistency} | ${generosity} | ${performance}`;
}
