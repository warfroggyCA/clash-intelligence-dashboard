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
import { rateLimiter } from './rate-limiter';
import { getSupabaseAdminClient } from './supabase-admin';

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
  const [clan, members] = await Promise.all([
    getClanInfo(normalizedTag),
    getClanMembers(normalizedTag),
  ]);

  const warLogLimit = options.warLogLimit ?? 10;
  const capitalSeasonLimit = options.capitalSeasonLimit ?? 3;

  const [warLog, currentWar, capitalRaidSeasons] = await Promise.all([
    getClanWarLog(normalizedTag, warLogLimit),
    getClanCurrentWar(normalizedTag),
    getClanCapitalRaidSeasons(normalizedTag, capitalSeasonLimit),
  ]);

  const playerDetails: Record<string, any> = {};
  if (fetchPlayers) {
    await Promise.all(
      members.map(async (member: any) => {
        const tag = normalizeTag(member.tag);
        await rateLimiter.acquire();
        try {
          const detail = await getPlayer(tag);
          playerDetails[tag] = detail;
        } catch (error) {
          console.error('[FullSnapshot] Failed to fetch player detail', member.tag, error);
        } finally {
          rateLimiter.release();
        }
      })
    );
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
    };
  });

  const fetchedAt = new Date().toISOString();

  return {
    clanTag: normalizedTag,
    fetchedAt,
    clan,
    memberSummaries,
    playerDetails,
    currentWar,
    warLog,
    capitalRaidSeasons,
    metadata: {
      memberCount: members.length,
      warLogEntries: warLog.length,
      capitalSeasons: capitalRaidSeasons.length,
      version: SNAPSHOT_VERSION,
      snapshotDate: fetchedAt.slice(0, 10),
      fetchedAt,
      clanName: clan?.name ?? null,
    },
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
