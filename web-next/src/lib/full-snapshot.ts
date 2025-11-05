import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import {
  getClanInfo,
  getClanMembers,
  getPlayer,
  getClanWarLog,
  getClanCurrentWar,
  getClanCapitalRaidSeasons,
} from './coc';
import { getSupabaseAdminClient } from './supabase-admin';
import { loadPlayerDetailFromCache, savePlayerDetailToCache } from './player-cache';

const SNAPSHOT_VERSION = '2025-09-15';

export interface MemberSummary {
  tag: string;
  name: string;
  role?: string;
  townHallLevel?: number;
  builderHallLevel?: number;
  townHallWeaponLevel?: number;
  trophies?: number;
  builderTrophies?: number;
  donations?: number;
  donationsReceived?: number;
  clanRank?: number;
  previousClanRank?: number;
  league?: any;
  leagueTier?: {
    id: number;
    name: string;
  };
  extras?: Record<string, any> | null;
}

export interface FullClanSnapshot {
  clanTag: string;
  fetchedAt: string;
  clan: any;
  memberSummaries: MemberSummary[];
  playerDetails: Record<string, any>;
  currentWar: any | null;
  warLog: any[];
  capitalRaidSeasons: any[];
  metadata: {
    memberCount: number;
    warLogEntries: number;
    capitalSeasons: number;
    version: string;
    snapshotDate?: string;
    fetchedAt?: string;
    clanName?: string | null;
    playerDetailFailures?: string[];
    playerDetailFailureCount?: number;
    playerDetailSuccessCount?: number;
    playerDetailErrorSamples?: Array<{ tag: string; message: string }>;
  };
}

export interface FetchFullSnapshotOptions {
  warLogLimit?: number;
  capitalSeasonLimit?: number;
  includePlayerDetails?: boolean;
}

