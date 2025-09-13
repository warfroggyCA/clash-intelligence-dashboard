// web-next/src/lib/ai-storage.ts
// Supabase integration for storing and retrieving batch AI results

import { createClient } from '@supabase/supabase-js';
import { BatchAIResults, PlayerDNAInsights } from './ai-processor';
import { calculatePlayerDNA, classifyPlayerArchetype } from './player-dna';

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
    console.log(`[AI Storage] Saving batch AI results for ${results.clanTag} on ${results.clanTag}`);
    
    const { error } = await supabase
      .from('batch_ai_results')
      .upsert({
        clan_tag: results.clanTag,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        timestamp: results.timestamp,
        change_summary: results.changeSummary || null,
        coaching_advice: results.coachingAdvice || null,
        player_dna_insights: results.playerDNAInsights || null,
        clan_dna_insights: results.clanDNAInsights || null,
        game_chat_messages: results.gameChatMessages || null,
        performance_analysis: results.performanceAnalysis || null,
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
    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('[AI Storage] Error fetching batch AI results:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[AI Storage] Exception fetching batch AI results:', error);
    return null;
  }
}

export async function getBatchAIResultsByDate(clanTag: string, date: string): Promise<StoredBatchAIResults | null> {
  try {
    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('[AI Storage] Error fetching batch AI results by date:', error);
      return null;
    }

    return data;
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
    const { error } = await supabase
      .from('player_dna_cache')
      .upsert({
        clan_tag: clanTag,
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
    let query = supabase
      .from('player_dna_cache')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query.limit(50);

    if (error) {
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
    const { data, error } = await supabase
      .from('player_dna_cache')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
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
    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('batch_ai_results')
      .delete()
      .eq('clan_tag', clanTag)
      .lt('date', cutoffDateStr)
      .select('id');

    if (error) {
      console.error('[AI Storage] Error deleting old batch AI results:', error);
      return 0;
    }

    const deletedCount = data?.length || 0;
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
    const { data, error } = await supabase
      .from('batch_ai_results')
      .select('date, error, created_at')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[AI Storage] Error fetching AI insights summary:', error);
      return {
        hasRecentAI: false,
        lastAIDate: null,
        totalInsights: 0,
        errorRate: 0
      };
    }

    const results = data || [];
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
