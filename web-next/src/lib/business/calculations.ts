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
 */
export const calculateActivityScore = (member: Member): ActivityEvidence => {
  let score = 0;
  const indicators: string[] = [];
  
  // Real-time activity indicators (0-50 points)
  const realTimeActivity = calculateRealTimeActivity(member);
  const manualWeight = getActivityWeighting(realTimeActivity.activity_level);
  
  if (realTimeActivity.confidence === 'definitive') {
    score += 50;
    indicators.push("Definitive activity evidence");
  } else if (realTimeActivity.confidence === 'high') {
    score += 40;
    indicators.push("High confidence activity");
  } else {
    score += manualWeight;
  }
  
  // Trophy activity (0-25 points)
  const trophies = member.trophies ?? 0;
  const trophyChange = 0; // Would need historical data to calculate
  
  if (trophyChange > 0) {
    score += 25;
    indicators.push("Trophy gains detected");
  } else if (trophyChange >= -50) {
    score += 5;
    indicators.push("Stable trophy count");
  }
  
  // Town Hall progress (0-20 points)
  const th = getTownHallLevel(member);
  if (th >= 14) {
    score += 20;
    indicators.push("High TH level");
  } else if (th >= 11) {
    score += 15;
    indicators.push("Mid-high TH level");
  } else if (th >= 8) {
    score += 10;
    indicators.push("Mid TH level");
  } else {
    score += 5;
    indicators.push("Lower TH level");
  }
  
  // Hero activity (0-15 points)
  const heroes = [member.bk, member.aq, member.gw, member.rc, member.mp];
  const hasHeroes = heroes.some(level => level && level > 0);
  
  if (hasHeroes) {
    const maxHeroes = getHeroCaps(th);
    const heroProgress = heroes.map((level, idx) => {
      const heroKey = ['bk', 'aq', 'gw', 'rc', 'mp'][idx] as keyof HeroCaps;
      const max = maxHeroes[heroKey] || 0;
      return max > 0 ? ((level || 0) / max) * 100 : 0;
    });
    
    const avgProgress = heroProgress.reduce((sum, p) => sum + p, 0) / heroProgress.length;
    if (avgProgress > 50) {
      score += 15;
      indicators.push("Active hero development");
    } else {
      score += 5;
      indicators.push("Heroes present");
    }
  }
  
  // Clan role activity (0-10 points)
  const role = member.role?.toLowerCase() ?? '';
  if (role === 'leader' || role === 'coleader') {
    score += 10;
    indicators.push("Leadership role");
  } else if (role === 'elder') {
    score += 5;
    indicators.push("Elder role");
  }
  
  // Determine activity level
  let level: ActivityLevel;
  if (score >= 80) {
    level = 'Very Active';
  } else if (score >= 60) {
    level = 'Active';
  } else if (score >= 40) {
    level = 'Moderate';
  } else if (score >= 20) {
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
 * Calculate real-time activity (placeholder - would need actual implementation)
 */
export const calculateRealTimeActivity = (member: Member): {
  activity_level: ActivityLevel;
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
} => {
  // This is a simplified version - the actual implementation would be more complex
  const donations = member.donations ?? 0;
  const lastSeen = member.lastSeen;
  
  if (donations > 500) {
    return { activity_level: 'Very Active', confidence: 'definitive' };
  } else if (donations > 100) {
    return { activity_level: 'Active', confidence: 'high' };
  } else if (donations > 10) {
    return { activity_level: 'Moderate', confidence: 'medium' };
  } else {
    return { activity_level: 'Inactive', confidence: 'weak' };
  }
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