export async function fetchFullClanSnapshot(
  clanTag: string,
  options: FetchFullSnapshotOptions = {}
): Promise<FullClanSnapshot> {
  const normalizedTag = normalizeTag(clanTag);
  const fetchPlayers = options.includePlayerDetails !== false;
  // Add timeout to prevent hanging on main API calls
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout fetching clan data')), 60000); // 60 second timeout
  });

  const [clan, members] = await Promise.race([
    Promise.all([
      getClanInfo(normalizedTag).catch((error: any) => {
        console.error(`[FullSnapshot] Failed to fetch clan info for ${normalizedTag}:`, error?.message || error);
        throw error;
      }),
      getClanMembers(normalizedTag).catch((error: any) => {
        console.error(`[FullSnapshot] Failed to fetch clan members for ${normalizedTag}:`, error?.message || error);
        throw error;
      }),
    ]),
    timeoutPromise
  ]) as [any, any];

  const warLogLimit = options.warLogLimit ?? 10;
  const capitalSeasonLimit = options.capitalSeasonLimit ?? 3;

  // Add timeout to war data fetching
  const warTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout fetching war data')), 45000); // 45 second timeout
  });

  // War log and capital data are optional - don't fail entire ingestion if they fail
  // Some clans have war log hidden, or API key might not have permissions
  let warLogResult: any[] = [];
  let currentWarResult: any = null;
  let capitalRaidSeasonsResult: any[] = [];
  
  try {
    const [warLog, currentWar, capitalRaidSeasons] = await Promise.race([
      Promise.all([
        getClanWarLog(normalizedTag, warLogLimit).catch((error: any) => {
          console.warn(`[FullSnapshot] War log fetch failed (continuing without it):`, error?.message || error);
          return []; // Return empty array instead of throwing - war log is optional
        }),
        getClanCurrentWar(normalizedTag).catch((error: any) => {
          console.warn(`[FullSnapshot] Current war fetch failed (continuing without it):`, error?.message || error);
          return null; // Return null instead of throwing - current war is optional
        }),
        getClanCapitalRaidSeasons(normalizedTag, capitalSeasonLimit).catch((error: any) => {
          console.warn(`[FullSnapshot] Capital raid seasons fetch failed (continuing without it):`, error?.message || error);
          return []; // Return empty array instead of throwing - capital seasons are optional
        }),
      ]),
      warTimeoutPromise
    ]) as [any[], any, any[]];
    
    warLogResult = Array.isArray(warLog) ? warLog : [];
    currentWarResult = currentWar ?? null;
    capitalRaidSeasonsResult = Array.isArray(capitalRaidSeasons) ? capitalRaidSeasons : [];
  } catch (error: any) {
    // If timeout or other error, continue with empty values - war data is optional
    console.warn(`[FullSnapshot] War data fetch timed out or failed (continuing without it):`, error?.message || error);
    warLogResult = [];
    currentWarResult = null;
    capitalRaidSeasonsResult = [];
  }

  const playerDetails: Record<string, any> = {};
  console.log(`[FullSnapshot] fetchPlayers=${fetchPlayers}, members.length=${members?.length ?? 0}`);
  const snapshotMetadataExtras: Partial<FullClanSnapshot['metadata']> = {};
  if (fetchPlayers) {
    let cacheHits = 0;
    let cacheMisses = 0;
    const failedPlayers: string[] = [];
    const playerErrors: Array<{ tag: string; message: string }> = [];
    console.log(`[FullSnapshot] Starting player detail fetch for ${members?.length ?? 0} members`);

    // Process players with timeout and better error handling
    const playerPromises = members.map(async (member: any) => {
      const tag = normalizeTag(member.tag);

      const cachedDetail = await loadPlayerDetailFromCache(tag);
      if (cachedDetail) {
        playerDetails[tag] = cachedDetail;
        cacheHits += 1;
        return;
      }

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout fetching player ${tag}`)), 60000); // 60 second timeout (increased from 30s)
      });

      try {
        const detailPromise = getPlayer(tag);
        const detail = await Promise.race([detailPromise, timeoutPromise]);
        playerDetails[tag] = detail;
        cacheMisses += 1;
        await savePlayerDetailToCache(tag, detail);
      } catch (error: any) {
        const message = error?.message || 'Unknown error';
        failedPlayers.push(tag);
        playerErrors.push({ tag, message });
        console.error('[FullSnapshot] Failed to fetch player detail', member.tag, message);
        // Don't let one player failure block the entire process
      }
    });

    // Wait for all players with timeout
    await Promise.allSettled(playerPromises);

    const playerDetailCount = Object.keys(playerDetails).length;
    console.log(`[FullSnapshot] Player detail cache stats — hits: ${cacheHits}, misses: ${cacheMisses}, total: ${playerDetailCount}`);
    if (failedPlayers.length > 0) {
      console.warn('[FullSnapshot] Player detail fetch failures', {
        failedCount: failedPlayers.length,
        totalMembers: members?.length ?? 0,
        failedPlayers,
      });
    }

    if (members?.length) {
      const failureRatio = failedPlayers.length / members.length;
      if (failureRatio >= 0.99) {
        const sample = playerErrors[0]?.message || 'all player detail requests failed';
        throw new Error(`Player detail fetch failed for all members (${members.length}). Last error: ${sample}`);
      }
      if (failureRatio >= 0.6) {
        const sample = playerErrors[0]?.message || 'high failure rate';
        throw new Error(`Player detail fetch failure rate ${(failureRatio * 100).toFixed(1)}% (${failedPlayers.length}/${members.length}). Sample error: ${sample}`);
      }
    }

    snapshotMetadataExtras.playerDetailFailures = failedPlayers;
    snapshotMetadataExtras.playerDetailFailureCount = failedPlayers.length;
    snapshotMetadataExtras.playerDetailSuccessCount = playerDetailCount;
    snapshotMetadataExtras.playerDetailErrorSamples = playerErrors.slice(0, 5);
  } else {
    console.log('[FullSnapshot] Player detail fetch SKIPPED (fetchPlayers=false)');
    snapshotMetadataExtras.playerDetailSuccessCount = 0;
    snapshotMetadataExtras.playerDetailFailureCount = 0;
    snapshotMetadataExtras.playerDetailFailures = [];
    snapshotMetadataExtras.playerDetailErrorSamples = [];
  }

  const memberSummaries: MemberSummary[] = members.map((member: any) => {
    const tag = normalizeTag(member.tag);
    const detail = playerDetails[tag];
    return {
      tag,
      name: member.name,
      role: member.role,
      townHallLevel: detail?.townHallLevel ?? member.townHallLevel,
      builderHallLevel: detail?.builderHallLevel,
      townHallWeaponLevel: detail?.townHallWeaponLevel,
      trophies: member.trophies ?? detail?.trophies,
      builderTrophies: detail?.versusTrophies,
      donations: member.donations ?? detail?.achievements?.find?.((a: any) => a.name === 'Friend in Need')?.value,
      donationsReceived: member.donationsReceived,
      clanRank: member.clanRank,
      previousClanRank: member.previousClanRank,
      league: member.league ?? detail?.league,
      leagueTier: member.leagueTier ?? detail?.leagueTier,  // Source of truth for ranked participation
      extras: detail?.extras ?? null,
    };
  });

  const fetchedAt = new Date().toISOString();

  const metadata = {
    memberCount: members.length,
    warLogEntries: warLogResult.length,
    capitalSeasons: capitalRaidSeasonsResult.length,
    version: SNAPSHOT_VERSION,
    snapshotDate: fetchedAt.slice(0, 10),
    fetchedAt,
    clanName: clan?.name ?? null,
    ...snapshotMetadataExtras,
  };

  return {
    clanTag: normalizedTag,
    fetchedAt,
    clan,
    memberSummaries,
    playerDetails,
    currentWar: currentWarResult,
    warLog: warLogResult,
    capitalRaidSeasons: capitalRaidSeasonsResult,
    metadata,
  };
}

export async function persistFullClanSnapshot(snapshot: FullClanSnapshot): Promise<void> {
  const safeTag = safeTagForFilename(snapshot.clanTag);
  const timestamp = snapshot.fetchedAt.replace(/[:.]/g, '-');
  const filename = `${safeTag}_${timestamp}.json`;
  const snapshotDate = snapshot.fetchedAt.slice(0, 10); // YYYY-MM-DD format

  // Always save locally for development/backup
  if (cfg.useLocalData) {
    const dir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
    await fsp.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fsp.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[FullSnapshot] Saved local snapshot ${filePath}`);
  }

  // Save to Supabase if configured
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      
      // Insert with conflict handling - if same clan_tag + snapshot_date exists, update it
      const { error } = await supabase
        .from('clan_snapshots')
        .upsert({
          clan_tag: safeTag,
          snapshot_date: snapshotDate,
          fetched_at: snapshot.fetchedAt,
          clan: snapshot.clan,
          member_summaries: snapshot.memberSummaries,
          player_details: snapshot.playerDetails,
          current_war: snapshot.currentWar,
          war_log: snapshot.warLog,
          capital_seasons: snapshot.capitalRaidSeasons,
          metadata: snapshot.metadata,
        }, { 
          onConflict: 'clan_tag,snapshot_date',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[FullSnapshot] Failed to persist to Supabase:', error);
        throw error;
      }

      console.log(`[FullSnapshot] Successfully persisted to Supabase: ${safeTag} on ${snapshotDate}`);
    } catch (error) {
      console.error('[FullSnapshot] Error persisting to Supabase:', error);
      // Don't throw - we want the local backup to still work
    }
  }
}

