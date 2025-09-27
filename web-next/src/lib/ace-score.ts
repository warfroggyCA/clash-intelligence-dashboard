import type { Member, Roster } from '@/types';

/**
 * Implementation of the ACE (All-Mode Clan Excellence) score as described in
 * `ace_score_spec.md`. The calculation intentionally mirrors the spec while
 * remaining resilient when data is sparse or partially unavailable. When key
 * inputs are missing we fall back to neutral baselines so the UI can still
 * surface a meaningful ranking without misleading extremes.
 */

// =============================================================================
// Shared Types
// =============================================================================

export interface AceAttackRecord {
  attackerTownHall?: number | null;
  defenderTownHall?: number | null;
  prevStars: number; // stars on base prior to attack (0-2)
  newStars: number;  // new stars earned by this attack (0-3)
  warsAgo?: number;  // how many wars ago this attack occurred (0 = current)
  performedAt?: string; // ISO timestamp (optional fallback for decay)
  attackOrder?: number; // 1-based attack order within war
  warMarginBefore?: number | null; // score differential before attack
}

export interface AceDefenseRecord {
  attackerTownHall?: number | null;
  defenderTownHall?: number | null;
  starsConceded: number; // max stars conceded to the base during the war (0-3)
  warsAgo?: number;
  occurredAt?: string;
}

export interface AceParticipationSample {
  warAttacksUsed?: number;
  warAttacksAvailable?: number;
  capitalAttacksUsed?: number;
  capitalAttacksAvailable?: number;
  fullWarStreak?: number; // number of recent wars with full usage
  warsConsidered?: number; // how many wars were reviewed for the streak
  daysActiveLast30?: number; // days active in the last 30 days (capped later)
}

export interface AceCapitalSample {
  capitalLoot?: number; // total offensive loot earned
  capitalAttacks?: number; // total capital attacks taken
  finisherRate?: number; // share of attacks that finished a district (0-1)
  oneHitRate?: number; // share of districts one-shot (0-1)
}

export interface AceDonationSample {
  donations?: number;
  received?: number;
}

export interface AcePlayerInput {
  tag: string;
  name: string;
  townHallLevel?: number | null;
  attacks?: AceAttackRecord[];
  defenses?: AceDefenseRecord[];
  participation?: AceParticipationSample;
  capital?: AceCapitalSample;
  donations?: AceDonationSample;
  ovaRaw?: number;
  dvaRaw?: number;
  parRaw?: number;
  capRaw?: number;
  donRaw?: number;
}

export interface AceComponentScore {
  raw: number;
  z: number;
  shrunk: number;
  sampleSize: number;
}

export interface AceScoreBreakdown {
  ova: AceComponentScore;
  dva: AceComponentScore;
  par: AceComponentScore;
  cap: AceComponentScore;
  don: AceComponentScore;
}

export interface AceScoreResult {
  tag: string;
  name: string;
  ace: number;
  availability: number;
  breakdown: AceScoreBreakdown;
}

export interface AceWeights {
  ova: number;
  dva: number;
  par: number;
  cap: number;
  don: number;
}

export interface AceShrinkage {
  ova: number;
  dva: number;
  par: number;
  cap: number;
  don: number;
}

export interface AceCalculationOptions {
  weights?: Partial<AceWeights>;
  shrinkage?: Partial<AceShrinkage>;
  logisticAlpha?: number; // slope parameter for logistic squash
  defaultAvailability?: number; // fallback availability multiplier
}

const DEFAULT_WEIGHTS: AceWeights = {
  ova: 0.40,
  dva: 0.15,
  par: 0.20,
  cap: 0.15,
  don: 0.10,
};

const DEFAULT_SHRINKAGE: AceShrinkage = {
  ova: 6,
  dva: 4,
  par: 0, // spec does not shrink participation
  cap: 8,
  don: 0,
};

const DEFAULT_LOGISTIC_ALPHA = 1.1;

const DEFAULT_OPTIONS: Required<AceCalculationOptions> = {
  weights: DEFAULT_WEIGHTS,
  shrinkage: DEFAULT_SHRINKAGE,
  logisticAlpha: DEFAULT_LOGISTIC_ALPHA,
  defaultAvailability: 0.92,
};

