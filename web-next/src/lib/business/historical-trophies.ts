/**
 * Historical Trophy Calculations - Single Source of Truth
 * 
 * This module provides the authoritative calculation logic for:
 * - lastWeekTrophies: Previous Monday's final ranked trophy count
 * - seasonTotalTrophies: Sum of ranked tournament finals since season start
 * 
 * Used by both Roster API and Profile API to ensure consistency.
 */

import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

const SEASON_START_ISO = '2025-10-01T00:00:00Z';
const RANKED_START_MONDAY_ISO = '2025-10-13';

/**
 * Calculate the Monday (week start) for a given date
 */
function weekStartKey(date: Date): string {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = base.getUTCDay(); // 0 = Sun ... 6 = Sat
  const diff = base.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  base.setUTCDate(diff);
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

export interface HistoricalTrophyData {
  lastWeekTrophies: number | null;
  seasonTotalTrophies: number | null;
  seasonWeekEntries: Array<{ weekKey: string; value: number }>;
}

/**
 * Calculate historical trophy data for a single player using member_snapshot_stats
 * 
 * @param memberId - UUID of the member from members table
 * @param memberTag - Normalized player tag (e.g., "#G9QVRYC2Y")
 * @returns Historical trophy data including last week and season totals
 */
export async function calculateHistoricalTrophiesForPlayer(
  memberId: string,
  memberTag: string
): Promise<HistoricalTrophyData> {
  const supabase = getSupabaseServerClient();

  // Calculate last week's Monday
  const now = new Date();
  const currentMonday = weekStartKey(now);
  const lastMonday = new Date(currentMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastMondayISO = lastMonday.toISOString().slice(0, 10);

  // Fetch last week's trophy data
  const { data: lastWeekSnapshotRows } = await supabase
    .from('member_snapshot_stats')
    .select('member_id, trophies, ranked_trophies, snapshot_date')
    .eq('member_id', memberId)
    .filter('snapshot_date', 'gte', lastMondayISO + 'T00:00:00Z')
    .filter('snapshot_date', 'lte', currentMonday + 'T23:59:59Z')
    .order('snapshot_date', { ascending: false });

  let lastWeekTrophies: number | null = null;
  if (lastWeekSnapshotRows && lastWeekSnapshotRows.length > 0) {
    // Find the highest ranked_trophies for last week
    let bestTrophies = 0;
    for (const row of lastWeekSnapshotRows) {
      const trophyValue = row.ranked_trophies ?? row.trophies ?? 0;
      if (trophyValue > bestTrophies) {
        bestTrophies = trophyValue;
      }
    }
    if (bestTrophies > 0) {
      lastWeekTrophies = bestTrophies;
    }
  }

  // Fetch all season data for running total calculation
  const { data: allSeasonRows } = await supabase
    .from('member_snapshot_stats')
    .select('member_id, trophies, ranked_trophies, snapshot_date')
    .eq('member_id', memberId)
    .gte('snapshot_date', SEASON_START_ISO)
    .order('snapshot_date', { ascending: true });

  // Group by week and calculate season total
  const memberWeeks = new Map<string, number>(); // week -> max_trophies
  const seasonWeekEntries: Array<{ weekKey: string; value: number }> = [];

  if (allSeasonRows) {
    for (const row of allSeasonRows) {
      if (!row.snapshot_date) continue;
      const snapshotDate = new Date(row.snapshot_date);
      if (Number.isNaN(snapshotDate.valueOf())) continue;

      const weekStartISO = weekStartKey(snapshotDate);

      // Only count ranked weeks on/after 2025-10-13
      if (weekStartISO < RANKED_START_MONDAY_ISO) {
        continue;
      }

      // Only use ranked_trophies (tournament finals), ignore regular trophies
      const trophyValue = row.ranked_trophies ?? 0;
      
      // Keep the maximum plausible ranked final for the week
      // Filter: trophyValue > 0 && trophyValue <= 600 (plausible range)
      const existingValue = memberWeeks.get(weekStartISO) ?? 0;
      if (trophyValue > existingValue && trophyValue > 0 && trophyValue <= 600) {
        memberWeeks.set(weekStartISO, trophyValue);
      }
    }

    // Convert to sorted array
    const entries = Array.from(memberWeeks.entries())
      .map(([weekKey, value]) => ({
        weekKey,
        value: typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0,
      }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    // Filter out weeks with 0 or invalid values
    const tournamentFinals = entries.filter(entry => entry.value > 0 && entry.value <= 600);
    const seasonTotal = tournamentFinals.reduce((sum, entry) => sum + entry.value, 0);

    return {
      lastWeekTrophies,
      seasonTotalTrophies: seasonTotal > 0 ? seasonTotal : null,
      seasonWeekEntries: tournamentFinals,
    };
  }

  return {
    lastWeekTrophies,
    seasonTotalTrophies: null,
    seasonWeekEntries: [],
  };
}

/**
 * Calculate historical trophy data for multiple players (batch operation)
 * 
 * @param memberIdToTagMap - Map of member UUID -> normalized tag
 * @returns Map of member tag -> HistoricalTrophyData
 */
export async function calculateHistoricalTrophiesForPlayers(
  memberIdToTagMap: Map<string, string>
): Promise<Map<string, HistoricalTrophyData>> {
  const supabase = getSupabaseServerClient();
  const result = new Map<string, HistoricalTrophyData>();

  const memberIds = Array.from(memberIdToTagMap.keys());
  if (memberIds.length === 0) {
    return result;
  }

  // Calculate last week's Monday
  const now = new Date();
  const currentMonday = weekStartKey(now);
  const lastMonday = new Date(currentMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastMondayISO = lastMonday.toISOString().slice(0, 10);

  // Fetch last week's trophy data for all members
  const { data: lastWeekSnapshotRows } = await supabase
    .from('member_snapshot_stats')
    .select('member_id, trophies, ranked_trophies, snapshot_date')
    .in('member_id', memberIds)
    .filter('snapshot_date', 'gte', lastMondayISO + 'T00:00:00Z')
    .filter('snapshot_date', 'lte', currentMonday + 'T23:59:59Z')
    .order('snapshot_date', { ascending: false });

  const lastWeekTrophiesByMember = new Map<string, number>();
  if (lastWeekSnapshotRows) {
    const memberBestTrophies = new Map<string, number>();
    for (const row of lastWeekSnapshotRows) {
      const trophyValue = row.ranked_trophies ?? row.trophies ?? 0;
      const currentBest = memberBestTrophies.get(row.member_id) ?? 0;
      if (trophyValue > currentBest) {
        memberBestTrophies.set(row.member_id, trophyValue);
      }
    }
    for (const [memberId, bestTrophies] of memberBestTrophies) {
      const memberTag = memberIdToTagMap.get(memberId);
      if (memberTag && bestTrophies > 0) {
        lastWeekTrophiesByMember.set(memberTag, bestTrophies);
      }
    }
  }

  // Fetch all season data (batch in smaller chunks to avoid Supabase limits)
  const allSeasonRows: Array<{ member_id: string; ranked_trophies: number | null; trophies: number | null; snapshot_date: string }> = [];
  const batchSize = 5;
  
  for (let i = 0; i < memberIds.length; i += batchSize) {
    const batch = memberIds.slice(i, i + batchSize);
    const { data: batchRows } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, trophies, ranked_trophies, snapshot_date')
      .in('member_id', batch)
      .gte('snapshot_date', SEASON_START_ISO)
      .order('snapshot_date', { ascending: true });
    
    if (batchRows) {
      allSeasonRows.push(...batchRows);
    }
  }

  // Group by member and week
  const memberWeeksByMember = new Map<string, Map<string, number>>(); // member_tag -> week -> max_trophies

  for (const row of allSeasonRows) {
    if (!row.snapshot_date) continue;
    const snapshotDate = new Date(row.snapshot_date);
    if (Number.isNaN(snapshotDate.valueOf())) continue;
    
    const memberTag = memberIdToTagMap.get(row.member_id);
    if (!memberTag) continue;

    const weekStartISO = weekStartKey(snapshotDate);

    // Only count ranked weeks on/after 2025-10-13
    if (weekStartISO < RANKED_START_MONDAY_ISO) {
      continue;
    }

    if (!memberWeeksByMember.has(memberTag)) {
      memberWeeksByMember.set(memberTag, new Map<string, number>());
    }

    const trophyValue = row.ranked_trophies ?? 0;
    const memberWeekMap = memberWeeksByMember.get(memberTag)!;
    const existingValue = memberWeekMap.get(weekStartISO) ?? 0;
    
    // Keep the maximum plausible ranked final for the week
    if (trophyValue > existingValue && trophyValue > 0 && trophyValue <= 600) {
      memberWeekMap.set(weekStartISO, trophyValue);
    }
  }

  // Calculate season totals for each member
  for (const [memberTag, weekMap] of memberWeeksByMember.entries()) {
    if (!weekMap || weekMap.size === 0) continue;

    const entries = Array.from(weekMap.entries())
      .map(([weekKey, value]) => ({
        weekKey,
        value: typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0,
      }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    const tournamentFinals = entries.filter(entry => entry.value > 0 && entry.value <= 600);
    const seasonTotal = tournamentFinals.reduce((sum, entry) => sum + entry.value, 0);

    result.set(memberTag, {
      lastWeekTrophies: lastWeekTrophiesByMember.get(memberTag) ?? null,
      seasonTotalTrophies: seasonTotal > 0 ? seasonTotal : null,
      seasonWeekEntries: tournamentFinals,
    });
  }

  // Add entries for members with no season data but with last week data
  for (const [memberTag, lastWeek] of lastWeekTrophiesByMember.entries()) {
    if (!result.has(memberTag)) {
      result.set(memberTag, {
        lastWeekTrophies: lastWeek,
        seasonTotalTrophies: null,
        seasonWeekEntries: [],
      });
    }
  }

  return result;
}

