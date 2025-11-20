/**
 * Leaderboard Calculation Utilities
 * 
 * Provides functions to rank players across multiple criteria:
 * - VIP Score
 * - Donation Ratio
 * - War Performance
 * - Capital Contributions
 * - Activity Score
 */

import type { RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import type { Member } from '@/types';
import { getMemberActivity } from '@/lib/business/calculations';

export type LeaderboardCriteria =
  | 'vip'
  | 'donation-ratio'
  | 'war-performance'
  | 'capital'
  | 'activity'
  | 'donations-given'
  | 'war-stars';

export interface RankedMember extends RosterMember {
  rank: number;
  value: number;
  percentile: number;
  badge?: 'top-1' | 'top-3' | 'top-10' | null;
}

/**
 * Calculate donation ratio for a member
 */
function calculateDonationRatio(member: RosterMember): number {
  // Handle null/undefined by converting to 0
  const given = typeof member.donations === 'number' ? member.donations : (member.donations ?? 0);
  const received = typeof member.donationsReceived === 'number' ? member.donationsReceived : (member.donationsReceived ?? 0);

  // If no donations given, ratio is 0
  if (given === 0) {
    return 0;
  }

  // If they've given but received nothing, ratio is their donations / 10
  if (received === 0) {
    return given / 10;
  }

  // Normal case: given / received
  return given / received;
}

/**
 * Calculate war performance score
 * Combines war stars with efficiency metrics
 */
function calculateWarPerformance(member: RosterMember): number {
  const warStars = member.warStars ?? 0;
  // Could add attack efficiency, destruction %, etc. in the future
  // For now, just use war stars
  return warStars;
}

/**
 * Calculate percentile rank (0-100)
 */
function calculatePercentile(index: number, total: number): number {
  if (total === 0) return 0;
  // Percentile: (total - rank) / total * 100
  // Rank 1 out of 10 = (10 - 1) / 10 * 100 = 90th percentile
  return Math.round(((total - index) / total) * 100);
}

/**
 * Determine badge based on percentile
 */
function getRankBadge(percentile: number, rank: number): 'top-1' | 'top-3' | 'top-10' | null {
  if (rank === 1) return 'top-1';
  if (rank <= 3) return 'top-3';
  if (percentile >= 90) return 'top-10';
  return null;
}

/**
 * Rank members by VIP Score
 */
export function rankByVIP(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => ({
      ...m,
      value: m.vip?.score ?? 0,
    }))
    .filter(m => m.value > 0) // Only include members with VIP scores
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by Donation Ratio (given / received)
 */
export function rankByDonationRatio(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => {
      // Ensure we have numeric values (handle null/undefined, preserve 0)
      const given = typeof m.donations === 'number' ? m.donations : (m.donations ?? 0);
      const received = typeof m.donationsReceived === 'number' ? m.donationsReceived : (m.donationsReceived ?? 0);

      return {
        ...m,
        donations: given,
        donationsReceived: received,
        value: calculateDonationRatio({ ...m, donations: given, donationsReceived: received }),
      };
    })
    .filter(m => {
      // Include anyone who has given donations (value > 0 means they have donations)
      return m.donations > 0;
    })
    .sort((a, b) => b.value - a.value); // Descending (highest ratio first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by War Performance (war stars)
 */
export function rankByWarPerformance(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => ({
      ...m,
      value: calculateWarPerformance(m),
    }))
    .filter(m => m.value > 0) // Only include members with war activity
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by Capital Contributions
 */
export function rankByCapital(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => ({
      ...m,
      value: m.clanCapitalContributions ?? 0,
    }))
    .filter(m => m.value > 0) // Only include members with capital contributions
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by Activity Score
 */
export function rankByActivity(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => {
      const activity = getMemberActivity(m as Member);
      return {
        ...m,
        value: activity.score,
      };
    })
    .filter(m => m.value > 0) // Only include active members
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by Donations Given
 */
export function rankByDonationsGiven(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => {
      // Ensure we have numeric values (handle null/undefined, preserve 0)
      const donations = typeof m.donations === 'number' ? m.donations : (m.donations ?? 0);
      return {
        ...m,
        donations,
        value: donations,
      };
    })
    .filter(m => m.value > 0) // Only include members who have given donations
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Rank members by War Stars
 */
export function rankByWarStars(members: RosterMember[]): RankedMember[] {
  const ranked = members
    .map(m => ({
      ...m,
      value: m.warStars ?? 0,
    }))
    .filter(m => m.value > 0) // Only include members with war stars
    .sort((a, b) => b.value - a.value); // Descending (highest first)

  return ranked.map((member, index) => {
    const rank = index + 1;
    const percentile = calculatePercentile(index, ranked.length);
    const badge = getRankBadge(percentile, rank);

    return {
      ...member,
      rank,
      percentile,
      badge,
    };
  });
}

/**
 * Get ranked members by criteria
 */
export function getRankedMembers(
  members: RosterMember[],
  criteria: LeaderboardCriteria
): RankedMember[] {
  switch (criteria) {
    case 'vip':
      return rankByVIP(members);
    case 'donation-ratio':
      return rankByDonationRatio(members);
    case 'war-performance':
      return rankByWarPerformance(members);
    case 'capital':
      return rankByCapital(members);
    case 'activity':
      return rankByActivity(members);
    case 'donations-given':
      return rankByDonationsGiven(members);
    case 'war-stars':
      return rankByWarStars(members);
    default:
      return [];
  }
}

/**
 * Get rank information for a specific player
 */
export function getPlayerRank(
  members: RosterMember[],
  playerTag: string,
  criteria: LeaderboardCriteria
): { rank: number; value: number; percentile: number; badge: RankedMember['badge'] } | null {
  const normalizedTag = playerTag.replace('#', '').toUpperCase();
  const ranked = getRankedMembers(members, criteria);

  const playerIndex = ranked.findIndex(m =>
    m.tag.replace('#', '').toUpperCase() === normalizedTag
  );

  if (playerIndex === -1) return null;

  const player = ranked[playerIndex];
  return {
    rank: player.rank,
    value: player.value,
    percentile: player.percentile,
    badge: player.badge,
  };
}

/**
 * Format value for display based on criteria
 */
export function formatLeaderboardValue(value: number, criteria: LeaderboardCriteria): string {
  switch (criteria) {
    case 'vip':
      return value.toFixed(1);
    case 'donation-ratio':
      return value.toFixed(2) + 'x';
    case 'war-performance':
    case 'war-stars':
      return Math.round(value).toLocaleString();
    case 'capital':
      return Math.round(value).toLocaleString();
    case 'activity':
      return Math.round(value).toString();
    case 'donations-given':
      return Math.round(value).toLocaleString();
    default:
      return value.toString();
  }
}

/**
 * Get criteria display name
 */
export function getCriteriaName(criteria: LeaderboardCriteria): string {
  const names: Record<LeaderboardCriteria, string> = {
    'vip': 'VIP Score',
    'donation-ratio': 'Donation Ratio',
    'war-performance': 'War Performance',
    'capital': 'Capital Contributions',
    'activity': 'Activity Score',
    'donations-given': 'Donations Given',
    'war-stars': 'War Stars',
  };
  return names[criteria];
}

/**
 * Get criteria description/tooltip
 */
export function getCriteriaDescription(criteria: LeaderboardCriteria): string {
  const descriptions: Record<LeaderboardCriteria, string> = {
    'vip': 'Combined metric: 50% Competitive + 30% Support + 20% Development',
    'donation-ratio': 'Ratio of donations given vs. donations received (higher is better)',
    'war-performance': 'Total war stars earned (measures war participation and success)',
    'capital': 'Total capital gold contributed to Clan Capital upgrades',
    'activity': 'Activity score based on engagement across multiple indicators',
    'donations-given': 'Total troops donated to clan members',
    'war-stars': 'Total stars earned in Clan Wars',
  };
  return descriptions[criteria];
}

