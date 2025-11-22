import { normalizeTag } from '@/lib/tags';

export interface WarPlanProfile {
  tag: string;
  name?: string | null;
  clanTag?: string | null;
  thLevel?: number | null;
  rankedTrophies?: number | null;
  warStars?: number | null;
  heroLevels?: Record<string, number | null> | null;
}

export interface SlotBreakdown {
  slot: number;
  ourTag: string | null;
  ourName: string | null;
  opponentTag: string | null;
  opponentName: string | null;
  ourTH: number | null;
  opponentTH: number | null;
  thDiff: number;
  heroDiff: number;
  rankedDiff: number;
  warStarDiff: number;
  summary: string;
}

export interface TeamMetrics {
  size: number;
  averageTownHall: number;
  maxTownHall: number;
  averageWarStars: number;
  averageRankedTrophies: number;
  averageHeroLevel: number;
}

export interface WarPlanMetrics {
  townHall: {
    ourDistribution: Record<string, number>;
    opponentDistribution: Record<string, number>;
    maxTownHallDiff: number;
    highTownHallEdge: number;
  };
  heroFirepower: {
    averageHeroDelta: number;
    topFiveHeroDelta: number;
    heroDepthDelta: number;
  };
  warExperience: {
    medianWarStarDelta: number;
    veteranCountDelta: number;
  };
  rosterReadiness: {
    sizeDelta: number;
    highReadinessDelta: number;
    advantageSlots: number;
    dangerSlots: number;
  };
}

export type WarPlanConfidenceBand = 'edge' | 'balanced' | 'underdog';

export interface WarPlanBriefing {
  headline: string;
  bullets: string[];
  narrative: string;
  confidenceBand: WarPlanConfidenceBand;
  generatedAt: string;
  source: 'heuristic' | 'openai';
  model?: string;
}

export interface WarPlanAIPayload {
  matchup: {
    ourClanTag: string | null;
    opponentClanTag: string | null;
    confidence: number;
    outlook: string;
    metrics: WarPlanMetrics;
    recommendations: string[];
    slotHighlights: Array<{
      slot: number;
      matchup: string;
      summary: string;
      thDiff: number;
      heroDiff: number;
      rankedDiff: number;
      warStarDiff: number;
    }>;
  };
}

export interface WarPlanAnalysis {
  summary: {
    confidence: number;
    outlook: string;
  };
  teamComparison: {
    ourMetrics: TeamMetrics;
    opponentMetrics: TeamMetrics;
    differentials: {
      townHall: number;
      heroLevels: number;
      warStars: number;
      rankedTrophies: number;
    };
  };
  slotBreakdown: SlotBreakdown[];
  recommendations: string[];
  aiInput: WarPlanAIPayload | null;
  metrics: WarPlanMetrics;
  briefing: WarPlanBriefing;
  aiSuggestedOrder?: AttackOrderSuggestion[] | null;
}

export interface AttackOrderSuggestion {
  slot: number;
  reason?: string | null;
}

export function generateWarPlanAnalysis(params: {
  ourProfiles: WarPlanProfile[];
  opponentProfiles: WarPlanProfile[];
  ourSelected: string[];
  opponentSelected: string[];
}): WarPlanAnalysis {
  const ourProfiles = params.ourProfiles ?? [];
  const opponentProfiles = params.opponentProfiles ?? [];
  const ourSelected = params.ourSelected ?? [];
  const opponentSelected = params.opponentSelected ?? [];

  const ourMetrics = computeTeamMetrics(ourProfiles);
  const opponentMetrics = computeTeamMetrics(opponentProfiles);
  const slotBreakdown = buildSlotBreakdown(ourProfiles, opponentProfiles, ourSelected, opponentSelected);

  const thDelta = ourMetrics.averageTownHall - opponentMetrics.averageTownHall;
  const heroDelta = ourMetrics.averageHeroLevel - opponentMetrics.averageHeroLevel;
  const warStarDelta = ourMetrics.averageWarStars - opponentMetrics.averageWarStars;
  const rankedDelta = ourMetrics.averageRankedTrophies - opponentMetrics.averageRankedTrophies;

  const confidenceScore = clamp(
    50 + thDelta * 5 + heroDelta * 0.5 + warStarDelta * 0.1 + rankedDelta * 0.05,
    5,
    95,
  );

  const metrics = buildWarPlanMetrics(ourProfiles, opponentProfiles, ourMetrics, opponentMetrics, slotBreakdown);
  const recommendations = buildRecommendations(confidenceScore, ourMetrics, opponentMetrics, slotBreakdown);
  const briefing = buildBriefing(confidenceScore, metrics, recommendations);

  return {
    summary: {
      confidence: confidenceScore,
      outlook: confidenceScore >= 60 ? 'Favorable' : confidenceScore <= 40 ? 'Challenging' : 'Balanced',
    },
    teamComparison: {
      ourMetrics,
      opponentMetrics,
      differentials: {
        townHall: thDelta,
        heroLevels: heroDelta,
        warStars: warStarDelta,
        rankedTrophies: rankedDelta,
      },
    },
    slotBreakdown,
    recommendations,
    aiInput: null,
    metrics,
    briefing,
    aiSuggestedOrder: null,
  };
}

