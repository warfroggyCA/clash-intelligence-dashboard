/**
 * Business Logic Utilities for Clash Intelligence Dashboard
 * 
 * This file contains all the complex calculations and business logic
 * that was previously scattered across components. It provides a clean
 * separation of concerns and makes the code more testable and maintainable.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import {
  Member,
  HeroCaps,
  ActivityLevel,
  ActivityEvidence,
  ActivityBreakdown,
  ActivityMetrics,
  ActivityOption,
  PlayerArchetype,
  WarAnalytics,
  WarPerformanceData,
  TownHallLevel,
  PlayerActivityTimelineEvent,
  HERO_MAX_LEVELS,
  HERO_MIN_TH,
} from '@/types';
import { ACE_DEFAULT_LOGISTIC_ALPHA, computeAceLogistic } from '@/lib/ace-score';

// =============================================================================
// HERO CALCULATIONS
// =============================================================================

/**
 * Get Town Hall level from member data
 */
export const getTownHallLevel = (member: Member): number => {
  return member.townHallLevel ?? member.th ?? 0;
};

/**
 * Calculate hero caps for a given Town Hall level
 */
export const getHeroCaps = (th: number): HeroCaps => {
  return HERO_MAX_LEVELS[th] || {};
};

/**
 * Calculate rush percentage for a member
 * @param member - The member to analyze
 * @param thCaps - Optional pre-calculated caps map
 * @returns Rush percentage (0-100, where 100 = completely rushed)
 */
export const calculateRushPercentage = (member: Member, thCaps?: Map<number, HeroCaps>): number => {
  const th = getTownHallLevel(member);
  const caps = thCaps?.get(th) || getHeroCaps(th);
  
  const heroKeys: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc', 'mp'];
  const availableHeroes = heroKeys.filter(key => caps[key] && caps[key]! > 0);
  
  if (availableHeroes.length === 0) return 0;
  
  let totalDeficit = 0;
  
  for (const hero of availableHeroes) {
    const currentLevel = member[hero] ?? 0;
    const maxLevel = caps[hero]!;
    const deficit = Math.max(0, maxLevel - currentLevel);
    totalDeficit += deficit / maxLevel;
  }
  
  return Math.round((totalDeficit / availableHeroes.length) * 100);
};

/**
 * Overall Rush (placeholder): for now, mirrors Hero Rush.
 * Later, blend offense/defense when data is available.
 */
export const calculateOverallRush = (member: Member): number => {
  const th = getTownHallLevel(member);
  const caps = getHeroCaps(th);

  // Main-base heroes only (excludes MP) for overall view
  const heroKeys: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc'];
  const available = heroKeys.filter(key => caps[key] && caps[key]! > 0);
  if (available.length === 0) return 0;

  let totalDeficit = 0;
  for (const hero of available) {
    const current = member[hero] ?? 0;
    const max = caps[hero]!;
    totalDeficit += Math.max(0, (max - current) / max);
  }
  return Math.round((totalDeficit / available.length) * 100);
};

/**
 * Calculate Town Hall caps for a list of members
 */
export const calculateTownHallCaps = (members: Member[]): Map<number, HeroCaps> => {
  const caps = new Map<number, HeroCaps>();
  
  for (const member of members) {
    const th = getTownHallLevel(member);
    if (th < 1) continue;
    
    const currentCaps = caps.get(th) || {};
    const newCaps: HeroCaps = { ...currentCaps };
    
    // Update caps based on available heroes
    const heroKeys: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc', 'mp'];
    for (const hero of heroKeys) {
      const level = member[hero];
      if (typeof level === 'number' && level > 0) {
        newCaps[hero] = Math.max(newCaps[hero] || 0, level);
      }
    }
    
    caps.set(th, newCaps);
  }
  
  return caps;
};

/**
 * Get hero progress color class based on percentage
 */
