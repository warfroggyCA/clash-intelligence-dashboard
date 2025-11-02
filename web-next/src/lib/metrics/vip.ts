/**
 * VIP Score Calculator
 * VIP = Very Important Player
 * 
 * VIP = (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
 * 
 * Where:
 * - Competitive = Ranked Performance + War Performance (50% weight)
 * - Support = Donations + Capital Contributions (30% weight)
 * - Development = Base Quality + Activity (20% weight)
 * 
 * This metric measures comprehensive clan contribution across all game modes.
 */

// =============================================================================
// Helper Functions (previously from wci.ts, now integrated)
// =============================================================================

/**
 * Calculate Trophy Progression Gain (TPG)
 * Measures: How much did they gain this week?
 * Formula: Normalize trophy delta to 0-100 scale
 */
function calculateTPG(
  rankedTrophiesStart: number | null,
  rankedTrophiesEnd: number | null
): number {
  if (rankedTrophiesStart == null || rankedTrophiesEnd == null) {
    return 50; // Neutral if missing data
  }
  
  const delta = rankedTrophiesEnd - rankedTrophiesStart;
  
  // Normalize: 800+ trophy gain = 100, 0 = 50, negative = <50
  // Scale: -400 to +800 maps to 0-100
  const normalized = Math.max(0, Math.min(100, 50 + (delta / 8)));
  
  return Math.round(normalized * 100) / 100;
}

/**
 * Calculate League Advancement Index (LAI)
 * Measures: Did they promote, retain, or get demoted?
 * 
 * Based on league tier comparison (inferred from leagueTier.id)
 */
function calculateLAI(
  leagueTierStart: number | null,
  leagueTierEnd: number | null,
  rankedTrophiesEnd: number | null
): number {
  // Extract tier numbers from league IDs (format: 105000001-105000034)
  // The last 6 digits contain the tier number: 105000013 → 13
  const tierStart = leagueTierStart 
    ? leagueTierStart % 1000000
    : null;
  const tierEnd = leagueTierEnd
    ? leagueTierEnd % 1000000
    : null;
  
  if (tierStart == null || tierEnd == null) {
    // Can't determine if no tier data
    return rankedTrophiesEnd != null && rankedTrophiesEnd > 0 ? 60 : 30;
  }
  
  if (tierEnd > tierStart) {
    return 100; // Promoted
  } else if (tierEnd < tierStart) {
    return 20; // Demoted
  } else {
    // Same tier - check if they have trophies (active)
    return rankedTrophiesEnd != null && rankedTrophiesEnd > 0 ? 70 : 40;
  }
}

/**
 * Calculate Progression Debt Reduction (PDR)
 * Measures: Are they fixing their rushed base?
 * Formula: 100 - rushPercent (lower rush = higher score)
 */
function calculatePDR(rushPercent: number | null): number {
  if (rushPercent == null) return 50; // Neutral if unknown
  // Lower rush% = higher PDR score
  return Math.max(0, Math.min(100, 100 - rushPercent));
}

// =============================================================================
// Competitive Performance Components
// =============================================================================

export interface RankedComponents {
  lai: number;  // League Advancement Index (0-100)
  tpg: number;  // Trophy Progression Gain (0-100)
}

export interface WarComponents {
  ova: number;  // Offense Value Above Expectation (standardized z-score)
  dva: number;  // Defense Value Above Expectation (standardized z-score)
  hasWarData: boolean;  // Whether war data is available
}

export interface CompetitiveComponents {
  ranked: RankedComponents;
  war: WarComponents;
}

// =============================================================================
// Support Performance Components
// =============================================================================

export interface SupportComponents {
  donations: number;      // Donation Support Score (0-100)
  capital: number;        // Capital Contributions Delta Score (0-100)
}

// =============================================================================
// Development Performance Components
// =============================================================================

export interface DevelopmentComponents {
  baseQuality: number;   // PDR Score (0-100)
  activity: number;       // Activity Score (0-100)
  heroProgression: number; // Hero Upgrade Score (0-100)
}

// =============================================================================
// Main VIP Score Interface
// =============================================================================