export function normalizeHeroLevels(heroLevels: Record<string, number | null> | null | undefined) {
  const result: Record<string, number | null> = { bk: null, aq: null, gw: null, rc: null, mp: null };
  if (!heroLevels || typeof heroLevels !== 'object') {
    return result;
  }
  for (const key of Object.keys(result)) {
    const value = heroLevels[key];
    result[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return result;
}

function computeTeamMetrics(profiles: WarPlanProfile[]): TeamMetrics {
  const count = profiles.length || 1;
  const thValues = profiles.map((profile) => profile.thLevel ?? 0);
  const warStars = profiles.map((profile) => profile.warStars ?? 0);
  const ranked = profiles.map((profile) => profile.rankedTrophies ?? 0);
  const heroValues = profiles.flatMap((profile) =>
    Object.values(normalizeHeroLevels(profile.heroLevels)).map((value) => (typeof value === 'number' ? value : 0)),
  );

  const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

  return {
    size: profiles.length,
    averageTownHall: sum(thValues) / count,
    maxTownHall: Math.max(...thValues, 0),
    averageWarStars: sum(warStars) / count,
    averageRankedTrophies: sum(ranked) / count,
    averageHeroLevel: heroValues.length ? sum(heroValues) / heroValues.length : 0,
  };
}

function buildSlotBreakdown(
  ourProfiles: WarPlanProfile[],
  opponentProfiles: WarPlanProfile[],
  ourSelected: string[],
  opponentSelected: string[],
): SlotBreakdown[] {
  const normalizeList = (tags: string[]) =>
    tags.map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag));

  const ourNormalized = normalizeList(ourSelected);
  const opponentNormalized = normalizeList(opponentSelected);

  const ourMap = new Map(
    ourProfiles.map((profile) => [normalizeTag(profile.tag) ?? profile.tag, profile]),
  );
  const opponentMap = new Map(
    opponentProfiles.map((profile) => [normalizeTag(profile.tag) ?? profile.tag, profile]),
  );

  const slotCount = Math.max(ourNormalized.length, opponentNormalized.length);

  return Array.from({ length: slotCount }).map((_, index) => {
    const ourTag = ourNormalized[index] ?? null;
    const opponentTag = opponentNormalized[index] ?? null;
    const ourProfile = ourTag ? ourMap.get(ourTag) : undefined;
    const opponentProfile = opponentTag ? opponentMap.get(opponentTag) : undefined;

    const thDiff = (ourProfile?.thLevel ?? 0) - (opponentProfile?.thLevel ?? 0);
    const heroDiff =
      computeAverageHeroLevel(ourProfile?.heroLevels ?? null) -
      computeAverageHeroLevel(opponentProfile?.heroLevels ?? null);
    const rankedDiff = (ourProfile?.rankedTrophies ?? 0) - (opponentProfile?.rankedTrophies ?? 0);
    const warStarDiff = (ourProfile?.warStars ?? 0) - (opponentProfile?.warStars ?? 0);

    const summary = buildSlotSummary(thDiff, heroDiff, rankedDiff, warStarDiff);

    return {
      slot: index + 1,
      ourTag,
      ourName: ourProfile?.name ?? ourTag,
      opponentTag,
      opponentName: opponentProfile?.name ?? opponentTag,
      ourTH: ourProfile?.thLevel ?? null,
      opponentTH: opponentProfile?.thLevel ?? null,
      thDiff,
      heroDiff,
      rankedDiff,
      warStarDiff,
      summary,
    };
  });
}