export const getHeroProgressColor = (percentage: number): string => {
  if (percentage >= 80) return "text-green-700 font-semibold"; // 80%+ = excellent
  if (percentage >= 60) return "text-green-700"; // 60-79% = good
  if (percentage >= 40) return "text-yellow-600"; // 40-59% = moderate
  if (percentage >= 20) return "text-orange-600"; // 20-39% = needs work
  return "text-red-600 font-semibold"; // <20% = poor
};

/**
 * Check if a hero is available for a given Town Hall level
 */
export const isHeroAvailable = (hero: keyof HeroCaps, th: number): boolean => {
  const minTh = HERO_MIN_TH[hero];
  return th >= minTh;
};

/**
 * Get hero display value with proper handling of unavailable heroes
 */
export const getHeroDisplayValue = (
  member: Member, 
  hero: keyof HeroCaps, 
  th: number
): string | number => {
  if (!isHeroAvailable(hero, th)) {
    return "—";
  }
  
  const level = member[hero];
  if (level == null || level <= 0) {
    return "—";
  }
  
  return level;
};

// =============================================================================
// DONATION CALCULATIONS
// =============================================================================

/**
 * Calculate donation balance for a member
 * @param member - The member to analyze
 * @returns Object with given, received, balance, and isNegative flag
 */
export const calculateDonationBalance = (member: Member) => {
  const given = member.donations ?? 0;
  const received = member.donationsReceived ?? 0;
  const balance = received - given;
  
  return {
    given,
    received,
    balance,
    isNegative: balance > 0 // True means they receive more than they give (concerning)
  };
};

/**
 * Check if member is a net receiver (receives more than they give)
 */
export const isNetReceiver = (member: Member): boolean => {
  const balance = calculateDonationBalance(member);
  return balance.isNegative;
};

/**
 * Check if member is a low donator
 */
export const isLowDonator = (member: Member): boolean => {
  const given = member.donations ?? 0;
  return given < 100; // Arbitrary threshold, could be made configurable
};

// =============================================================================
// ACTIVITY CALCULATIONS
// =============================================================================

export interface ActivityScoreOptions {
  timeline?: PlayerActivityTimelineEvent[];
  lookbackDays?: number;
}

const confidenceToPoints = (confidence: ActivityEvidence['confidence']): number => {
  switch (confidence) {
    case 'definitive':
      return 4;
    case 'high':
      return 2.5;
    case 'medium':
      return 1.2;
    default:
      return 0;
  }
};

const pointsToConfidence = (points: number): ActivityEvidence['confidence'] => {
  if (points >= 4) return 'definitive';
  if (points >= 2.5) return 'high';
  if (points >= 1) return 'medium';
  return 'weak';
};

/**
 * Calculate activity score using real-time signals plus recent timeline events.
 * The optional `timeline` parameter lets callers feed in the last N days of
 * snapshot deltas so we can reward war participation, raid contributions,
 * builder-base play, pet/equipment upgrades, and other enriched metrics.
 */
