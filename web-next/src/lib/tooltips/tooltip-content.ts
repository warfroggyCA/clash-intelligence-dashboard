/**
 * Tooltip Content Library
 * 
 * Centralized tooltip definitions for all metrics, abbreviations, and features.
 * Supports markdown formatting and links to documentation.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TooltipContent {
  content: string | React.ReactNode;
  link?: string;
}

// =============================================================================
// TOOLTIP CONTENT MAP
// =============================================================================

export const TOOLTIP_CONTENT: Record<string, TooltipContent> = {
  // =============================================================================
  // METRICS & SCORES
  // =============================================================================
  ACE: {
    content: 'Attack Contribution Efficiency - A composite score measuring war attack performance, consistency, and impact.',
  },
  WPIE: {
    content: 'War Performance Impact Efficiency - Measures the effectiveness of war attacks relative to expected performance.',
  },
  WCI: {
    content: 'War Consistency Index - Tracks how consistently a player performs across multiple wars.',
  },
  VIP: {
    content: 'Victory Insight Profile - A comprehensive performance score combining war impact (40%), reliability (25%), capital & economy (20%), and service (15%).',
  },
  'War Efficiency': {
    content: 'Measures the percentage of successful war attacks and overall contribution to war outcomes.',
  },
  'War Consistency': {
    content: 'Tracks how consistently a player performs across multiple wars, penalizing high variance.',
  },
  'Activity Score': {
    content: 'A weighted score based on donations, activity, and engagement. Higher scores indicate more active players.',
  },
  'Rush %': {
    content: 'Percentage indicating how rushed a base is. Lower percentages indicate more maxed bases.',
  },
  'Carry Score': {
    content: 'Measures how much a player contributes relative to their expected contribution in capital raids.',
  },
  ROI: {
    content: 'Return on Investment - In capital raids, measures loot efficiency relative to attacks used.',
  },
  'Loot Efficiency': {
    content: 'Average loot per attack in capital raids. Higher values indicate more efficient raiding.',
  },
  'Avg Loot/Atk': {
    content: 'Average loot per attack - Total capital loot divided by number of attacks used.',
  },

  // =============================================================================
  // ABBREVIATIONS
  // =============================================================================
  TH: {
    content: 'Town Hall - The main building level that determines base progression and unlocks.',
  },
  BK: {
    content: 'Barbarian King - The first hero unlocked at Town Hall 7.',
  },
  AQ: {
    content: 'Archer Queen - The second hero unlocked at Town Hall 9.',
  },
  GW: {
    content: 'Grand Warden - The third hero unlocked at Town Hall 11.',
  },
  RC: {
    content: 'Royal Champion - The fourth hero unlocked at Town Hall 13.',
  },
  MP: {
    content: 'Mountain King - The fifth hero unlocked at Town Hall 15.',
  },

  // =============================================================================
  // STATUS INDICATORS
  // =============================================================================
  'Current Member': {
    content: 'This player is currently in the clan roster.',
  },
  'Former Member': {
    content: 'This player has left the clan but their data is retained for historical tracking.',
  },
  'Warning Level': {
    content: 'Indicates if a player has warnings or notes that require leadership attention.',
  },
  'War Opt-In': {
    content: 'This player has opted in to participate in clan wars.',
  },

  // =============================================================================
  // WAR PLANNING FEATURES
  // =============================================================================
  'Enrich Level': {
    content: 'Number of top players to fetch detailed data for from the opponent clan. Higher values provide more data but take longer.',
  },
  'AI Analysis': {
    content: 'When enabled, uses AI to generate comprehensive war strategy recommendations. When disabled, uses heuristic analysis.',
  },
  'Confidence Rating': {
    content: 'Percentage indicating how confident the analysis is in the predicted outcome. Higher values indicate more reliable predictions.',
  },
  'Hero Delta': {
    content: 'Difference in hero levels between our player and opponent. Positive values indicate our advantage.',
  },
  'TH Delta': {
    content: 'Difference in Town Hall levels. Positive values indicate our player has a higher TH than the opponent.',
  },
  'Ranked Delta': {
    content: 'Difference in ranked trophies. Positive values indicate our player has more trophies.',
  },
  'War Stars Delta': {
    content: 'Difference in total war stars earned. Positive values indicate our player has more war experience.',
  },
  'Defensive Hold Rate': {
    content: 'Percentage of opponent attacks that failed to triple our bases. Higher values indicate stronger defensive performance.',
  },
  'Overall War Score': {
    content: 'Composite war score that blends attack efficiency, consistency, defense, and attendance into a single rating.',
  },
  'Performance Tier': {
    content: 'Automatic classification of a player’s recent war performance (excellent, good, average, poor, needs coaching).',
  },
  'Attacks Used': {
    content: 'Number of attacks our clan actually executed out of the total available attacks for the war.',
  },
  'War Stars': {
    content: 'Total stars earned in the latest war. Higher numbers indicate stronger offensive output.',
  },

  // =============================================================================
  // LEADERSHIP FEATURES
  // =============================================================================
  'Roster Intelligence Pulse': {
    content: 'Real-time signals and insights from the enriched snapshot feed. Provides at-a-glance pulse before diving into player details.',
  },
  'Activity Pulse': {
    content: 'Weighted activity scores across the roster. Higher scores indicate more active and engaged players.',
  },
  'Ranked Surge': {
    content: 'Current ranked trophies since the most recent ingestion run. Shows players climbing in ranked leagues.',
  },
  'Personal Best Chase': {
    content: 'Players closest to matching their all-time trophy peak. Indicates players pushing for new records.',
  },
  'Tenure Anchors': {
    content: 'Longest continuous roster presence measured in days. Higher values indicate more loyal, long-term members.',
  },

  // =============================================================================
  // WAR ANALYTICS METRICS
  // =============================================================================
  'Average Stars': {
    content: 'Average stars per attack across all wars. Calculated as total stars divided by total attacks.',
  },
  'Missed Attacks': {
    content: 'Number of attacks not used in wars. High missed attacks indicate poor participation.',
  },
  'Attack Efficiency': {
    content: 'Percentage of attacks that resulted in 3-star victories. Higher values indicate more skilled attackers.',
  },

  // =============================================================================
  // CAPITAL ANALYTICS METRICS
  // =============================================================================
  'Total Loot': {
    content: 'Sum of all capital loot earned in the raid weekend.',
  },
  'Attacks': {
    content: 'Total number of attacks used in the capital raid weekend.',
  },
  'Participants': {
    content: 'Number of clan members who participated in the capital raid weekend.',
  },
  'Top Contributors': {
    content: 'Players who earned the most capital loot in the raid weekend.',
  },
  'Bonus Earned': {
    content: 'Indicates the player earned the maximum bonus attacks (6 attacks total).',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get tooltip content by key
 */
export function getTooltipContent(key: string): TooltipContent | undefined {
  return TOOLTIP_CONTENT[key];
}

/**
 * Check if a tooltip exists for a key
 */
export function hasTooltip(key: string): boolean {
  return key in TOOLTIP_CONTENT;
}

/**
 * Get all tooltip keys (for debugging/auditing)
 */
export function getAllTooltipKeys(): string[] {
  return Object.keys(TOOLTIP_CONTENT);
}