function buildSlotSummary(thDiff: number, heroDiff: number, rankedDiff: number, warStarDiff: number) {
  const parts: string[] = [];
  if (thDiff > 0) parts.push(`TH advantage ${thDiff}`);
  if (thDiff < 0) parts.push(`TH disadvantage ${Math.abs(thDiff)}`);
  if (heroDiff > 5) parts.push(`Heroes up ${heroDiff.toFixed(1)}`);
  if (heroDiff < -5) parts.push(`Heroes down ${Math.abs(heroDiff).toFixed(1)}`);
  if (rankedDiff > 100) parts.push(`Ranked +${rankedDiff}`);
  if (rankedDiff < -100) parts.push(`Ranked ${rankedDiff}`);
  if (warStarDiff > 50) parts.push(`War-star veteran +${warStarDiff}`);
  if (warStarDiff < -50) parts.push(`Behind in war stars ${warStarDiff}`);
  if (!parts.length) {
    return 'Even matchup';
  }
  return parts.join(' | ');
}

function buildWarPlanMetrics(
  ourProfiles: WarPlanProfile[],
  opponentProfiles: WarPlanProfile[],
  ourMetrics: TeamMetrics,
  opponentMetrics: TeamMetrics,
  slotBreakdown: SlotBreakdown[],
): WarPlanMetrics {
  const ourTownHalls = computeTownHallDistribution(ourProfiles);
  const opponentTownHalls = computeTownHallDistribution(opponentProfiles);

  const ourHeroAverages = ourProfiles.map((profile) => computeAverageHeroLevel(profile.heroLevels ?? null)).sort((a, b) => b - a);
  const opponentHeroAverages = opponentProfiles.map((profile) => computeAverageHeroLevel(profile.heroLevels ?? null)).sort((a, b) => b - a);

  const topFiveHeroDelta = averageOfTopN(ourHeroAverages, 5) - averageOfTopN(opponentHeroAverages, 5);
  const heroDepthDelta = averageOfTopN(ourHeroAverages.slice(5), 5) - averageOfTopN(opponentHeroAverages.slice(5), 5);

  const warStarsOur = ourProfiles.map((profile) => profile.warStars ?? 0);
  const warStarsOpp = opponentProfiles.map((profile) => profile.warStars ?? 0);

  const maxTownHall = Math.max(ourMetrics.maxTownHall, opponentMetrics.maxTownHall, 0);
  const highTownHallThreshold = Math.max(maxTownHall - 1, 0);
  const highTownHallEdge =
    countTownHallsAtOrAbove(ourTownHalls, highTownHallThreshold) -
    countTownHallsAtOrAbove(opponentTownHalls, highTownHallThreshold);

  const readinessThreshold = 55;
  const highReadinessDelta =
    ourHeroAverages.filter((value) => value >= readinessThreshold).length -
    opponentHeroAverages.filter((value) => value >= readinessThreshold).length;

  const { advantageSlots, dangerSlots } = countSlotPressure(slotBreakdown);

  return {
    townHall: {
      ourDistribution: ourTownHalls,
      opponentDistribution: opponentTownHalls,
      maxTownHallDiff: ourMetrics.maxTownHall - opponentMetrics.maxTownHall,
      highTownHallEdge,
    },
    heroFirepower: {
      averageHeroDelta: ourMetrics.averageHeroLevel - opponentMetrics.averageHeroLevel,
      topFiveHeroDelta,
      heroDepthDelta,
    },
    warExperience: {
      medianWarStarDelta: median(warStarsOur) - median(warStarsOpp),
      veteranCountDelta: countAbove(warStarsOur, 150) - countAbove(warStarsOpp, 150),
    },
    rosterReadiness: {
      sizeDelta: ourMetrics.size - opponentMetrics.size,
      highReadinessDelta,
      advantageSlots,
      dangerSlots,
    },
  };
}

