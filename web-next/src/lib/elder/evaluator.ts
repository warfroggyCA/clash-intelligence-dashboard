import { parseRole } from '@/lib/leadership';
import { clamp, computeElderScore, identifyFailingDimensions, normalizeMetric, round1 } from './metrics';
import type { ElderEvaluatorOptions, ElderMetricInputs, ElderRecommendation } from './types';

const DEFAULT_PROMOTION_THRESHOLD = 70;
const DEFAULT_MONITOR_THRESHOLD = 55;
const DEFAULT_CONSECUTIVE_THRESHOLD = 55;
const DEFAULT_TENURE_MINIMUM = 90;
const DEFAULT_FAILING_DIMENSION_THRESHOLD = 40;

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
  const tenureMinimum = options.tenureMinimum ?? DEFAULT_TENURE_MINIMUM;
  const failingDimensionThreshold = options.failingDimensionThreshold ?? DEFAULT_FAILING_DIMENSION_THRESHOLD;

  const consistency = normalizeMetric(input.consistency);
  const generosity = normalizeMetric(input.generosity);
  const performance = normalizeMetric(input.performance);
  const score = computeElderScore(input, options.weights);
  const failing = identifyFailingDimensions(input, failingDimensionThreshold, options.weights);
  const normalizedRole = input.role ? parseRole(input.role) : input.isElder ? 'elder' : 'member';
  const alreadyHigherLeadership = normalizedRole === 'leader' || normalizedRole === 'coLeader';
  const alreadyElder = normalizedRole === 'elder';

  let band: 'promote' | 'monitor' | 'risk' | 'ineligible';
  let recommendation: string;

  if (input.tenureDays < tenureMinimum) {
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
  } else if (alreadyHigherLeadership) {
    band = 'monitor';
    recommendation = formatRecommendation('Already leadership role—no change needed', failing);
  } else if (alreadyElder) {
    band = 'monitor';
    recommendation = formatRecommendation('Maintain Elder status', failing);
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
