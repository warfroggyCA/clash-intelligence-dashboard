/**
 * VIP Score Calculation Phase - Runs after Monday snapshots
 * Calculates VIP (Very Important Player) Score for all members after tournament week ends
 */

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { calculateVIPForMember } from '@/lib/metrics/vip';

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
 * Calculate and store VIP scores for a tournament week
 * Runs after Monday snapshot stats are written
 */
export async function calculateAndStoreVIP(
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
        // Not Monday - skip VIP calculation
        return { success: true, scoresCalculated: 0 };
      }
    }
    
    // Get tournament week period
    const { weekStart, weekEnd } = getTournamentWeekPeriod(snapshotDate);
    
    // Check if VIP already calculated for this week
    const { data: existingVIP } = await supabase
      .from('vip_scores')
      .select('id')
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .limit(1);
    
    if (existingVIP && existingVIP.length > 0) {
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
        achievement_score,
        war_stars,
        hero_levels,
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
    
    // Get week-start snapshot (weekStart is Tuesday 5 AM UTC)
    // Look for snapshots from Monday-Wednesday of that week (flexible for data availability)
    const tuesdaySnapshotDate = weekStart.toISOString().split('T')[0];
    const mondayBefore = new Date(weekStart);
    mondayBefore.setUTCDate(mondayBefore.getUTCDate() - 1); // Monday before Tuesday
    const wednesdayAfter = new Date(weekStart);
    wednesdayAfter.setUTCDate(wednesdayAfter.getUTCDate() + 1); // Wednesday after Tuesday
    
    const { data: weekStartSnapshots } = await supabase
      .from('member_snapshot_stats')
      .select(`
        member_id,
        ranked_trophies,
        ranked_league_id,
        ranked_league_name,
        capital_contributions,
        achievement_score,
        war_stars,
        hero_levels,
        extras
      `)
      .gte('snapshot_date', mondayBefore.toISOString().split('T')[0] + 'T00:00:00Z')
      .lt('snapshot_date', wednesdayAfter.toISOString().split('T')[0] + 'T23:59:59Z')
      .order('snapshot_date', { ascending: true }); // Get earliest snapshot for each member
    
    // Create lookup map for week-start (Tuesday) data
    // Use the earliest snapshot for each member (to prefer Monday/Tuesday over Wednesday)
    const weekStartData = new Map<string, {
      rankedTrophies: number | null;
      leagueTier: number | null;
      leagueName: string | null;
      capitalContributions: number | null;
      achievementScore: number | null;
      warStars: number | null;
      heroLevels: { bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null } | null;
      extras: any;
    }>();
    
    // Process snapshots, keeping only the earliest one for each member
    (weekStartSnapshots || []).forEach(s => {
      if (!weekStartData.has(s.member_id)) {
        weekStartData.set(s.member_id, {
          rankedTrophies: s.ranked_trophies,
          leagueTier: s.ranked_league_id,
          leagueName: s.ranked_league_name,
          capitalContributions: s.capital_contributions,
          achievementScore: s.achievement_score,
          warStars: s.war_stars,
          heroLevels: s.hero_levels,
          extras: s.extras,
        });
      }
    });
    
    // Calculate VIP for each member
    const vipScores = [];
    const processedMembers = new Set<string>(); // Track processed members to avoid duplicates
    
    for (const snapshot of mondaySnapshots) {
      const memberId = snapshot.member_id;
      
      // Skip if we've already processed this member (handle duplicate snapshots)
      if (processedMembers.has(memberId)) {
        continue;
      }
      processedMembers.add(memberId);
      
      const weekStartSnapshot = weekStartData.get(memberId);
      
      // Extract war performance from ACE score if available (from extras)
      // TODO: In future, we can calculate OVA/DVA from war data directly
      // For now, default to null (will result in neutral war score)
      const warOva = snapshot.extras?.ace?.ova?.z ?? null;
      const warDva = snapshot.extras?.ace?.dva?.z ?? null;
      
      // Calculate VIP
      const vipResult = calculateVIPForMember({
        rankedTrophiesStart: weekStartSnapshot?.rankedTrophies ?? null,
        rankedTrophiesEnd: snapshot.ranked_trophies,
        leagueTierStart: weekStartSnapshot?.leagueTier ?? null,
        leagueTierEnd: snapshot.ranked_league_id,
        leagueNameStart: weekStartSnapshot?.leagueName ?? null,
        leagueNameEnd: snapshot.ranked_league_name ?? null,
        warOva,
        warDva,
        donationsGiven: snapshot.donations ?? 0,
        donationsReceived: snapshot.donations_received ?? 0,
        capitalContributionsStart: weekStartSnapshot?.capitalContributions ?? null,
        capitalContributionsEnd: snapshot.capital_contributions ?? null,
        rushPercent: snapshot.rush_percent,
        heroLevelsStart: weekStartSnapshot?.heroLevels ?? null,
        heroLevelsEnd: snapshot.hero_levels ?? null,
        achievementScoreStart: weekStartSnapshot?.achievementScore ?? null,
        achievementScoreEnd: snapshot.achievement_score ?? null,
        warStarsStart: weekStartSnapshot?.warStars ?? null,
        warStarsEnd: snapshot.war_stars ?? null,
        weekStart,
        weekEnd,
      });
      
      // Calculate WPI (War Performance Index) from OVA/DVA
      // WPI converts z-scores to 0-100 scale: z-score of 0 = 50, +3 = 100, -3 = 0
      const warScore = vipResult.competitive.war.hasWarData
        ? Math.max(0, Math.min(100, 50 + (vipResult.competitive.war.ova * 16.67) * 0.60 +
                                   (vipResult.competitive.war.dva * 16.67) * 0.40))
        : 50; // Neutral if no war data
      
      // Prepare database record
      const vipRecord = {
        member_id: memberId,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        lai: vipResult.competitive.ranked.lai,
        tpg: vipResult.competitive.ranked.tpg,
        ranked_score: vipResult.competitive.ranked.lai * 0.70 + vipResult.competitive.ranked.tpg * 0.30,
        war_ova: vipResult.competitive.war.ova,
        war_dva: vipResult.competitive.war.dva,
        war_score: warScore,
        competitive_score: vipResult.competitive.score,
        donations: vipResult.support.donations,
        capital: vipResult.support.capital,
        support_score: vipResult.support.score,
        base_quality: vipResult.development.baseQuality,
        activity: vipResult.development.activity,
        hero_progression: vipResult.development.heroProgression,
        development_score: vipResult.development.score,
        vip_score: vipResult.vip,
        ranked_trophies_start: vipResult.rankedTrophiesStart,
        ranked_trophies_end: vipResult.rankedTrophiesEnd,
        league_tier_start: vipResult.leagueTierStart,
        league_tier_end: vipResult.leagueTierEnd,
        league_name_start: vipResult.leagueNameStart,
        league_name_end: vipResult.leagueNameEnd,
      };
      
      vipScores.push(vipRecord);
    }
    
    // Bulk upsert VIP scores
    if (vipScores.length > 0) {
      const { error: insertError } = await supabase
        .from('vip_scores')
        .upsert(vipScores, {
          onConflict: 'member_id,week_start',
          ignoreDuplicates: false,
        });
      
      if (insertError) {
        throw new Error(`Failed to upsert VIP scores: ${insertError.message}`);
      }
    }
    
    return {
      success: true,
      scoresCalculated: vipScores.length,
    };
  } catch (error: any) {
    return {
      success: false,
      scoresCalculated: 0,
      error: error.message,
    };
  }
}