export const ACE_DEFAULT_WEIGHTS: Readonly<AceWeights> = Object.freeze({ ...DEFAULT_WEIGHTS });
export const ACE_DEFAULT_LOGISTIC_ALPHA = DEFAULT_LOGISTIC_ALPHA;

// =============================================================================
// Public API
// =============================================================================

/**
 * Primary entry point – compute ACE scores for an array of player inputs.
 */
export function calculateAceScores(
  inputs: AcePlayerInput[],
  options: AceCalculationOptions = {}
): AceScoreResult[] {
  if (!inputs.length) return [];

  const config = mergeOptions(options);

  const allAttacks = inputs.flatMap((p) => p.attacks ?? []);
  const allDefenses = inputs.flatMap((p) => p.defenses ?? []);

  const attackExpectations = buildAttackExpectations(allAttacks);
  const defenseExpectations = buildDefenseExpectations(allDefenses);

  const intermediate = inputs.map((input) =>
    computeIntermediateComponents(input, attackExpectations, defenseExpectations)
  );

  // Prepare stats required for robust standardisation across the roster.
  const ovaStats = computeRobustStats(intermediate.map((p) => p.ova.raw));
  const dvaStats = computeRobustStats(intermediate.map((p) => p.dva.raw));
  const parStats = computeRobustStats(intermediate.map((p) => p.par.raw));

  const vpaValues = intermediate
    .map((p) => p.cap.vpa)
    .filter((v): v is number => Number.isFinite(v ?? NaN));
  const finisherValues = intermediate
    .map((p) => p.cap.finisherRate)
    .filter((v): v is number => Number.isFinite(v ?? NaN));
  const oneHitValues = intermediate
    .map((p) => p.cap.oneHitRate)
    .filter((v): v is number => Number.isFinite(v ?? NaN));

  const balanceValues = intermediate.map((p) => p.don.balance ?? 0);
  const ratioValues = intermediate.map((p) => p.don.ratio ?? 0);

  const vpaStats = computeRobustStats(vpaValues);
  const finisherStats = computeRobustStats(finisherValues);
  const oneHitStats = computeRobustStats(oneHitValues);
  const balanceStats = computeRobustStats(balanceValues);
  const ratioStats = computeRobustStats(ratioValues);

  const ratioPercentile99 = percentile(ratioValues, 0.99);

  // Compute CAP composite raw values now that we have sub-component stats.
  intermediate.forEach((player) => {
    const zVpa = robustZ(player.cap.vpa, vpaStats);
    const zFinisher = robustZ(player.cap.finisherRate, finisherStats);
    const zOneHit = robustZ(player.cap.oneHitRate, oneHitStats);
    player.cap.raw = 0.6 * zVpa + 0.2 * zFinisher + 0.2 * zOneHit;
  });

  const capStats = computeRobustStats(intermediate.map((p) => playerValue(p.cap.raw)));

  // Finalise per-player component scores.
  const results: AceScoreResult[] = intermediate.map((player) => {
    const ova = finaliseComponent(player.ova, ovaStats, config.shrinkage.ova);
    const dva = finaliseComponent(player.dva, dvaStats, config.shrinkage.dva);

    const par = finaliseComponent(
      player.par,
      parStats,
      config.shrinkage.par
    );

    const capComponent = finaliseComponent(
      player.cap,
      capStats,
      config.shrinkage.cap
    );

    const clippedRatio = clamp(player.don.ratio ?? 0, -Infinity, ratioPercentile99 || 0);
    const donRaw = clamp(
      robustZ(player.don.balance, balanceStats) +
        0.5 * robustZ(clippedRatio, ratioStats),
      -2.5,
      2.5
    );
    const don: AceComponentScore = {
      raw: donRaw,
      z: donRaw,
      shrunk: donRaw,
      sampleSize: player.don.sampleSize,
    };

    const core =
      config.weights.ova * ova.shrunk +
      config.weights.dva * dva.shrunk +
      config.weights.par * par.shrunk +
      config.weights.cap * capComponent.shrunk +
      config.weights.don * don.shrunk;

    const logistic = logisticScaled(core, config.logisticAlpha);
    const availability = clamp(player.availability ?? config.defaultAvailability, 0.7, 1.05);
    const ace = logistic * 100 * availability;

    return {
      tag: player.tag,
      name: player.name,
      ace,
      availability,
      breakdown: {
        ova,
        dva,
        par,
        cap: capComponent,
        don,
      },
    };
  });

  return results.sort((a, b) => b.ace - a.ace);
}

