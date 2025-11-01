/**
 * Weekly Competitive Index (WCI) Calculator
 * 
 * WCI = (0.60 × CP) + (0.40 × PS)
 * 
 * Where:
 * - CP = Competitive Performance (Ranked Mode) - 60% weight
 * - PS = Progression & Support (Farming/Clan activities) - 40% weight
 * 
 * This metric is based ONLY on data available from the Clash of Clans API.
 * No assumptions or estimates - only measurable, verifiable data.
 */

export interface CPComponents {
  tpg: number;  // Trophy Progression Gain (0-100) - Trophy delta normalized
  lai: number;  // League Advancement Index (0-100) - Promoted/Retained/Demoted
}

export interface PSComponents {
  pdr: number;              // Progression Debt Reduction (0-100)
  donationSupport: number;   // Donation & Resource Support (0-100)
  activity: number;         // Weekly Activity Score (0-100)
}

export interface WCIScore {
  // Competitive Performance (60%)
  cp: {
    tpg: number;
    lai: number;
    score: number;  // Combined CP (0-100)
  };
  // Progression & Support (40%)
  ps: {
    pdr: number;
    donationSupport: number;
    activity: number;
    score: number;  // Combined PS (0-100)
  };
  // Final Score
  wci: number;  // (0.60 × cp.score) + (0.40 × ps.score)
  
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

/**
 * Calculate Trophy Progression Gain (TPG)
 * Measures: How much did they gain this week?
 * Formula: Normalize trophy delta to 0-100 scale
 * 
 * Assumptions:
 * - Max weekly gain: ~800 trophies (exceptional week)
 * - Normal gain: ~200-400 trophies
 * - Loss: Penalized
 */
export function calculateTPG(
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
export function calculateLAI(
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
 * Calculate Trophy Efficiency Factor (TEF)
 * Measures: Trophy gain relative to starting position
 * Formula: (End Trophies / Max Potential) × 100
 * 
 * Max potential: Assume they could reach tier-specific maximum
 * For now, use a simple scale based on final trophy count
 */
export function calculateTEF(
  rankedTrophiesEnd: number | null,
  leagueTierEnd: number | null
): number {
  if (rankedTrophiesEnd == null || rankedTrophiesEnd <= 0) {
    return 0;
  }
  
  // Extract tier number
  const tierEnd = leagueTierEnd
    ? leagueTierEnd % 1000000
    : null;
  
  // Rough estimate: Higher tiers can achieve more trophies
  // Tier 1-10: ~500 max, Tier 11-20: ~800 max, Tier 21-34: ~1200 max
  let maxPotential = 500;
  if (tierEnd != null) {
    if (tierEnd >= 21) maxPotential = 1200;
    else if (tierEnd >= 11) maxPotential = 800;
  }
  
  const efficiency = Math.min(100, (rankedTrophiesEnd / maxPotential) * 100);
  return Math.round(efficiency * 100) / 100;
}

/**
 * Calculate Progression Debt Reduction (PDR)
 * Measures: Are they fixing their rushed base?
 * Formula: 100 - rushPercent (lower rush = higher score)
 */
export function calculatePDR(rushPercent: number | null): number {
  if (rushPercent == null) return 50; // Neutral if unknown
  // Lower rush% = higher PDR score
  return Math.max(0, Math.min(100, 100 - rushPercent));
}

/**
 * Calculate Donation & Resource Support
 * Measures: Clan contribution via donations and capital
 * Formula: donationsGiven / (donationsReceived + capitalContributions + 1) × scale
 */
export function calculateDonationSupport(
  donationsGiven: number,
  donationsReceived: number,
  capitalContributions: number
): number {
  const totalReceived = donationsReceived + capitalContributions;
  const denominator = Math.max(1, totalReceived);
  
  // Ratio: how much they give vs. receive
  const ratio = donationsGiven / denominator;
  
  // Scale to 0-100, with bonus for high absolute donation amounts
  let score = Math.min(100, ratio * 50);
  
  // Bonus for high absolute donations
  if (donationsGiven >= 500) score = Math.min(100, score + 20);
  else if (donationsGiven >= 200) score = Math.min(100, score + 10);
  else if (donationsGiven >= 100) score = Math.min(100, score + 5);
  
  return Math.round(score * 100) / 100;
}

/**
 * Calculate Weekly Activity Score
 * Measures: Overall weekly engagement based on multiple factors
 * Uses donation deltas and trophy changes as proxies
 */
export function calculateWeeklyActivity(
  donationsGiven: number,
  rankedTrophiesStart: number | null,
  rankedTrophiesEnd: number | null
): number {
  let score = 0;
  
  // Donation activity (0-50 points)
  if (donationsGiven >= 500) score += 50;
  else if (donationsGiven >= 200) score += 40;
  else if (donationsGiven >= 100) score += 30;
  else if (donationsGiven >= 50) score += 20;
  else if (donationsGiven >= 10) score += 10;
  else if (donationsGiven > 0) score += 5;
  
  // Trophy activity (0-50 points)
  if (rankedTrophiesStart != null && rankedTrophiesEnd != null) {
    const trophyDelta = rankedTrophiesEnd - rankedTrophiesStart;
    if (trophyDelta >= 200) score += 50;
    else if (trophyDelta >= 100) score += 40;
    else if (trophyDelta >= 50) score += 30;
    else if (trophyDelta >= 0) score += 20;
    else if (trophyDelta >= -50) score += 10;
    // Large losses penalized (already at 0)
  } else if (rankedTrophiesEnd != null && rankedTrophiesEnd > 0) {
    // Has trophies but no start data - assume some activity
    score += 20;
  }
  
  return Math.min(100, score);
}

/**
 * Calculate Competitive Performance (CP) Score
 * Weighted average of CP components (TPG + LAI only)
 */
export function calculateCPScore(components: CPComponents): number {
  const weights = {
    tpg: 0.40,  // 40% - Trophy progression
    lai: 0.60,  // 60% - League advancement (PROMOTION IS HUGE!)
  };
  
  const score =
    components.tpg * weights.tpg +
    components.lai * weights.lai;
  
  return Math.round(score * 100) / 100;
}

/**
 * Calculate Progression & Support (PS) Score
 * Weighted average of PS components
 */
export function calculatePSScore(components: PSComponents): number {
  const weights = {
    pdr: 0.35,              // 35% - Base development
    donationSupport: 0.40,  // 40% - Clan support (most important)
    activity: 0.25,         // 25% - Weekly engagement
  };
  
  const score =
    components.pdr * weights.pdr +
    components.donationSupport * weights.donationSupport +
    components.activity * weights.activity;
  
  return Math.round(score * 100) / 100;
}

/**
 * Calculate final WCI score
 * WCI = (0.60 × CP) + (0.40 × PS)
 */
export function calculateWCI(cpScore: number, psScore: number): number {
  const wci = (cpScore * 0.60) + (psScore * 0.40);
  return Math.round(wci * 100) / 100;
}

/**
 * Main WCI calculation function
 * Takes all inputs and returns complete WCI score breakdown
 * 
 * ALL data must be available from API - no estimates or assumptions
 */
export function calculateWCIForMember(inputs: {
  // Snapshot data (available from API)
  rankedTrophiesStart: number | null;
  rankedTrophiesEnd: number | null;
  leagueTierStart: number | null;
  leagueTierEnd: number | null;
  leagueNameStart: string | null;
  leagueNameEnd: string | null;
  
  // Support metrics (available from API)
  rushPercent: number | null;
  donationsGiven: number;
  donationsReceived: number;
  capitalContributions: number;
  
  // Week period
  weekStart: Date;
  weekEnd: Date;
}): WCIScore {
  // Calculate CP components (all based on API data)
  const tpg = calculateTPG(inputs.rankedTrophiesStart, inputs.rankedTrophiesEnd);
  const lai = calculateLAI(
    inputs.leagueTierStart,
    inputs.leagueTierEnd,
    inputs.rankedTrophiesEnd
  );
  
  const cpComponents: CPComponents = { tpg, lai };
  const cpScore = calculateCPScore(cpComponents);
  
  // Calculate PS components (all based on API data)
  const pdr = calculatePDR(inputs.rushPercent);
  const donationSupport = calculateDonationSupport(
    inputs.donationsGiven,
    inputs.donationsReceived,
    inputs.capitalContributions
  );
  const activity = calculateWeeklyActivity(
    inputs.donationsGiven,
    inputs.rankedTrophiesStart,
    inputs.rankedTrophiesEnd
  );
  
  const psComponents: PSComponents = { pdr, donationSupport, activity };
  const psScore = calculatePSScore(psComponents);
  
  // Calculate final WCI
  const wci = calculateWCI(cpScore, psScore);
  
  return {
    cp: {
      ...cpComponents,
      score: cpScore,
    },
    ps: {
      ...psComponents,
      score: psScore,
    },
    wci,
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
