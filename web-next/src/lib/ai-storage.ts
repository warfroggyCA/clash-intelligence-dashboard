// web-next/src/lib/ai-storage.ts
// Supabase integration for storing and retrieving batch AI results

import { createClient } from '@supabase/supabase-js';
import { BatchAIResults, PlayerDNAInsights } from './ai-processor';
import { calculatePlayerDNA, classifyPlayerArchetype } from './player-dna';
import { normalizeTag, safeTagForFilename } from './tags';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface StoredBatchAIResults {
  id: number;
  clan_tag: string;
  date: string;
  timestamp: string;
  change_summary: any;
  coaching_advice: any;
  player_dna_insights: any;
  clan_dna_insights: any;
  game_chat_messages: any;
  performance_analysis: any;
  snapshot_summary: string | null;
  error: string | null;
  created_at: string;
}

export interface StoredPlayerDNA {
  id: number;
  clan_tag: string;
  player_tag: string;
  date: string;
  dna_profile: any;
  archetype: string;
  created_at: string;
}

export async function saveBatchAIResults(results: BatchAIResults): Promise<boolean> {
  try {
    const normalizedClanTag = normalizeTag(results.clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);
    const resultDate = results.date || (results.timestamp ? results.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10));

    console.log(`[AI Storage] Saving batch AI results for ${normalizedClanTag} on ${resultDate}`);

    const { error } = await supabase
      .from('batch_ai_results')
      .upsert({
        clan_tag: safeTag,
        date: resultDate,
        timestamp: results.timestamp,
        change_summary: results.changeSummary || null,
        coaching_advice: results.coachingAdvice || null,
        player_dna_insights: results.playerDNAInsights || null,
        clan_dna_insights: results.clanDNAInsights || null,
        game_chat_messages: results.gameChatMessages || null,
        performance_analysis: results.performanceAnalysis || null,
        snapshot_summary: results.snapshotSummary || null,
        error: results.error || null,
      }, {
        onConflict: 'clan_tag,date'
      });

    if (error) {
      console.error('[AI Storage] Error saving batch AI results:', error);
      return false;
    }

    console.log(`[AI Storage] Successfully saved batch AI results for ${results.clanTag}`);
    return true;
  } catch (error) {
    console.error('[AI Storage] Exception saving batch AI results:', error);
    return false;
  }
}

export async function getLatestBatchAIResults(clanTag: string): Promise<StoredBatchAIResults | null> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', safeTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let record = data;
    let queryError = error;

    if ((!record || queryError?.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('batch_ai_results')
        .select('*')
        .eq('clan_tag', normalizedClanTag)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      record = fallback.data || record;
      if (!record && fallback.error && fallback.error.code !== 'PGRST116') {
        queryError = fallback.error;
      } else if (record) {
        queryError = null;
      }
    }

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching batch AI results:', queryError);
      return null;
    }

    return record || null;
  } catch (error) {
    console.error('[AI Storage] Exception fetching batch AI results:', error);
    return null;
  }
}

export async function getBatchAIResultsByDate(clanTag: string, date: string): Promise<StoredBatchAIResults | null> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', safeTag)
      .eq('date', date)
      .single();

    if (!data && (!error || error.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('batch_ai_results')
        .select('*')
        .eq('clan_tag', normalizedClanTag)
        .eq('date', date)
        .single();
      if (fallback.data) {
        return fallback.data;
      }
      if (fallback.error && fallback.error.code !== 'PGRST116') {
        console.error('[AI Storage] Error fetching legacy batch AI results by date:', fallback.error);
        return null;
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching batch AI results by date:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('[AI Storage] Exception fetching batch AI results by date:', error);
    return null;
  }
}

export async function savePlayerDNACache(
  clanTag: string,
  playerTag: string,
  date: string,
  dnaProfile: any,
  archetype: string
): Promise<boolean> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { error } = await supabase
      .from('player_dna_cache')
      .upsert({
        clan_tag: safeTag,
        player_tag: playerTag,
        date,
        dna_profile: dnaProfile,
        archetype,
      }, {
        onConflict: 'clan_tag,player_tag,date'
      });

    if (error) {
      console.error('[AI Storage] Error saving player DNA cache:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[AI Storage] Exception saving player DNA cache:', error);
    return false;
  }
}