export const calculateActivityScore = (
  member: Member,
  options?: ActivityScoreOptions
): ActivityEvidence => {
  const timeline = options?.timeline ?? [];
  const lookbackDays = options?.lookbackDays ?? 7;
  const lookbackCutoff = Date.now() - lookbackDays * 86_400_000;

  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const pickNumber = (...values: Array<unknown>): number => {
    for (const candidate of values) {
      const numeric = toFiniteNumber(candidate);
      if (numeric !== null) return numeric;
    }
    return 0;
  };

  const realTimeActivity = calculateRealTimeActivity(member);
  const breakdown: ActivityBreakdown = {
    realtime: 0,
    war: 0,
    donations: 0,
    capital: 0,
    builder: 0,
    upgrades: 0,
    lab: 0,
    achievements: 0,
    trophies: 0,
    heroProgress: 0,
    role: 0,
    superTroops: 0,
    other: 0,
  };

  let score = 0;
  const addScore = (category: keyof ActivityBreakdown, value: number) => {
    if (!value || Number.isNaN(value)) return;
    const normalized = Math.max(0, value);
    breakdown[category] += normalized;
    score += normalized;
  };

  addScore('realtime', realTimeActivity.score);
  let confidencePoints = confidenceToPoints(realTimeActivity.confidence);
  const indicatorSet = new Set<string>(realTimeActivity.indicators);

  const aggregate = {
    heroUpgrades: 0,
    petUpgrades: 0,
    equipmentUpgrades: 0,
    warStarsDelta: 0,
    attackWinsDelta: 0,
    defenseWinsDelta: 0,
    capitalContributionDelta: 0,
    builderHallDelta: 0,
    builderWinsDelta: 0,
    donationDelta: 0,
    donationReceivedDelta: 0,
    trophyDelta: 0,
    rankedTrophyDelta: 0,
    maxTroopDelta: 0,
    maxSpellDelta: 0,
    achievementDelta: 0,
    expLevelDelta: 0,
    superTroopsActivated: new Set<string>(),
  };

  let lastEventTs: number | null = null;

  for (const event of timeline) {
    const eventDateValue = (event as any).date ?? (event as any).snapshotDate ?? null;
    const eventTs = eventDateValue ? new Date(eventDateValue).getTime() : Number.NaN;
    if (!Number.isNaN(eventTs)) {
      if (lastEventTs === null || eventTs > lastEventTs) {
        lastEventTs = eventTs;
      }
    }
    if (Number.isNaN(eventTs) || eventTs < lookbackCutoff) {
      continue;
    }

    const heroUpgradeCount = Array.isArray(event.heroUpgrades) ? event.heroUpgrades.length : 0;
    aggregate.heroUpgrades += heroUpgradeCount;

    const petUpgradeCount = Array.isArray(event.petUpgrades) ? event.petUpgrades.length : 0;
    aggregate.petUpgrades += petUpgradeCount;

    const equipmentUpgradeCount = Array.isArray(event.equipmentUpgrades) ? event.equipmentUpgrades.length : 0;
    aggregate.equipmentUpgrades += equipmentUpgradeCount;

    const warStarsDeltaValue = pickNumber(
      (event as any).warStarsDelta,
      (event as any).warStarsChange
    );
    aggregate.warStarsDelta += Math.max(0, warStarsDeltaValue);

    const attackWinsDeltaValue = pickNumber(
      (event as any).attackWinsDelta,
      (event as any).attack_wins_delta
    );
    aggregate.attackWinsDelta += Math.max(0, attackWinsDeltaValue);

    const defenseWinsDeltaValue = pickNumber(
      (event as any).defenseWinsDelta,
      (event as any).defense_wins_delta
    );
    aggregate.defenseWinsDelta += Math.max(0, defenseWinsDeltaValue);

    const capitalDeltaValue = pickNumber(
      (event as any).capitalContributionDelta,
      (event as any).capital_delta
    );
    aggregate.capitalContributionDelta += Math.max(0, capitalDeltaValue);

    const builderHallDeltaValue = pickNumber(
      (event as any).builderHallDelta
    );
    aggregate.builderHallDelta += Math.max(0, builderHallDeltaValue);

    const builderWinsDeltaValue = pickNumber(
      (event as any).versusBattleWinsDelta
    );
    aggregate.builderWinsDelta += Math.max(0, builderWinsDeltaValue);

    const donationDeltaValue = pickNumber(
      (event as any).donationsDelta,
      (event as any).donationDelta
    );
    aggregate.donationDelta += Math.max(0, donationDeltaValue);

    const donationReceivedDeltaValue = pickNumber(
      (event as any).donationsReceivedDelta
    );
    aggregate.donationReceivedDelta += Math.max(0, donationReceivedDeltaValue);

    const trophyDeltaValue = pickNumber(
      (event as any).trophyDelta,
      (event as any).trophiesDelta
    );
    aggregate.trophyDelta += Math.abs(trophyDeltaValue);

    const rankedTrophyDeltaValue = pickNumber(
      (event as any).rankedTrophyDelta
    );
    aggregate.rankedTrophyDelta += Math.abs(rankedTrophyDeltaValue);

    const maxTroopDeltaValue = pickNumber(
      (event as any).maxTroopDelta
    );
    aggregate.maxTroopDelta += Math.max(0, maxTroopDeltaValue);

    const maxSpellDeltaValue = pickNumber(
      (event as any).maxSpellDelta
    );
    aggregate.maxSpellDelta += Math.max(0, maxSpellDeltaValue);

    const achievementDeltaValue = pickNumber(
      (event as any).achievementDelta
    );
    aggregate.achievementDelta += Math.max(0, achievementDeltaValue);

    const expLevelDeltaValue = pickNumber(
      (event as any).expLevelDelta
    );
    aggregate.expLevelDelta += Math.max(0, expLevelDeltaValue);
    (event.superTroopsActivated ?? []).forEach((troop) =>
      aggregate.superTroopsActivated.add(troop)
    );
  }

  if (aggregate.warStarsDelta > 0 || aggregate.attackWinsDelta > 0) {
    const warScore = 15;
    addScore('war', warScore);
    const warParts: string[] = [];
    if (aggregate.warStarsDelta > 0) warParts.push(`+${aggregate.warStarsDelta}⭐`);
    if (aggregate.attackWinsDelta > 0) warParts.push(`+${aggregate.attackWinsDelta} atk`);
    indicatorSet.add(`War activity (${warParts.join(', ')})`);
    confidencePoints += 2;
  }

  if (aggregate.defenseWinsDelta > 0) {
    const defenseScore = 4;
    addScore('war', defenseScore);
    indicatorSet.add('Defense win recorded');
    confidencePoints += 0.5;
  }

  if (aggregate.capitalContributionDelta > 0) {
    const capitalScore = Math.min(12, 6 + Math.floor(aggregate.capitalContributionDelta / 200));
    addScore('capital', capitalScore);
    indicatorSet.add(
      `Capital contributed +${aggregate.capitalContributionDelta.toLocaleString()}`
    );
    confidencePoints += 1.5;
  }

  if (aggregate.builderHallDelta > 0 || aggregate.builderWinsDelta >= 3) {
    const builderScore = 8;
    addScore('builder', builderScore);
    const builderParts: string[] = [];
    if (aggregate.builderHallDelta > 0) builderParts.push(`BH +${aggregate.builderHallDelta}`);
    if (aggregate.builderWinsDelta > 0) builderParts.push(`+${aggregate.builderWinsDelta} wins`);
    indicatorSet.add(`Builder base activity (${builderParts.join(', ')})`);
    confidencePoints += 1;
  }

  if (aggregate.heroUpgrades > 0) {
    const heroScore = 6;
    addScore('upgrades', heroScore);
    indicatorSet.add(
      aggregate.heroUpgrades === 1
        ? 'Hero upgrade completed'
        : `${aggregate.heroUpgrades} hero upgrades`
    );
    confidencePoints += 1;
  }

  if (aggregate.petUpgrades > 0) {
    const petScore = 5;
    addScore('upgrades', petScore);
    indicatorSet.add(
      aggregate.petUpgrades === 1
        ? 'Pet upgrade completed'
        : `${aggregate.petUpgrades} pet upgrades`
    );
    confidencePoints += 0.5;
  }

  if (aggregate.equipmentUpgrades > 0) {
    const equipmentScore = 5;
    addScore('upgrades', equipmentScore);
    indicatorSet.add(
      aggregate.equipmentUpgrades === 1
        ? 'Equipment upgrade completed'
        : `${aggregate.equipmentUpgrades} equipment upgrades`
    );
    confidencePoints += 0.5;
  }

  if (aggregate.maxTroopDelta > 0 || aggregate.maxSpellDelta > 0) {
    const labScore = 4;
    addScore('lab', labScore);
    const labParts: string[] = [];
    if (aggregate.maxTroopDelta > 0) {
      labParts.push(
        `${aggregate.maxTroopDelta} troop${aggregate.maxTroopDelta > 1 ? 's' : ''}`
      );
    }
    if (aggregate.maxSpellDelta > 0) {
      labParts.push(
        `${aggregate.maxSpellDelta} spell${aggregate.maxSpellDelta > 1 ? 's' : ''}`
      );
    }
    indicatorSet.add(`Lab upgrades (${labParts.join(', ')})`);
    confidencePoints += 0.5;
  }

  if (aggregate.achievementDelta > 0) {
    const achievementScore = 3;
    addScore('achievements', achievementScore);
    indicatorSet.add(
      aggregate.achievementDelta === 1
        ? 'Achievement completed'
        : `${aggregate.achievementDelta} achievements`
    );
    confidencePoints += 0.5;
  }

  if (aggregate.expLevelDelta > 0) {
    const expScore = 3;
    addScore('other', expScore);
    indicatorSet.add(
      `Gained ${aggregate.expLevelDelta} XP level${
        aggregate.expLevelDelta > 1 ? 's' : ''
      }`
    );
    confidencePoints += 0.5;
  }

  if (aggregate.superTroopsActivated.size > 0) {
    const superTroopScore = 2;
    addScore('superTroops', superTroopScore);
    indicatorSet.add(
      `Activated ${Array.from(aggregate.superTroopsActivated).join(', ')}`
    );
    confidencePoints += 0.5;
  }

  if (aggregate.trophyDelta >= 100 || aggregate.rankedTrophyDelta >= 100) {
    const trophySwingScore = 4;
    addScore('trophies', trophySwingScore);
    indicatorSet.add('Significant trophy swing');
    confidencePoints += 0.5;
  }

  if (aggregate.donationDelta >= 100 || aggregate.donationReceivedDelta >= 100) {
    const donationBurstScore = 4;
    addScore('donations', donationBurstScore);
    indicatorSet.add('Donation burst');
    confidencePoints += 0.5;
  }

  // Hero development weighting
  const th = getTownHallLevel(member);
  const heroes = [member.bk, member.aq, member.gw, member.rc, member.mp];
  const hasHeroes = heroes.some((level) => level && level > 0);

  if (hasHeroes) {
    const maxHeroes = getHeroCaps(th);
    const heroKeys: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc', 'mp'];
    const heroProgress = heroes
      .map((level, idx) => {
        const heroKey = heroKeys[idx];
        const max = maxHeroes[heroKey] || 0;
        return max > 0 ? ((level || 0) / max) * 100 : 0;
      })
      .filter((p) => p > 0);

    if (heroProgress.length > 0) {
      const avgProgress =
        heroProgress.reduce((sum, p) => sum + p, 0) / heroProgress.length;
      if (avgProgress >= 80) {
        addScore('heroProgress', 6);
        indicatorSet.add('Heroes near cap (80%+)');
      } else if (avgProgress >= 60) {
        addScore('heroProgress', 4);
        indicatorSet.add('Strong hero development (60%+)');
      } else if (avgProgress >= 40) {
        addScore('heroProgress', 3);
        indicatorSet.add('Heroes improving (40%+)');
      } else {
        addScore('heroProgress', 1);
        indicatorSet.add('Heroes active');
      }
    }
  }

  // Clan role weighting
  const role = member.role?.toLowerCase() ?? '';
  if (role === 'leader') {
    addScore('role', 8);
    indicatorSet.add('Clan leader');
  } else if (role === 'coleader') {
    addScore('role', 7);
    indicatorSet.add('Co-leader role');
  } else if (role === 'elder') {
    addScore('role', 4);
    indicatorSet.add('Elder responsibilities');
  }

  // Trophy context
  const trophies = member.trophies ?? 0;
  if (trophies >= 5000) {
    addScore('trophies', 4);
    indicatorSet.add('Legend-tier trophies (5000+)');
  } else if (trophies >= 4200) {
    addScore('trophies', 3);
    indicatorSet.add('High trophy count (4200+)');
  } else if (trophies >= 3600) {
    addScore('trophies', 2);
    indicatorSet.add('Competitive trophy range (3600+)');
  } else if (trophies >= 3000) {
    addScore('trophies', 1);
  }

  score = Math.max(0, score);
  const breakdownTotal = score;
  const finalScore = Math.round(breakdownTotal);
  const confidence = pointsToConfidence(confidencePoints);

  let level: ActivityLevel;
  if (finalScore >= 70) {
    level = 'Very Active';
  } else if (finalScore >= 45) {
    level = 'Active';
  } else if (finalScore >= 28) {
    level = 'Moderate';
  } else if (finalScore >= 15) {
    level = 'Low';
  } else {
    level = 'Inactive';
  }

  const lastActiveAt =
    lastEventTs !== null ? new Date(lastEventTs).toISOString() : new Date().toISOString();
  const metrics: ActivityMetrics = {
    lookbackDays,
    timelineSampleSize: timeline.length,
    realTimeScore: realTimeActivity.score,
    warStarsDelta: aggregate.warStarsDelta,
    attackWinsDelta: aggregate.attackWinsDelta,
    defenseWinsDelta: aggregate.defenseWinsDelta,
    capitalContributionDelta: aggregate.capitalContributionDelta,
    builderWinsDelta: aggregate.builderWinsDelta,
    builderHallDelta: aggregate.builderHallDelta,
    donationDelta: aggregate.donationDelta,
    donationReceivedDelta: aggregate.donationReceivedDelta,
    trophyDelta: aggregate.trophyDelta,
    rankedTrophyDelta: aggregate.rankedTrophyDelta,
    heroUpgrades: aggregate.heroUpgrades,
    petUpgrades: aggregate.petUpgrades,
    equipmentUpgrades: aggregate.equipmentUpgrades,
    labUpgradeDelta: aggregate.maxTroopDelta + aggregate.maxSpellDelta,
    achievementDelta: aggregate.achievementDelta,
    expLevelDelta: aggregate.expLevelDelta,
    superTroopsActivated: aggregate.superTroopsActivated.size,
  };

  return {
    last_active_at: lastActiveAt,
    confidence,
    indicators: Array.from(indicatorSet),
    score: finalScore,
    level,
    breakdown,
    metrics,
    lookbackDays,
  };
};