// Load a full snapshot from Supabase by clan tag and date
export async function loadFullSnapshot(clanTag: string, date: string): Promise<FullClanSnapshot | null> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try local data first if configured
  if (cfg.useLocalData) {
    try {
      const dir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(dir);
      const matchingFile = files.find(f => f.startsWith(`${safeTag}_`) && f.includes(date));
      if (matchingFile) {
        const filePath = path.join(dir, matchingFile);
        const raw = await fsp.readFile(filePath, 'utf-8');
        return JSON.parse(raw) as FullClanSnapshot;
      }
    } catch (error) {
      console.error('[FullSnapshot] Failed to load local snapshot:', error);
    }
  }

  // Try Supabase if configured
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('clan_snapshots')
        .select('*')
        .eq('clan_tag', safeTag)
        .eq('snapshot_date', date)
        .single();

      if (error || !data) {
        console.log(`[FullSnapshot] No snapshot found for ${safeTag} on ${date}`);
        return null;
      }

      // Convert database row back to FullClanSnapshot format
      return {
        clanTag: data.clan_tag,
        fetchedAt: data.fetched_at,
        clan: data.clan,
        memberSummaries: data.member_summaries,
        playerDetails: data.player_details,
        currentWar: data.current_war,
        warLog: data.war_log,
        capitalRaidSeasons: data.capital_seasons,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('[FullSnapshot] Failed to load from Supabase:', error);
    }
  }

  return null;
}

