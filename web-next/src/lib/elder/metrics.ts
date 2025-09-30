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

export function computeElderScore(input: ElderMetricInputs): number {
  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);

  const score = 0.40 * consistency + 0.35 * generosity + 0.25 * performance;
  return round1(score);
}

export function identifyFailingDimensions(input: ElderMetricInputs): string[] {
  const fails: string[] = [];
  if (normalizeMetric(input.consistency) < 40) fails.push('Consistency < 40');
  if (normalizeMetric(input.generosity) < 40) fails.push('Generosity < 40');
  if (normalizeMetric(input.performance) < 40) fails.push('Performance < 40');
  return fails;
}

export function formatStatsLine(input: ElderMetricInputs): string {
  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);
  return `Consistency | Generosity | Performance: ${consistency} | ${generosity} | ${performance}`;
}
