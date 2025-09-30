import { clamp, computeElderScore, identifyFailingDimensions, normalizeMetric, round1 } from './metrics';
import type { ElderEvaluatorOptions, ElderMetricInputs, ElderRecommendation } from './types';

const DEFAULT_PROMOTION_THRESHOLD = 70;
const DEFAULT_MONITOR_THRESHOLD = 55;
const DEFAULT_CONSECUTIVE_THRESHOLD = 55;
const TENURE_MINIMUM = 90;

const formatRecommendation = (base: string, failing: string[]): string => {
  if (!failing.length) return base;
  return `${base} (fail: ${failing.join(', ')})`;
};

export function evaluateElderCandidate(
  input: ElderMetricInputs,
  options: ElderEvaluatorOptions = {}
): ElderRecommendation {
  const promotionThreshold = options.promotionThreshold ?? DEFAULT_PROMOTION_THRESHOLD;
  const monitorThreshold = options.monitorThreshold ?? DEFAULT_MONITOR_THRESHOLD;
  const consecutiveThreshold = options.consecutiveThreshold ?? DEFAULT_CONSECUTIVE_THRESHOLD;

  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);
  const score = computeElderScore(input);
  const failing = identifyFailingDimensions(input);

  let band: 'promote' | 'monitor' | 'risk' | 'ineligible';
  let recommendation: string;

  if (input.tenureDays < TENURE_MINIMUM) {
    band = 'ineligible';
    recommendation = 'Not eligible—too new';
    return {
      playerTag: input.playerTag,
      name: input.name,
      tenureDays: input.tenureDays,
      consistency,
      generosity,
      performance,
      score: round1(score),
      band,
      recommendation,
      failingDimensions: [],
    };
  }

  const lowerThanMonitor = score < monitorThreshold;
  const shouldDemote = input.isElder && (
    (lowerThanMonitor && (input.previousScore ?? Number.POSITIVE_INFINITY) < consecutiveThreshold) ||
    failing.length > 0
  );

  if (shouldDemote) {
    band = 'risk';
    const reasons = failing.length ? failing : ['Low consecutive scores'];
    recommendation = `Recommend demotion: ${reasons.join(', ')}`;
  } else if (score >= promotionThreshold) {
    band = 'promote';
    recommendation = 'Recommend promotion/keep as Elder';
  } else if (score >= monitorThreshold) {
    band = 'monitor';
    recommendation = 'Monitor—close but not automatic';
  } else {
    band = 'risk';
    recommendation = 'Do not promote / candidate at risk';
  }

  return {
    playerTag: input.playerTag,
    name: input.name,
    tenureDays: input.tenureDays,
    consistency,
    generosity,
    performance,
    score,
    band,
    recommendation,
    failingDimensions: failing,
  };
}

export function buildReportLine(rec: ElderRecommendation): string {
  const lines = [
    `Player: ${rec.name}`,
    `Tenure: ${rec.tenureDays} days`,
    `Consistency | Generosity | Performance: ${rec.consistency} | ${rec.generosity} | ${rec.performance}`,
    `Elder Readiness Score: ${rec.score.toFixed(1)}`,
    `Recommendation: ${rec.recommendation}`,
    'Cadence: Run monthly after season reset and latest Raid Weekend so everyone knows when reviews happen.',
  ];
  return lines.join('\n');
}

export function evaluateRoster(
  inputs: ElderMetricInputs[],
  options?: ElderEvaluatorOptions
): ElderRecommendation[] {
  return inputs.map((input) => evaluateElderCandidate(input, options));
}