/**
 * Helper that derives a lightweight ACE input set from the current roster data.
 * This intentionally uses only the fields we get from the roster snapshot so
 * ACE rankings are always available, even before full war history ingestion is
 * wired up. As richer datasets arrive, callers can supply more detailed
 * `AcePlayerInput` objects instead.
 */
export function createAceInputsFromRoster(roster: Roster | null | undefined): AcePlayerInput[] {
  if (!roster?.members?.length) return [];

  return roster.members.map((member) => {
    const townHall = member.townHallLevel ?? member.th ?? null;
    const donations = {
      donations: member.donations ?? 0,
      received: member.donationsReceived ?? 0,
    };

    const participation = inferParticipation(member);

    const aceExtras = (member as any)?.extras?.ace;
    let ovaRaw: number | undefined;
    let dvaRaw: number | undefined;
    let parRaw: number | undefined;
    let capRaw: number | undefined;
    let donRaw: number | undefined;

    if (aceExtras) {
      const components = Array.isArray(aceExtras.components)
        ? aceExtras.components
        : Array.isArray(aceExtras.componentBreakdown)
          ? aceExtras.componentBreakdown
          : null;
      if (components) {
        for (const comp of components) {
          const code = (comp?.code || comp?.id || '').toString().toUpperCase();
          const value = typeof comp?.value === 'number'
            ? comp.value
            : typeof comp?.z === 'number'
              ? comp.z
              : undefined;
          if (value === undefined) continue;
          switch (code) {
            case 'OAE':
            case 'OVA':
              ovaRaw = value;
              break;
            case 'DAE':
            case 'DVA':
              dvaRaw = value;
              break;
            case 'PR':
            case 'PAR':
              parRaw = value;
              break;
            case 'CAP':
              capRaw = value;
              break;
            case 'DON':
            case 'DONATION':
              donRaw = value;
              break;
            default:
              break;
          }
        }
      }
    }

    const capital: AceCapitalSample | undefined = member.versusTrophies
      ? {
          capitalLoot: member.versusTrophies,
          capitalAttacks: member.versusTrophies > 0 ? 10 : 0,
          finisherRate: member.versusTrophies > 0 ? 0.4 : undefined,
          oneHitRate: member.versusTrophies > 0 ? 0.2 : undefined,
        }
      : undefined;

    return {
      tag: member.tag,
      name: member.name || 'Unknown Player',
      townHallLevel: townHall,
      donations,
      participation,
      capital,
      ovaRaw,
      dvaRaw,
      parRaw,
      capRaw,
      donRaw,
    };
  });
}

// =============================================================================
// Intermediate Computation Structures
// =============================================================================

interface AttackExpectation {
  mean: number;
  sd: number;
}

interface DefenseExpectation {
  mean: number;
  sd: number;
}

interface IntermediatePlayerComponents {
  tag: string;
  name: string;
  ova: IntermediateComponent;
  dva: IntermediateComponent;
  par: IntermediateComponent & { warUse: number; capUse: number; streak: number };
  cap: IntermediateComponent & { vpa?: number; finisherRate?: number; oneHitRate?: number };
  don: { balance?: number; ratio?: number; sampleSize: number };
  availability?: number;
}

interface IntermediateComponent {
  raw: number;
  sampleSize: number;
}

interface AttackExpectationMap {
  default: AttackExpectation;
  byKey: Map<string, AttackExpectation>;
}

interface DefenseExpectationMap {
  default: DefenseExpectation;
  byKey: Map<string, DefenseExpectation>;
}