export async function getPlayerDNACache(clanTag: string, date?: string): Promise<StoredPlayerDNA[]> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    let query = supabase
      .from('player_dna_cache')
      .select('*')
      .eq('clan_tag', safeTag)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query.limit(50);

    if ((!data || data.length === 0) && (!error || error.code === 'PGRST116') && normalizedClanTag) {
      let fallback = supabase
        .from('player_dna_cache')
        .select('*')
        .eq('clan_tag', normalizedClanTag)
        .order('created_at', { ascending: false });
      if (date) {
        fallback = fallback.eq('date', date);
      }
      const fallbackResult = await fallback.limit(50);
      if (!fallbackResult.error) {
        return fallbackResult.data || [];
      }
      if (fallbackResult.error.code !== 'PGRST116') {
        console.error('[AI Storage] Error fetching legacy player DNA cache:', fallbackResult.error);
        return [];
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching player DNA cache:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[AI Storage] Exception fetching player DNA cache:', error);
    return [];
  }
}

export async function getPlayerDNACacheByPlayer(clanTag: string, playerTag: string): Promise<StoredPlayerDNA[]> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { data, error } = await supabase
      .from('player_dna_cache')
      .select('*')
      .eq('clan_tag', safeTag)
      .eq('player_tag', playerTag)
      .order('created_at', { ascending: false })
      .limit(10);

    if ((!data || data.length === 0) && (!error || error.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('player_dna_cache')
        .select('*')
        .eq('clan_tag', normalizedClanTag)
        .eq('player_tag', playerTag)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!fallback.error) {
        return fallback.data || [];
      }
      if (fallback.error.code !== 'PGRST116') {
        console.error('[AI Storage] Error fetching legacy player DNA cache by player:', fallback.error);
        return [];
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching player DNA cache by player:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[AI Storage] Exception fetching player DNA cache by player:', error);
    return [];
  }
}

export async function cachePlayerDNAForClan(clanData: any, clanTag: string, date: string): Promise<void> {
  try {
    console.log(`[AI Storage] Caching DNA profiles for ${clanData.members.length} players`);
    
    const cachePromises = clanData.members.map(async (member: any) => {
      try {
        const dnaProfile = calculatePlayerDNA(member, clanData);
        
        await savePlayerDNACache(
          clanTag,
          member.tag,
          date,
          dnaProfile,
          classifyPlayerArchetype(dnaProfile, member)
        );
      } catch (error) {
        console.error(`[AI Storage] Error caching DNA for ${member.name}:`, error);
      }
    });

    await Promise.allSettled(cachePromises);
    console.log(`[AI Storage] Completed DNA caching for ${clanTag}`);
  } catch (error) {
    console.error('[AI Storage] Exception caching player DNA:', error);
  }
}

export async function getBatchAIResultsHistory(clanTag: string, limit: number = 10): Promise<StoredBatchAIResults[]> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', safeTag)
      .order('created_at', { ascending: false })
      .limit(limit);

    if ((!data || data.length === 0) && (!error || error.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('batch_ai_results')
        .select('*')
        .eq('clan_tag', normalizedClanTag)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!fallback.error) {
        return fallback.data || [];
      }
      if (fallback.error.code !== 'PGRST116') {
        console.error('[AI Storage] Error fetching legacy batch AI history:', fallback.error);
        return [];
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching batch AI results history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[AI Storage] Exception fetching batch AI results history:', error);
    return [];
  }
}

export async function deleteOldBatchAIResults(clanTag: string, daysToKeep: number = 30): Promise<number> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('batch_ai_results')
      .delete()
      .eq('clan_tag', safeTag)
      .lt('date', cutoffDateStr)
      .select('id');

    let deletedCount = data?.length || 0;

    if ((!data || data.length === 0) && (!error || error.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('batch_ai_results')
        .delete()
        .eq('clan_tag', normalizedClanTag)
        .lt('date', cutoffDateStr)
        .select('id');
      if (!fallback.error) {
        deletedCount += fallback.data?.length || 0;
      } else if (fallback.error.code !== 'PGRST116') {
        console.error('[AI Storage] Error deleting legacy batch AI results:', fallback.error);
        return deletedCount;
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Storage] Error deleting old batch AI results:', error);
      return deletedCount;
    }

    console.log(`[AI Storage] Deleted ${deletedCount} old batch AI results for ${clanTag}`);
    return deletedCount;
  } catch (error) {
    console.error('[AI Storage] Exception deleting old batch AI results:', error);
    return 0;
  }
}