function buildBriefing(
  confidence: number,
  metrics: WarPlanMetrics,
  recommendations: string[],
): WarPlanBriefing {
  const confidenceBand: WarPlanConfidenceBand =
    confidence >= 60 ? 'edge' : confidence <= 40 ? 'underdog' : 'balanced';
  const headline =
    confidenceBand === 'edge'
      ? 'We hold the edge—capitalize early.'
      : confidenceBand === 'underdog'
        ? 'Upset alert: play disciplined and patient.'
        : 'Tight war expected—execution decides it.';

  const bullets: string[] = [];
  const highestOurTH = highestTownHallFromDistribution(metrics.townHall.ourDistribution);
  const highestOppTH = highestTownHallFromDistribution(metrics.townHall.opponentDistribution);
  const highTierLabel = Math.max(highestOurTH, highestOppTH) > 0 ? Math.max(highestOurTH, highestOppTH) - 1 : 0;

  if (metrics.townHall.maxTownHallDiff > 0) {
    bullets.push(`Top Town Hall advantage of +${metrics.townHall.maxTownHallDiff} in our lineup.`);
  } else if (metrics.townHall.maxTownHallDiff < 0) {
    bullets.push(`Opponent leads top-end Town Halls by ${Math.abs(metrics.townHall.maxTownHallDiff)}.`);
  }

  if (highTierLabel > 0 && metrics.townHall.highTownHallEdge > 0) {
    bullets.push(`High-tier depth: +${metrics.townHall.highTownHallEdge} attackers at TH${highTierLabel}+ compared to them.`);
  } else if (highTierLabel > 0 && metrics.townHall.highTownHallEdge < 0) {
    bullets.push(`They carry +${Math.abs(metrics.townHall.highTownHallEdge)} more TH${highTierLabel}+ hitters—plan cleanup coverage.`);
  }

  if (metrics.heroFirepower.topFiveHeroDelta > 3) {
    bullets.push(`Top-5 hero firepower is stronger by ~${metrics.heroFirepower.topFiveHeroDelta.toFixed(1)} levels per hero.`);
  } else if (metrics.heroFirepower.topFiveHeroDelta < -3) {
    bullets.push(`Their top attackers carry ~${Math.abs(metrics.heroFirepower.topFiveHeroDelta).toFixed(1)} hero level edge—expect heavy pressure.`);
  }

  if (metrics.warExperience.medianWarStarDelta > 20) {
    bullets.push(`Veteran advantage: our median war stars lead by ${metrics.warExperience.medianWarStarDelta.toFixed(0)}.`);
  } else if (metrics.warExperience.medianWarStarDelta < -20) {
    bullets.push(`Experience gap: they hold +${Math.abs(metrics.warExperience.medianWarStarDelta).toFixed(0)} median war star edge.`);
  }

  if (metrics.rosterReadiness.highReadinessDelta > 0) {
    bullets.push(`Bench depth: +${metrics.rosterReadiness.highReadinessDelta} attackers with heroes raid-ready (avg ≥55).`);
  } else if (metrics.rosterReadiness.highReadinessDelta < 0) {
    bullets.push(`Hero readiness deficit of ${Math.abs(metrics.rosterReadiness.highReadinessDelta)}—manage boosts wisely.`);
  }

  if (metrics.rosterReadiness.dangerSlots > metrics.rosterReadiness.advantageSlots) {
    bullets.push(
      `More pressure slots (${metrics.rosterReadiness.dangerSlots}) than advantages (${metrics.rosterReadiness.advantageSlots})—assign cleanup contingencies.`,
    );
  } else if (metrics.rosterReadiness.advantageSlots > metrics.rosterReadiness.dangerSlots) {
    bullets.push(
      `We control ${metrics.rosterReadiness.advantageSlots} key slots—sequence attacks to multiply the edge.`,
    );
  }

  if (!bullets.length) {
    bullets.push('Matchup is balanced across metrics—tempo and execution will tip the scales.');
  }

  if (recommendations.length) {
    bullets.push(recommendations[0]);
  }

  const narrative = bullets.join(' ');

  return {
    headline,
    bullets,
    narrative,
    confidenceBand,
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
  };
}