export interface VIPScore {
  // Competitive Performance (50%)
  competitive: {
    ranked: RankedComponents;
    war: WarComponents;
    score: number;  // Combined Competitive (0-100)
  };
  // Support Performance (30%)
  support: SupportComponents & {
    score: number;  // Combined Support (0-100)
  };
  // Development Performance (20%)
  development: DevelopmentComponents & {
    score: number;  // Combined Development (0-100)
  };
  // Final Score
  vip: number;  // (0.50 × competitive.score) + (0.30 × support.score) + (0.20 × development.score)
  
  // Metadata
  weekStart: Date;
  weekEnd: Date;
  rankedTrophiesStart: number | null;
  rankedTrophiesEnd: number | null;
  leagueTierStart: number | null;
  leagueTierEnd: number | null;
  leagueNameStart: string | null;
  leagueNameEnd: string | null;
}

// =============================================================================
// Ranked Performance Calculation
// =============================================================================

/**
 * Calculate Ranked Performance Score
 * CP_ranked = (0.70 × LAI) + (0.30 × TPG)
 */
export function calculateRankedScore(components: RankedComponents): number {
  const score = (components.lai * 0.70) + (components.tpg * 0.30);
  return Math.round(score * 100) / 100;
}

// =============================================================================
// War Performance Calculation
// =============================================================================

/**
 * Calculate War Performance Score
 * CP_war = (0.60 × OVA) + (0.40 × DVA)
 * 
 * If no war data available, returns neutral score (50)
 */
export function calculateWarScore(components: WarComponents): number {
  if (!components.hasWarData) {
    return 50; // Neutral if no war data
  }
  
  // Convert z-scores to 0-100 scale
  // Assuming z-scores are typically in range -3 to +3
  // Map to 0-100: z = 0 → 50, z = +3 → 100, z = -3 → 0
  const ovaNormalized = Math.max(0, Math.min(100, 50 + (components.ova * 16.67)));
  const dvaNormalized = Math.max(0, Math.min(100, 50 + (components.dva * 16.67)));
  
  const score = (ovaNormalized * 0.60) + (dvaNormalized * 0.40);
  return Math.round(score * 100) / 100;
}

/**
 * Calculate Competitive Performance Score
 * Competitive = (0.60 × Ranked) + (0.40 × War)
 */
export function calculateCompetitiveScore(components: CompetitiveComponents): number {
  const rankedScore = calculateRankedScore(components.ranked);
  const warScore = calculateWarScore(components.war);
  
  const score = (rankedScore * 0.60) + (warScore * 0.40);
  return Math.round(score * 100) / 100;
}

// =============================================================================
// Donation Support Calculation (Small Clan Friendly)
// =============================================================================

/**
 * Calculate Donation Support Score
 * Rewards any donations given - doesn't penalize for receiving more than giving
 * Small clans have fewer donation requests, so we reward participation
 */
export function calculateDonationSupport(
  donationsGiven: number,
  donationsReceived: number
): number {
  // Base score: reward any donations at all
  if (donationsGiven === 0) {
    return 50; // Neutral if no donations
  }
  
  // Tiered rewards based on absolute donations given
  // Small clans: reward any participation
  if (donationsGiven >= 500) return 100;
  if (donationsGiven >= 300) return 85;
  if (donationsGiven >= 200) return 75;
  if (donationsGiven >= 100) return 65;
  if (donationsGiven >= 50) return 60;
  if (donationsGiven >= 25) return 55;
  if (donationsGiven > 0) return 52; // Small but meaningful participation
  
  return 50;
}

// =============================================================================
// Capital Support Calculation
// =============================================================================

/**
 * Calculate Capital Support Score
 * Measures week-over-week capital contributions delta
 */
export function calculateCapitalSupport(
  capitalContributionsStart: number | null,
  capitalContributionsEnd: number | null
): number {
  if (capitalContributionsStart == null || capitalContributionsEnd == null) {
    return 50; // Neutral if missing data
  }
  
  const delta = capitalContributionsEnd - capitalContributionsStart;
  
  // Scoring tiers
  if (delta >= 1000) return 100;
  if (delta >= 500) return 75;
  if (delta >= 100) return 50;
  if (delta >= 50) return 25;
  if (delta > 0) return 10;
  if (delta === 0) return 50; // Neutral
  return Math.max(0, 50 + (delta / 2)); // Penalize for negative delta
}