// =============================================================================
// Core Computation Steps
// =============================================================================

function computeIntermediateComponents(
  input: AcePlayerInput,
  attackExpectations: AttackExpectationMap,
  defenseExpectations: DefenseExpectationMap
): IntermediatePlayerComponents {
  const attacks = input.attacks ?? [];
  const defenses = input.defenses ?? [];

  const ova = input.ovaRaw != null
    ? { raw: input.ovaRaw, sampleSize: attacks.length }
    : computeOffensiveValue(attacks, attackExpectations);
  const dva = input.dvaRaw != null
    ? { raw: input.dvaRaw, sampleSize: defenses.length }
    : computeDefensiveValue(defenses, defenseExpectations);

  const participation = input.participation;
  const warUse = computeRatio(
    participation?.warAttacksUsed,
    participation?.warAttacksAvailable
  );
  const capUse = computeRatio(
    participation?.capitalAttacksUsed,
    participation?.capitalAttacksAvailable
  );
  const streakRatio = computeRatio(
    participation?.fullWarStreak,
    participation?.warsConsidered ?? 8
  );

  const parRaw = input.parRaw != null
    ? input.parRaw
    : 0.55 * warUse + 0.30 * capUse + 0.15 * streakRatio;
  const par: IntermediateComponent & { warUse: number; capUse: number; streak: number } = {
    raw: parRaw,
    sampleSize: participation?.warsConsidered ?? participation?.warAttacksAvailable ?? 0,
    warUse,
    capUse,
    streak: streakRatio,
  };

  const capitalSample = input.capital;
  const vpa = computeVPA(capitalSample);
  const cap: IntermediateComponent & {
    vpa?: number;
    finisherRate?: number;
    oneHitRate?: number;
  } = {
    raw: input.capRaw ?? 0,
    sampleSize: capitalSample?.capitalAttacks ?? 0,
    vpa,
    finisherRate: capitalSample?.finisherRate,
    oneHitRate: capitalSample?.oneHitRate,
  };

  const donations = input.donations;
  const balance = input.donRaw != null ? undefined : (donations?.donations ?? 0) - (donations?.received ?? 0);
  const ratio = input.donRaw != null ? undefined : (donations?.donations ?? 0)
    ? (donations?.donations ?? 0) / Math.max(1, donations?.received ?? 0)
    : 0;

  const don = {
    balance: input.donRaw ?? balance,
    ratio,
    sampleSize: (donations?.donations ?? 0) + (donations?.received ?? 0),
  };

  const availability = computeAvailabilityMultiplier(participation, warUse);

  return {
    tag: input.tag,
    name: input.name,
    ova,
    dva,
    par,
    cap,
    don,
    availability,
  };
}

function computeOffensiveValue(
  attacks: AceAttackRecord[],
  expectations: AttackExpectationMap
): IntermediateComponent {
  if (!attacks.length) {
    return { raw: 0, sampleSize: 0 };
  }

  let total = 0;

  for (const attack of attacks) {
    const key = buildAttackKey(attack);
    const expectation = expectations.byKey.get(key) ?? expectations.default;
    const residual = (attack.newStars - expectation.mean) / expectation.sd;

    const cleanupWeight = attack.prevStars > 0 ? 1.1 : 1;
    const timingWeight = computeTimingWeight(attack);
    const decay = computeWarDecay(attack.warsAgo, attack.performedAt);

    total += residual * cleanupWeight * timingWeight * decay;
  }

  return { raw: total, sampleSize: attacks.length };
}

function computeDefensiveValue(
  defenses: AceDefenseRecord[],
  expectations: DefenseExpectationMap
): IntermediateComponent {
  if (!defenses.length) {
    return { raw: 0, sampleSize: 0 };
  }

  let total = 0;

  for (const defense of defenses) {
    const key = buildDefenseKey(defense);
    const expectation = expectations.byKey.get(key) ?? expectations.default;
    const residual = (expectation.mean - defense.starsConceded) / expectation.sd;
    const decay = computeWarDecay(defense.warsAgo, defense.occurredAt);
    total += residual * decay;
  }

  return { raw: total, sampleSize: defenses.length };
}