export async function getAIInsightsSummary(clanTag: string): Promise<{
  hasRecentAI: boolean;
  lastAIDate: string | null;
  totalInsights: number;
  errorRate: number;
}> {
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);

    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('date, error, created_at')
      .eq('clan_tag', safeTag)
      .order('created_at', { ascending: false })
      .limit(30);

    let queryResults = data || [];
    let queryError = error;

    if ((queryResults.length === 0) && (!queryError || queryError.code === 'PGRST116') && normalizedClanTag) {
      const fallback = await supabase
        .from('batch_ai_results')
        .select('date, error, created_at')
        .eq('clan_tag', normalizedClanTag)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!fallback.error) {
        queryResults = fallback.data || [];
        queryError = null;
      } else if (fallback.error.code !== 'PGRST116') {
        queryError = fallback.error;
      }
    }

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('[AI Storage] Error fetching AI insights summary:', queryError);
      return {
        hasRecentAI: false,
        lastAIDate: null,
        totalInsights: 0,
        errorRate: 0
      };
    }

    const results = queryResults;
    const hasRecentAI = results.length > 0;
    const lastAIDate = results.length > 0 ? results[0].date : null;
    const totalInsights = results.length;
    const errorCount = results.filter(r => r.error).length;
    const errorRate = totalInsights > 0 ? (errorCount / totalInsights) * 100 : 0;

    return {
      hasRecentAI,
      lastAIDate,
      totalInsights,
      errorRate
    };
  } catch (error) {
    console.error('[AI Storage] Exception fetching AI insights summary:', error);
    return {
      hasRecentAI: false,
      lastAIDate: null,
      totalInsights: 0,
      errorRate: 0
    };
  }
}

export function generateSnapshotSummary(
  snapshotMetadata: any,
  snapshotDetails: any,
  dataAgeHours?: number
): string {
  if (!snapshotMetadata) return '';

  const parts: string[] = [];
  
  // Basic snapshot info
  const snapshotDate = snapshotMetadata.snapshotDate || snapshotMetadata.date;
  const fetchedAt = snapshotMetadata.fetchedAt;
  const memberCount = snapshotMetadata.memberCount;
  const clanName = snapshotMetadata.clanName;

  if (snapshotDate) {
    parts.push(`Snapshot date: ${snapshotDate}`);
  }
  if (fetchedAt) {
    parts.push(`Fetched: ${new Date(fetchedAt).toLocaleString()}`);
  }
  if (typeof memberCount === 'number') {
    parts.push(`Members: ${memberCount}`);
  }
  if (clanName) {
    parts.push(`Clan: ${clanName}`);
  }
  
  // Data freshness
  if (dataAgeHours !== undefined) {
    const freshness = dataAgeHours <= 24 ? 'Fresh' : dataAgeHours <= 48 ? 'Stale' : 'Very stale';
    parts.push(`Data age: ${Math.round(dataAgeHours)}h (${freshness})`);
  }
  
  // Current war status
  if (snapshotDetails?.currentWar) {
    const war = snapshotDetails.currentWar;
    const opponent = war.opponent ? `${war.opponent.name} (${war.opponent.tag})` : 'Unknown opponent';
    parts.push(`Current war: ${war.state} vs ${opponent} (${war.teamSize} members)`);
    if (war.endTime) {
      parts.push(`War ends: ${new Date(war.endTime).toLocaleString()}`);
    }
  }
  
  // Recent war performance
  if (snapshotDetails?.warLog?.length) {
    const wins = snapshotDetails.warLog.filter((w: any) => w.result === 'WIN').length;
    parts.push(`Recent wars: ${wins} wins of ${snapshotDetails.warLog.length}`);
  }
  
  // Capital raid status
  if (snapshotDetails?.capitalRaidSeasons?.length) {
    const latest = snapshotDetails.capitalRaidSeasons[0];
    parts.push(`Capital raids: Hall ${latest.capitalHallLevel} - ${latest.state}`);
    if (latest.offensiveLoot) {
      parts.push(`Latest loot: ${latest.offensiveLoot.toLocaleString()} offensive, ${latest.defensiveLoot.toLocaleString()} defensive`);
    }
  }
  
  return parts.join(' • ');
}