function buildRecommendations(
  confidence: number,
  ourMetrics: TeamMetrics,
  opponentMetrics: TeamMetrics,
  slotBreakdown: SlotBreakdown[],
) {
  const notes: string[] = [];
  if (confidence < 45) {
    notes.push('Prioritize triple attempts on opponent weaknesses; consider safe two-star strategies on strong bases.');
  } else if (confidence > 65) {
    notes.push('Push for early high-value triples to build pressure and keep momentum.');
  } else {
    notes.push('Balanced matchup—play disciplined, adapt to first attack results.');
  }

  if (ourMetrics.averageHeroLevel < opponentMetrics.averageHeroLevel - 5) {
    notes.push('Hero disadvantage detected; consider boosting key attackers or adjusting attack plans accordingly.');
  }

  if (ourMetrics.averageTownHall > opponentMetrics.averageTownHall + 0.5) {
    notes.push('Town Hall advantage—leverage higher-tier bases to force mismatches.');
  }

  const biggestAdvantage = slotBreakdown
    .slice()
    .sort((a, b) => b.heroDiff + b.thDiff * 5 - (a.heroDiff + a.thDiff * 5))[0];
  if (biggestAdvantage && (biggestAdvantage.heroDiff > 5 || biggestAdvantage.thDiff >= 1)) {
    notes.push(
      `Exploit slot ${biggestAdvantage.slot}: strong advantage (${biggestAdvantage.summary})—schedule aggressive attack.`,
    );
  }

  const toughestMatch = slotBreakdown
    .slice()
    .sort((a, b) => (a.heroDiff + a.thDiff * 5) - (b.heroDiff + b.thDiff * 5))[0];
  if (toughestMatch && (toughestMatch.heroDiff < -5 || toughestMatch.thDiff <= -1)) {
    notes.push(
      `Support slot ${toughestMatch.slot}: disadvantage (${toughestMatch.summary})—plan backup hitter or cleanup.`,
    );
  }

  return notes;
}

function computeAverageHeroLevel(heroLevels: Record<string, number | null> | null | undefined) {
  if (!heroLevels) return 0;
  const values = Object.values(heroLevels).filter((value): value is number => typeof value === 'number');
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeTownHallDistribution(profiles: WarPlanProfile[]): Record<string, number> {
  return profiles.reduce<Record<string, number>>((acc, profile) => {
    const th = profile.thLevel ?? 0;
    const key = th > 0 ? String(th) : 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countTownHallsAtOrAbove(distribution: Record<string, number>, threshold: number): number {
  return Object.entries(distribution).reduce((total, [th, count]) => {
    const thValue = Number(th === 'unknown' ? 0 : th);
    return thValue >= threshold ? total + count : total;
  }, 0);
}

function highestTownHallFromDistribution(distribution: Record<string, number>): number {
  return Object.keys(distribution).reduce((max, key) => {
    const value = Number(key === 'unknown' ? 0 : key);
    if (!Number.isFinite(value)) return max;
    return Math.max(max, value);
  }, 0);
}

function averageOfTopN(values: number[], n: number): number {
  if (!values.length || n <= 0) return 0;
  const slice = values.slice(0, n);
  if (!slice.length) return 0;
  const sum = slice.reduce((total, value) => total + value, 0);
  return sum / slice.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function countAbove(values: number[], threshold: number): number {
  return values.filter((value) => value >= threshold).length;
}

function countSlotPressure(slotBreakdown: SlotBreakdown[]) {
  let advantageSlots = 0;
  let dangerSlots = 0;
  slotBreakdown.forEach((slot) => {
    if (slot.thDiff >= 1 || slot.heroDiff >= 7) {
      advantageSlots += 1;
    }
    if (slot.thDiff <= -1 || slot.heroDiff <= -7) {
      dangerSlots += 1;
    }
  });
  return { advantageSlots, dangerSlots };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