/**
 * Calculate Support Performance Score
 * Support = (0.60 × Donations) + (0.40 × Capital)
 */
export function calculateSupportScore(components: SupportComponents): number {
  const score = (components.donations * 0.60) + (components.capital * 0.40);
  return Math.round(score * 100) / 100;
}

// =============================================================================
// Activity Calculation (Improved)
// =============================================================================

/**
 * Calculate Activity Score (Improved)
 * Removes duplication, uses capital delta, achievement delta, and war participation
 */
export function calculateActivityScore(inputs: {
  capitalContributionsStart: number | null;
  capitalContributionsEnd: number | null;
  achievementScoreStart: number | null;
  achievementScoreEnd: number | null;
  warStarsStart: number | null;
  warStarsEnd: number | null;
}): number {
  let score = 0;
  
  // Capital Activity (0-40 points)
  if (inputs.capitalContributionsStart != null && inputs.capitalContributionsEnd != null) {
    const capitalDelta = inputs.capitalContributionsEnd - inputs.capitalContributionsStart;
    if (capitalDelta >= 1000) score += 40;
    else if (capitalDelta >= 500) score += 30;
    else if (capitalDelta >= 100) score += 20;
    else if (capitalDelta >= 50) score += 10;
    else if (capitalDelta > 0) score += 5;
  }
  
  // Achievement Activity (0-30 points)
  if (inputs.achievementScoreStart != null && inputs.achievementScoreEnd != null) {
    const achievementDelta = inputs.achievementScoreEnd - inputs.achievementScoreStart;
    if (achievementDelta >= 100) score += 30;
    else if (achievementDelta >= 50) score += 20;
    else if (achievementDelta >= 25) score += 10;
    else if (achievementDelta > 0) score += 5;
  }
  
  // War Participation (0-30 points)
  if (inputs.warStarsStart != null && inputs.warStarsEnd != null) {
    const warStarsDelta = inputs.warStarsEnd - inputs.warStarsStart;
    if (warStarsDelta > 0) score += 30; // Participated in war
  }
  
  return Math.min(100, score);
}

/**
 * Calculate Hero Progression Score
 * Measures hero upgrades week-over-week
 * Rewards any hero upgrades as meaningful progression
 */
export function calculateHeroProgression(
  heroLevelsStart: { bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null } | null,
  heroLevelsEnd: { bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null } | null
): number {
  if (!heroLevelsStart || !heroLevelsEnd) {
    return 50; // Neutral if missing data
  }
  
  let totalUpgrades = 0;
  
  // Check each hero for upgrades
  const heroes = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;
  for (const hero of heroes) {
    const startLevel = heroLevelsStart[hero] ?? 0;
    const endLevel = heroLevelsEnd[hero] ?? 0;
    if (endLevel > startLevel) {
      totalUpgrades += endLevel - startLevel;
    }
  }
  
  // Score based on total hero levels gained
  // Each level upgrade is valuable progression
  if (totalUpgrades >= 5) return 100; // Major progression
  if (totalUpgrades >= 3) return 85;
  if (totalUpgrades >= 2) return 75;
  if (totalUpgrades >= 1) return 65;
  return 50; // Neutral if no upgrades
}

/**
 * Calculate Development Performance Score
 * Development = (0.40 × Base Quality) + (0.30 × Activity) + (0.30 × Hero Progression)
 */
export function calculateDevelopmentScore(components: DevelopmentComponents): number {
  const score = (components.baseQuality * 0.40) + (components.activity * 0.30) + (components.heroProgression * 0.30);
  return Math.round(score * 100) / 100;
}

// =============================================================================
// Final VIP Calculation
// =============================================================================

/**
 * Calculate final VIP score
 * VIP = (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
 */
export function calculateVIP(
  competitiveScore: number,
  supportScore: number,
  developmentScore: number
): number {
  const vip = (competitiveScore * 0.50) + (supportScore * 0.30) + (developmentScore * 0.20);
  return Math.round(vip * 100) / 100;
}