// Get the most recent full snapshot for a clan
export async function getLatestFullSnapshot(clanTag: string): Promise<FullClanSnapshot | null> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try local data first if configured
  if (cfg.useLocalData) {
    try {
      const dir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(dir);
      const matchingFiles = files
        .filter(f => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (matchingFiles.length > 0) {
        const filePath = path.join(dir, matchingFiles[0]);
        const raw = await fsp.readFile(filePath, 'utf-8');
        return JSON.parse(raw) as FullClanSnapshot;
      }
    } catch (error) {
      console.error('[FullSnapshot] Failed to load latest local snapshot:', error);
    }
  }

  // Try Supabase if configured
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('clan_snapshots')
        .select('*')
        .eq('clan_tag', safeTag)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`[FullSnapshot] No snapshots found for ${safeTag}`);
        return null;
      }

      // Convert database row back to FullClanSnapshot format
      return {
        clanTag: data.clan_tag,
        fetchedAt: data.fetched_at,
        clan: data.clan,
        memberSummaries: data.member_summaries,
        playerDetails: data.player_details,
        currentWar: data.current_war,
        warLog: data.war_log,
        capitalRaidSeasons: data.capital_seasons,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('[FullSnapshot] Failed to load latest from Supabase:', error);
    }
  }

  return null;
}

// Get all available snapshot dates for a clan
export async function getAvailableSnapshotDates(clanTag: string): Promise<string[]> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try local data first if configured
  if (cfg.useLocalData) {
    try {
      const dir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(dir);
      const dates = files
        .filter(f => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .map(f => {
          // Extract date from filename like "2PR8R8V8P_2025-09-15T10-30-00-000Z.json"
          const match = f.match(/_(\d{4}-\d{2}-\d{2})T/);
          return match ? match[1] : null;
        })
        .filter((date): date is string => date !== null)
        .sort()
        .reverse();
      return dates;
    } catch (error) {
      console.error('[FullSnapshot] Failed to list local snapshot dates:', error);
    }
  }

  // Try Supabase if configured
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('clan_snapshots')
        .select('snapshot_date')
        .eq('clan_tag', safeTag)
        .order('snapshot_date', { ascending: false });

      if (error || !data) {
        console.log(`[FullSnapshot] No snapshot dates found for ${safeTag}`);
        return [];
      }

      return data.map(row => row.snapshot_date).sort().reverse();
    } catch (error) {
      console.error('[FullSnapshot] Failed to list snapshot dates from Supabase:', error);
    }
  }

  return [];
}
