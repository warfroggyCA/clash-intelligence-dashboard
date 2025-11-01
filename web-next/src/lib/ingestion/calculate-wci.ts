/**
 * WCI Calculation Phase - Runs after Monday snapshots
 * Calculates Weekly Competitive Index for all members after tournament week ends
 */

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { calculateWCIForMember } from '@/lib/metrics/wci';

/**
 * Calculate tournament week period (Tuesday 5 AM UTC → Monday 5 AM UTC)
 * Returns the week start (Tuesday) and week end (Monday) dates
 */
export function getTournamentWeekPeriod(snapshotDate: Date): { weekStart: Date; weekEnd: Date } {
  const snapshotDay = snapshotDate.getUTCDay(); // 0=Sunday, 1=Monday, etc.
  const snapshotHour = snapshotDate.getUTCHours();
  
  // If it's Monday before 5 AM UTC, the week ended on this Monday
  // If it's Monday after 5 AM UTC, the week ended on the previous Monday
  // Tournament week: Tuesday 5 AM → Monday 5 AM UTC
  
  let weekEnd: Date;
  let weekStart: Date;
  
  if (snapshotDay === 1) { // Monday
    if (snapshotHour < 5) {
      // Monday before 5 AM - week ends today
      weekEnd = new Date(Date.UTC(
        snapshotDate.getUTCFullYear(),
        snapshotDate.getUTCMonth(),
        snapshotDate.getUTCDate(),
        5, 0, 0
      ));
    } else {
      // Monday after 5 AM - week ended yesterday (Sunday)
      const yesterday = new Date(snapshotDate);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      weekEnd = new Date(Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        5, 0, 0
      ));
    }
  } else {
    // Not Monday - calculate the most recent Monday 5 AM UTC
    const daysSinceMonday = snapshotDay === 0 ? 6 : snapshotDay - 1;
    const mondayDate = new Date(snapshotDate);
    mondayDate.setUTCDate(mondayDate.getUTCDate() - daysSinceMonday);
    weekEnd = new Date(Date.UTC(
      mondayDate.getUTCFullYear(),
      mondayDate.getUTCMonth(),
      mondayDate.getUTCDate(),
      5, 0, 0
    ));
  }
  
  // Week start is 6 days before week end (Tuesday 5 AM UTC)
  weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(5, 0, 0, 0);
  
  return { weekStart, weekEnd };
}

/**
 * Calculate and store WCI scores for a tournament week
 * Runs after Monday snapshot stats are written
 */