// =============================================================================
// Main VIP Calculation Function
// =============================================================================

/**
 * Calculate VIP Score for a member
 * Combines ranked performance, war performance, support, and development
 */
export function calculateVIPForMember(inputs: {
  // Ranked Performance
  rankedTrophiesStart: number | null;
  rankedTrophiesEnd: number | null;
  leagueTierStart: number | null;
  leagueTierEnd: number | null;
  leagueNameStart: string | null;
  leagueNameEnd: string | null;
  
  // War Performance (from ACE calculation)
  warOva: number | null;  // Offense Value Above Expectation (z-score)
  warDva: number | null;  // Defense Value Above Expectation (z-score)
  
  // Support Metrics
  donationsGiven: number;
  donationsReceived: number;
  capitalContributionsStart: number | null;
  capitalContributionsEnd: number | null;
  
  // Development Metrics
  rushPercent: number | null;
  heroLevelsStart: { bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null } | null;
  heroLevelsEnd: { bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null } | null;
  achievementScoreStart: number | null;
  achievementScoreEnd: number | null;
  warStarsStart: number | null;
  warStarsEnd: number | null;
  
  // Week period
  weekStart: Date;
  weekEnd: Date;
}): VIPScore {
  // Calculate Competitive Performance
  const rankedComponents: RankedComponents = {
    lai: calculateLAI(
      inputs.leagueTierStart,
      inputs.leagueTierEnd,
      inputs.rankedTrophiesEnd
    ),
    tpg: calculateTPG(inputs.rankedTrophiesStart, inputs.rankedTrophiesEnd),
  };
  
  const warComponents: WarComponents = {
    ova: inputs.warOva ?? 0,
    dva: inputs.warDva ?? 0,
    hasWarData: inputs.warOva != null && inputs.warDva != null,
  };
  
  const competitiveComponents: CompetitiveComponents = {
    ranked: rankedComponents,
    war: warComponents,
  };
  
  const competitiveScore = calculateCompetitiveScore(competitiveComponents);
  
  // Calculate Support Performance
  const supportComponents: SupportComponents = {
    donations: calculateDonationSupport(
      inputs.donationsGiven,
      inputs.donationsReceived
    ),
    capital: calculateCapitalSupport(
      inputs.capitalContributionsStart,
      inputs.capitalContributionsEnd
    ),
  };
  
  const supportScore = calculateSupportScore(supportComponents);
  
  // Calculate Development Performance
  const developmentComponents: DevelopmentComponents = {
    baseQuality: calculatePDR(inputs.rushPercent),
    activity: calculateActivityScore({
      capitalContributionsStart: inputs.capitalContributionsStart,
      capitalContributionsEnd: inputs.capitalContributionsEnd,
      achievementScoreStart: inputs.achievementScoreStart,
      achievementScoreEnd: inputs.achievementScoreEnd,
      warStarsStart: inputs.warStarsStart,
      warStarsEnd: inputs.warStarsEnd,
    }),
    heroProgression: calculateHeroProgression(
      inputs.heroLevelsStart,
      inputs.heroLevelsEnd
    ),
  };
  
  const developmentScore = calculateDevelopmentScore(developmentComponents);
  
  // Calculate final VIP
  const vip = calculateVIP(competitiveScore, supportScore, developmentScore);
  
  return {
    competitive: {
      ...competitiveComponents,
      score: competitiveScore,
    },
    support: {
      ...supportComponents,
      score: supportScore,
    },
    development: {
      ...developmentComponents,
      score: developmentScore,
    },
    vip,
    weekStart: inputs.weekStart,
    weekEnd: inputs.weekEnd,
    rankedTrophiesStart: inputs.rankedTrophiesStart,
    rankedTrophiesEnd: inputs.rankedTrophiesEnd,
    leagueTierStart: inputs.leagueTierStart,
    leagueTierEnd: inputs.leagueTierEnd,
    leagueNameStart: inputs.leagueNameStart,
    leagueNameEnd: inputs.leagueNameEnd,
  };
}