export const getMemberActivity = (
  member: Member,
  options?: ActivityScoreOptions
): ActivityEvidence => {
  if (member.activity) {
    return member.activity;
  }
  return calculateActivityScore(member, options);
};

/**
 * Get activity weighting for manual overrides
 */
export const getActivityWeighting = (activity: ActivityLevel): number => {
  switch (activity) {
    case "Very Active": return 50;
    case "Active": return 40;
    case "Moderate": return 30;
    case "Low": return 20;
    case "Inactive": return 0;
    default: return 0;
  }
};

/**
 * Calculate real-time activity using multi-indicator approach
 * 
 * New scoring system (Jan 2025):
 * - Ranked Battle Participation: 0-20 points (definitive real-time indicator)
 * - Donations: 0-15 points (reduced from 50)
 * - War/Raids/Builder play: scored via timeline enrichment (see calculateActivityScore)
 * - Hero Development: 0-10 points
 * - Clan Role: 0-10 points
 * - Trophy Activity: 0-10 points (placeholder)
 */
export const calculateRealTimeActivity = (member: Member): {
  activity_level: ActivityLevel;
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  score: number;
  indicators: string[];
} => {
  let score = 0;
  const indicators: string[] = [];
  let indicatorCount = 0;
  
  // 1. RANKED BATTLE PARTICIPATION (0-20 points) - Definitive real-time indicator
  const rankedLeagueId = member.rankedLeagueId ?? (member.rankedLeague as any)?.id ?? member.leagueId;
  const rankedLeagueName = member.rankedLeagueName ?? (member.rankedLeague as any)?.name ?? member.leagueName ?? null;
  const trophies = member.rankedTrophies ?? member.trophies ?? 0;
  const hasLeague = Boolean(rankedLeagueId && rankedLeagueId !== 105000000) || Boolean(rankedLeagueName);
  
  if (hasLeague && trophies > 0) {
    // Has league assignment AND active trophies = definitely participating
    score += 20;
    indicators.push('Active ranked battles');
    indicatorCount++;
  } else if (hasLeague) {
    // Has league but no trophies = enrolled but not active
    score += 5;
    indicators.push('Ranked enrolled (not battling)');
  }
  
  // 2. DONATIONS (0-15 points) - Reduced weight from 50
  const donations = member.donations ?? 0;
  if (donations >= 500) {
    score += 15;
    indicators.push('Heavy donator (500+)');
    indicatorCount++;
  } else if (donations >= 200) {
    score += 12;
    indicators.push('Strong donator (200+)');
    indicatorCount++;
  } else if (donations >= 100) {
    score += 10;
    indicators.push('Active donator (100+)');
    indicatorCount++;
  } else if (donations >= 50) {
    score += 7;
    indicators.push('Regular donator (50+)');
  } else if (donations >= 10) {
    score += 5;
    indicators.push('Occasional donator (10+)');
  } else if (donations > 0) {
    score += 2;
    indicators.push('Minimal donations');
  }
  
  // 3. WAR/RAIDS/CLAN GAMES (0-35 points) - PLACEHOLDER
  // Future: Implement when war/raid/clan games data is available
  // For now, we don't add points here, but preserve the scoring space
  
  // Determine confidence level based on number of definitive indicators
  let confidence: 'definitive' | 'high' | 'medium' | 'weak';
  if (indicatorCount >= 2) {
    confidence = 'definitive'; // Multiple strong indicators
  } else if (indicatorCount === 1) {
    confidence = 'high'; // Single strong indicator
  } else if (indicators.length > 0) {
    confidence = 'medium'; // Weak indicators present
  } else {
    confidence = 'weak'; // No indicators
  }
  
  // Determine preliminary activity level based on real-time score
  // This is just for real-time indicators (max 35 pts), final level calculated in calculateActivityScore
  let activity_level: ActivityLevel;
  if (score >= 30) {
    activity_level = 'Very Active';
  } else if (score >= 20) {
    activity_level = 'Active';
  } else if (score >= 10) {
    activity_level = 'Moderate';
  } else if (score >= 5) {
    activity_level = 'Low';
  } else {
    activity_level = 'Inactive';
  }
  
  return {
    activity_level,
    confidence,
    score,
    indicators
  };
};