// =============================================================================
// Expectation Builders
// =============================================================================

function buildAttackExpectations(attacks: AceAttackRecord[]): AttackExpectationMap {
  const groups = new Map<string, number[]>();

  for (const attack of attacks) {
    const key = buildAttackKey(attack);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(clamp(attack.newStars, 0, 3));
  }

  const byKey = new Map<string, AttackExpectation>();
  const allValues: number[] = [];

  groups.forEach((values, key) => {
    allValues.push(...values);
    byKey.set(key, summarize(values));
  });

  const defaultExpectation = summarize(allValues.length ? allValues : [1.2]);

  return {
    default: defaultExpectation,
    byKey,
  };
}

function buildDefenseExpectations(defenses: AceDefenseRecord[]): DefenseExpectationMap {
  const groups = new Map<string, number[]>();

  for (const defense of defenses) {
    const key = buildDefenseKey(defense);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(clamp(defense.starsConceded, 0, 3));
  }

  const byKey = new Map<string, DefenseExpectation>();
  const allValues: number[] = [];

  groups.forEach((values, key) => {
    allValues.push(...values);
    byKey.set(key, summarize(values));
  });

  const defaultExpectation = summarize(allValues.length ? allValues : [2.0]);

  return {
    default: defaultExpectation,
    byKey,
  };
}

// =============================================================================
// Component Helpers
// =============================================================================

function finaliseComponent(
  component: IntermediateComponent,
  stats: RobustStats,
  shrinkageK: number
): AceComponentScore {
  const z = robustZ(component.raw, stats);
  const shrunk = shrinkageK > 0
    ? applyShrinkage(z, component.sampleSize, shrinkageK)
    : z;

  return {
    raw: component.raw,
    z,
    shrunk,
    sampleSize: component.sampleSize,
  };
}

function computeAvailabilityMultiplier(
  participation: AceParticipationSample | undefined,
  warUse: number
): number | undefined {
  if (!participation) {
    return undefined;
  }

  if (typeof participation.daysActiveLast30 === 'number' && participation.daysActiveLast30 >= 0) {
    return 0.85 + 0.15 * Math.min(1, participation.daysActiveLast30 / 26);
  }

  if (Number.isFinite(warUse)) {
    return 0.85 + 0.15 * clamp(warUse, 0, 1);
  }

  return undefined;
}

function computeVPA(capital: AceCapitalSample | undefined): number | undefined {
  if (!capital) return undefined;
  const attacks = capital.capitalAttacks ?? 0;
  if (attacks <= 0) return undefined;
  return (capital.capitalLoot ?? 0) / Math.max(1, attacks);
}

function computeRatio(numerator?: number, denominator?: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || (denominator ?? 0) <= 0) {
    if (Number.isFinite(numerator) && (numerator ?? 0) > 0) {
      return 1;
    }
    return 0;
  }
  return clamp((numerator ?? 0) / Math.max(1, denominator ?? 1), 0, 1.5);
}

function computeTimingWeight(attack: AceAttackRecord): number {
  const orderWeight = attack.attackOrder
    ? clamp(1.05 - (Math.max(1, attack.attackOrder) - 1) * 0.01, 0.95, 1.05)
    : 1;
  const marginWeight = attack.warMarginBefore != null
    ? clamp(1 + clamp(-attack.warMarginBefore / 60, -0.05, 0.05), 0.95, 1.05)
    : 1;
  return clamp(orderWeight * marginWeight, 0.95, 1.05);
}

function computeWarDecay(warsAgo?: number, timestamp?: string): number {
  if (Number.isFinite(warsAgo)) {
    return Math.pow(0.75, Math.max(0, warsAgo ?? 0));
  }
  if (timestamp) {
    const ageDays = daysSince(timestamp);
    if (Number.isFinite(ageDays)) {
      return Math.pow(0.75, ageDays / 2);
    }
  }
  return 1;
}

// =============================================================================
// Expectation Keys
// =============================================================================

