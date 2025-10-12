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
  ActivityOption,
  PlayerArchetype,
  WarAnalytics,
  WarPerformanceData,
  TownHallLevel,
  HERO_MAX_LEVELS,
  HERO_MIN_TH
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

/**
 * Calculate activity score based on various factors
 * 
 * NEW MULTI-INDICATOR SCORING SYSTEM (Jan 2025):
 * Total: 0-100 points
 * 
 * Tier 1: Definitive Real-Time Indicators (0-70 points)
 * - Ranked Battle Participation: 0-20 points (definitive)
 * - War/Raids/Clan Games: 0-35 points (future - placeholder)
 * - Donations: 0-15 points
 * 
 * Tier 2: Supporting Indicators (0-30 points)
 * - Hero Development: 0-10 points
 * - Clan Role: 0-10 points
 * - Trophy Activity: 0-10 points (future - placeholder)
 */
export const calculateActivityScore = (member: Member): ActivityEvidence => {
  let score = 0;
  const indicators: string[] = [];
  
  // TIER 1: Real-time activity indicators (0-70 points)
  const realTimeActivity = calculateRealTimeActivity(member);
  score += realTimeActivity.score;
  indicators.push(...realTimeActivity.indicators);
  
  // TIER 2: Supporting indicators (0-30 points)
  
  // 1. Hero Development (0-10 points)
  const th = getTownHallLevel(member);
  const heroes = [member.bk, member.aq, member.gw, member.rc, member.mp];
  const hasHeroes = heroes.some(level => level && level > 0);
  
  if (hasHeroes) {
    const maxHeroes = getHeroCaps(th);
    const heroKeys: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc', 'mp'];
    const heroProgress = heroes.map((level, idx) => {
      const heroKey = heroKeys[idx];
      const max = maxHeroes[heroKey] || 0;
      return max > 0 ? ((level || 0) / max) * 100 : 0;
    }).filter(p => p > 0); // Only count heroes that exist at this TH
    
    if (heroProgress.length > 0) {
      const avgProgress = heroProgress.reduce((sum, p) => sum + p, 0) / heroProgress.length;
      if (avgProgress >= 80) {
        score += 10;
        indicators.push("Excellent hero development (80%+)");
      } else if (avgProgress >= 60) {
        score += 8;
        indicators.push("Strong hero development (60%+)");
      } else if (avgProgress >= 40) {
        score += 5;
        indicators.push("Moderate hero development (40%+)");
      } else {
        score += 2;
        indicators.push("Heroes present");
      }
    }
  }
  
  // 2. Clan Role (0-10 points)
  const role = member.role?.toLowerCase() ?? '';
  if (role === 'leader' || role === 'coleader') {
    score += 10;
    indicators.push("Leadership role");
  } else if (role === 'elder') {
    score += 5;
    indicators.push("Elder role");
  }
  
  // 3. Trophy Activity (0-10 points) - PLACEHOLDER
  // Future: Implement trophy change tracking when historical data is available
  // For now, we give minimal points based on current trophy count as a proxy
  const trophies = member.trophies ?? 0;
  if (trophies >= 5000) {
    score += 5;
    indicators.push("High trophy count (5000+)");
  } else if (trophies >= 4000) {
    score += 3;
    indicators.push("Strong trophy count (4000+)");
  } else if (trophies >= 3000) {
    score += 1;
  }
  
  // Determine final activity level based on total score
  let level: ActivityLevel;
  if (score >= 85) {
    level = 'Very Active';
  } else if (score >= 65) {
    level = 'Active';
  } else if (score >= 45) {
    level = 'Moderate';
  } else if (score >= 25) {
    level = 'Low';
  } else {
    level = 'Inactive';
  }
  
  return {
    last_active_at: new Date().toISOString(),
    confidence: realTimeActivity.confidence,
    indicators,
    score,
    level
  };
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
 * - War/Raids/Clan Games: 0-35 points (placeholder for future implementation)
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
  const trophies = member.trophies ?? 0;
  
  if (rankedLeagueId && rankedLeagueId !== 105000000 && trophies > 0) {
    // Has league assignment AND active trophies = definitely participating
    score += 20;
    indicators.push('Active ranked battles');
    indicatorCount++;
  } else if (rankedLeagueId && rankedLeagueId !== 105000000) {
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