// =============================================================================
// WAR ANALYTICS
// =============================================================================

/**
 * Calculate war analytics for a member
 */
export const calculateWarAnalytics = (member: Member): WarAnalytics => {
  // This would need historical war data to be accurate
  // For now, returning placeholder data
  return {
    attackEfficiencyIndex: 2.5, // Average stars per attack
    contributionConsistency: 85, // Performance steadiness (0-100)
    cleanupEfficiency: 75, // Cleanup success rate (0-100)
    defensiveHoldRate: 60, // Defensive success rate (0-100)
    performanceTrend: 'stable',
    lastWarPerformance: {
      stars: 6,
      attacks: 2,
      efficiency: 3.0
    }
  };
};

// =============================================================================
// PLAYER DNA CALCULATIONS
// =============================================================================

/**
 * Calculate player DNA archetype
 */
export const calculatePlayerArchetype = (member: Member): PlayerArchetype => {
  const donationBalance = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const warAnalytics = calculateWarAnalytics(member);
  
  // Simplified archetype calculation
  const leadership = member.role === 'leader' ? 90 : member.role === 'coleader' ? 70 : 30;
  const performance = warAnalytics.contributionConsistency;
  const generosity = Math.max(0, 100 - (donationBalance.balance / 10));
  
  // Determine archetype based on scores
  if (leadership >= 80 && performance >= 80 && generosity >= 80) {
    return 'Balanced Titan';
  } else if (generosity >= 90) {
    return 'Alpha Donor';
  } else if (performance >= 80 && generosity <= 50) {
    return 'War Machine';
  } else if (generosity >= 70 && performance <= 60) {
    return 'Social Connector';
  } else if (performance >= 70 && leadership <= 50) {
    return 'Rising Star';
  } else if (leadership >= 70 && performance <= 60) {
    return 'Veteran Leader';
  } else if (activity.level === 'Inactive') {
    return 'Inactive Member';
  } else {
    return 'Casual Player';
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format clan tag for display
 */
export const formatClanTag = (tag: string): string => {
  return tag.toUpperCase().replace(/^#/, '');
};

/**
 * Format player name with fallback
 */
export const formatPlayerName = (member: Member): string => {
  return member.name || 'Unknown Player';
};

/**
 * Calculate member tenure in days
 */
export const calculateTenure = (member: Member): number => {
  return member.tenure_days ?? member.tenure ?? 0;
};

/**
 * Check if member is new (less than 7 days tenure)
 */
export const isNewMember = (member: Member): boolean => {
  return calculateTenure(member) < 7;
};

/**
 * Check if member is rushed
 */
export const isRushed = (member: Member, thCaps?: Map<number, HeroCaps>): boolean => {
  return calculateRushPercentage(member, thCaps) > 50;
};

/**
 * Check if member is very rushed
 */
export const isVeryRushed = (member: Member, thCaps?: Map<number, HeroCaps>): boolean => {
  return calculateRushPercentage(member, thCaps) > 80;
};

/**
 * Get member's effective Town Hall level
 */
export const getEffectiveTownHall = (member: Member): number => {
  return getTownHallLevel(member);
};

/**
 * Calculate member's overall score (0-100)
 */
export const calculateOverallScore = (member: Member): number => {
  const activity = calculateActivityScore(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  
  let score = activity.score;
  
  // Adjust for rush percentage (negative impact)
  score -= rushPercent * 0.3;
  
  // Adjust for donation balance (negative if receiving more than giving)
  if (donationBalance.isNegative) {
    score -= Math.min(20, donationBalance.balance / 10);
  }
  
  return Math.max(0, Math.min(100, score));
};

// =============================================================================
// ACE METRICS
// =============================================================================

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const getAceExtras = (member: Member) => {
  return (member as any)?.extras?.ace ?? null;
};

/**
 * Retrieve the ACE availability multiplier (0-1) if present
 */
export const getMemberAceAvailability = (member: Member): number | null => {
  const extras = getAceExtras(member);
  if (!extras) return null;
  const availability = extras.availability;
  return isFiniteNumber(availability) ? availability : null;
};

/**
 * Retrieve the displayed ACE score for a member from persisted extras
 */
export const getMemberAceScore = (member: Member): number | null => {
  const extras = getAceExtras(member);
  if (!extras) return null;

  if (isFiniteNumber(extras.score)) {
    return extras.score;
  }

  const availability = getMemberAceAvailability(member) ?? 1;

  if (isFiniteNumber(extras.logistic)) {
    return extras.logistic * 100 * availability;
  }

  if (isFiniteNumber(extras.core)) {
    const logistic = computeAceLogistic(extras.core, ACE_DEFAULT_LOGISTIC_ALPHA);
    return logistic * 100 * availability;
  }

  return null;
};