function buildAttackKey(attack: AceAttackRecord): string {
  const deltaTH = (attack.attackerTownHall ?? 0) - (attack.defenderTownHall ?? 0);
  return `${deltaTH}|${attack.prevStars ?? 0}`;
}

function buildDefenseKey(defense: AceDefenseRecord): string {
  const deltaTH = (defense.attackerTownHall ?? 0) - (defense.defenderTownHall ?? 0);
  return `${deltaTH}`;
}

function summarize(values: number[]): { mean: number; sd: number } {
  if (!values.length) {
    return { mean: 0, sd: 1 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, values.length - 1);
  const sd = Math.max(Math.sqrt(variance), 0.35);
  return { mean, sd };
}

// =============================================================================
// Robust Statistics Helpers
// =============================================================================

interface RobustStats {
  median: number;
  mad: number;
}

function computeRobustStats(values: number[]): RobustStats {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return { median: 0, mad: 0 };
  }

  const sorted = [...filtered].sort((a, b) => a - b);
  const median = computeMedian(sorted);
  const absDeviations = sorted.map((value) => Math.abs(value - median));
  const mad = computeMedian(absDeviations);
  return { median, mad };
}

function computeMedian(sortedValues: number[]): number {
  if (!sortedValues.length) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  return sortedValues[mid];
}

function robustZ(value: number | undefined, stats: RobustStats): number {
  if (!Number.isFinite(value)) return 0;
  if (stats.mad === 0) return 0;
  const scaledMad = stats.mad * 1.4826; // scale MAD to match std deviation for normal dist
  return (value! - stats.median) / scaledMad;
}

function applyShrinkage(z: number, sampleSize: number, k: number): number {
  if (sampleSize <= 0 || k <= 0) return z;
  return (sampleSize / (sampleSize + k)) * z;
}

function playerValue(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

// =============================================================================
// Utility helpers
// =============================================================================

function mergeOptions(options: AceCalculationOptions): Required<AceCalculationOptions> {
  return {
    weights: { ...DEFAULT_WEIGHTS, ...options.weights },
    shrinkage: { ...DEFAULT_SHRINKAGE, ...options.shrinkage },
    logisticAlpha: options.logisticAlpha ?? DEFAULT_OPTIONS.logisticAlpha,
    defaultAvailability: options.defaultAvailability ?? DEFAULT_OPTIONS.defaultAvailability,
  };
}

export function computeAceLogistic(core: number, alpha: number = ACE_DEFAULT_LOGISTIC_ALPHA): number {
  return logisticScaled(core, alpha);
}

function logisticScaled(x: number, alpha: number): number {
  const clamped = clamp(x, -6, 6);
  return 1 / (1 + Math.exp(-alpha * clamped));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysSince(timestamp: string): number {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function percentile(values: number[], percentileRank: number): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const index = (sorted.length - 1) * clamp(percentileRank, 0, 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function inferParticipation(member: Member): AceParticipationSample | undefined {
  const donations = member.donations ?? 0;
  const received = member.donationsReceived ?? 0;
  const estimatedWarUse = donations + received > 0 ? clamp(donations / Math.max(1, received), 0, 1) : 0.6;

  const daysActive = inferDaysActive(member);

  return {
    warAttacksUsed: Math.round(estimatedWarUse * 2),
    warAttacksAvailable: 2,
    capitalAttacksUsed: Math.round((donations > 0 ? 6 : 2)),
    capitalAttacksAvailable: 6,
    fullWarStreak: donations > 0 ? 4 : 2,
    warsConsidered: 8,
    daysActiveLast30: daysActive,
  };
}

function inferDaysActive(member: Member): number {
  const raw = member.lastSeen;

  if (typeof raw === 'number') {
    if (raw > 10_000) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) {
        const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        return clamp(30 - diff, 0, 30);
      }
    }
    // Treat numeric values less than ~100 as "days since active"
    const daysSinceActive = raw >= 0 && raw <= 90 ? raw : 14;
    return clamp(30 - daysSinceActive, 0, 30);
  }

  if (typeof raw === 'string' && raw) {
    const diff = daysSince(raw);
    return clamp(30 - diff, 0, 30);
  }

  return 22;
}