export async function calculateAndStoreWCI(
  jobId: string,
  snapshotDate: Date,
  options?: { skipMondayCheck?: boolean }
): Promise<{ success: boolean; scoresCalculated: number; error?: string }> {
  const supabase = getSupabaseAdminClient();
  
  try {
    // Check if this is a Monday snapshot (DOW = 1)
    // Skip this check if manually triggered
    if (!options?.skipMondayCheck) {
      const dayOfWeek = snapshotDate.getUTCDay();
      if (dayOfWeek !== 1) {
        // Not Monday - skip WCI calculation
        return { success: true, scoresCalculated: 0 };
      }
    }
    
    // Get tournament week period
    const { weekStart, weekEnd } = getTournamentWeekPeriod(snapshotDate);
    
    // Check if WCI already calculated for this week
    const { data: existingWCI } = await supabase
      .from('wci_scores')
      .select('id')
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .limit(1);
    
    if (existingWCI && existingWCI.length > 0) {
      // Already calculated for this week
      return { success: true, scoresCalculated: 0 };
    }
    
    // Get Monday snapshot data (current week end)
    const mondaySnapshotDate = weekEnd.toISOString().split('T')[0];
    
    const { data: mondaySnapshots, error: snapshotError } = await supabase
      .from('member_snapshot_stats')
      .select(`
        member_id,
        ranked_trophies,
        ranked_league_id,
        ranked_league_name,
        rush_percent,
        donations,
        donations_received,
        capital_contributions,
        activity_score,
        extras
      `)
      .gte('snapshot_date', mondaySnapshotDate + 'T00:00:00Z')
      .lt('snapshot_date', mondaySnapshotDate + 'T23:59:59Z');
    
    if (snapshotError) {
      throw new Error(`Failed to fetch Monday snapshots: ${snapshotError.message}`);
    }
    
    if (!mondaySnapshots || mondaySnapshots.length === 0) {
      // No Monday snapshot data yet - skip
      return { success: true, scoresCalculated: 0 };
    }
    
    // Get previous Monday snapshot for week-start comparison
    const previousMonday = new Date(weekStart);
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7); // Go back one week
    const previousMondayDate = previousMonday.toISOString().split('T')[0];
    
    const { data: previousSnapshots } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, ranked_trophies, ranked_league_id, ranked_league_name')
      .gte('snapshot_date', previousMondayDate + 'T00:00:00Z')
      .lt('snapshot_date', previousMondayDate + 'T23:59:59Z');
    
    // Create lookup map for previous week data
    const previousWeekData = new Map(
      (previousSnapshots || []).map(s => [
        s.member_id,
        {
          rankedTrophies: s.ranked_trophies,
          leagueTier: s.ranked_league_id,
          leagueName: s.ranked_league_name,
        },
      ])
    );
    
    // Calculate WCI for each member
    const wciScores = [];
    const processedMembers = new Set<string>(); // Track processed members to avoid duplicates
    
    for (const snapshot of mondaySnapshots) {
      const memberId = snapshot.member_id;
      
      // Skip if we've already processed this member (handle duplicate snapshots)
      if (processedMembers.has(memberId)) {
        continue;
      }
      processedMembers.add(memberId);
      
      const previousWeek = previousWeekData.get(memberId);
      
      // Calculate WCI (NO tournamentStats - using only API data)
      const wciResult = calculateWCIForMember({
        rankedTrophiesStart: previousWeek?.rankedTrophies ?? null,
        rankedTrophiesEnd: snapshot.ranked_trophies,
        leagueTierStart: previousWeek?.leagueTier ?? null,
        leagueTierEnd: snapshot.ranked_league_id,
        leagueNameStart: previousWeek?.leagueName ?? null,
        leagueNameEnd: snapshot.ranked_league_name ?? null,
        rushPercent: snapshot.rush_percent,
        donationsGiven: snapshot.donations ?? 0,
        donationsReceived: snapshot.donations_received ?? 0,
        capitalContributions: snapshot.capital_contributions ?? 0,
        weekStart,
        weekEnd,
      });
      
      // Prepare database record (matching new component names)
      const wciRecord = {
        member_id: memberId,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        tpg: wciResult.cp.tpg,
        lai: wciResult.cp.lai,
        cp_score: wciResult.cp.score,
        pdr: wciResult.ps.pdr,
        donation_support: wciResult.ps.donationSupport,
        activity: wciResult.ps.activity,
        ps_score: wciResult.ps.score,
        wci_score: wciResult.wci,
        ranked_trophies_start: wciResult.rankedTrophiesStart,
        ranked_trophies_end: wciResult.rankedTrophiesEnd,
        league_tier_start: wciResult.leagueTierStart,
        league_tier_end: wciResult.leagueTierEnd,
        league_name_start: wciResult.leagueNameStart,
        league_name_end: wciResult.leagueNameEnd,
      };
      
      wciScores.push(wciRecord);
    }
    
    // Bulk upsert WCI scores (use upsert to handle partial updates)
    if (wciScores.length > 0) {
      const { error: insertError } = await supabase
        .from('wci_scores')
        .upsert(wciScores, {
          onConflict: 'member_id,week_start',
          ignoreDuplicates: false,
        });
      
      if (insertError) {
        throw new Error(`Failed to upsert WCI scores: ${insertError.message}`);
      }
    }
    
    return {
      success: true,
      scoresCalculated: wciScores.length,
    };
  } catch (error: any) {
    return {
      success: false,
      scoresCalculated: 0,
      error: error.message,
    };
  }
}

