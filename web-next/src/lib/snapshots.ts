// web-next/src/lib/snapshots.ts
// Daily snapshot storage and change detection system

import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from './coc';
import { rateLimiter } from './rate-limiter';
import { getSupabaseAdminClient } from './supabase-admin';
import type { FullClanSnapshot, MemberSummary } from './full-snapshot';

export type Member = {
  name: string;
  tag: string;
  townHallLevel?: number;
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  role?: string;
  tenure_days?: number;
  // Additional properties for change detection
  attackWins?: number;
  versusBattleWins?: number;
  versusTrophies?: number;
  clanCapitalContributions?: number;
};

export type DailySnapshot = {
  date: string; // YYYY-MM-DD format
  clanTag: string;
  clanName?: string;
  timestamp: string; // ISO timestamp
  members: Member[];
  memberCount: number;
  totalTrophies: number;
  totalDonations: number;
};

export type ChangeType = 
  | 'new_member'
  | 'left_member' 
  | 'level_up'
  | 'hero_upgrade'
  | 'trophy_change'
  | 'donation_change'
  | 'donation_received_change'
  | 'role_change'
  | 'town_hall_upgrade'
  | 'war_activity'
  | 'attack_wins_change'
  | 'versus_battle_wins_change'
  | 'versus_trophies_change'
  | 'capital_contributions_change';

export type MemberChange = {
  type: ChangeType;
  member: {
    name: string;
    tag: string;
    townHallLevel?: number;
    role?: string;
    // Only include essential data to reduce payload size
  };
  previousValue?: any;
  newValue?: any;
  description: string;
};

export type ChangeSummary = {
  date: string;
  clanTag: string;
  changes: MemberChange[];
  summary: string; // AI-generated summary
  gameChatMessages: string[]; // Copyable messages for game chat
  unread: boolean;
  actioned: boolean;
  createdAt: string;
};

// Helper functions
function ymdToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Convert FullClanSnapshot to DailySnapshot format for backward compatibility
export function convertFullSnapshotToDailySnapshot(fullSnapshot: FullClanSnapshot): DailySnapshot & { fullSnapshot?: FullClanSnapshot } {
  const members: Member[] = fullSnapshot.memberSummaries.map((summary: MemberSummary) => {
    // Get detailed player data if available
    const playerDetail = fullSnapshot.playerDetails[summary.tag];
    
    return {
      name: summary.name,
      tag: summary.tag,
      townHallLevel: summary.townHallLevel,
      bk: playerDetail ? extractHeroLevels(playerDetail).bk : null,
      aq: playerDetail ? extractHeroLevels(playerDetail).aq : null,
      gw: playerDetail ? extractHeroLevels(playerDetail).gw : null,
      rc: playerDetail ? extractHeroLevels(playerDetail).rc : null,
      mp: playerDetail ? extractHeroLevels(playerDetail).mp : null,
      trophies: summary.trophies,
      donations: summary.donations,
      donationsReceived: summary.donationsReceived,
      role: summary.role,
      tenure_days: 0, // Will be populated from tenure ledger if needed
      // Additional properties for change detection
      attackWins: playerDetail?.attackWins || 0,
      versusBattleWins: playerDetail?.versusBattleWins || 0,
      versusTrophies: summary.builderTrophies || 0,
      clanCapitalContributions: playerDetail?.clanCapitalContributions || 0,
      extras: playerDetail?.extras ?? (summary as any)?.extras ?? null,
    } as Member;
  });

  return {
    date: fullSnapshot.fetchedAt.slice(0, 10), // YYYY-MM-DD format
    clanTag: fullSnapshot.clanTag,
    clanName: fullSnapshot.clan?.name,
    timestamp: fullSnapshot.fetchedAt,
    members,
    memberCount: members.length,
    totalTrophies: members.reduce((sum, m) => sum + (m.trophies || 0), 0),
    totalDonations: members.reduce((sum, m) => sum + (m.donations || 0), 0),
    fullSnapshot, // Include the full snapshot for enhanced metadata
  };
}

function getSnapshotPath(clanTag: string, date: string): string {
  const safeTag = safeTagForFilename(clanTag);
  return path.join(process.cwd(), cfg.dataRoot, 'snapshots', `${safeTag}_${date}.json`);
}

function getChangesPath(clanTag: string, date: string): string {
  const safeTag = safeTagForFilename(clanTag);
  return path.join(process.cwd(), cfg.dataRoot, 'changes', `${safeTag}_${date}.json`);
}

// Ensure directories exist
async function ensureDirectories(): Promise<void> {
  if (!cfg.useLocalData) return;
  const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
  const changesDir = path.join(process.cwd(), cfg.dataRoot, 'changes');
  
  try {
    await fsp.mkdir(snapshotsDir, { recursive: true });
    await fsp.mkdir(changesDir, { recursive: true });
  } catch (error) {
    // Directories might already exist
  }
}

// Storage bucket helpers for change summaries (still needed)
async function uploadJsonToSupabase(bucket: string, filePath: string, payload: any): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, body, { contentType: 'application/json', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data?.publicUrl || null;
  } catch (error) {
    console.error(`[Supabase] Failed to upload ${bucket}/${filePath}:`, error);
    return null;
  }
}

async function downloadJsonFromSupabase<T>(bucket: string, filePath: string): Promise<T | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch (error) {
    console.error(`[Supabase] Failed to download ${bucket}/${filePath}:`, error);
    return null;
  }
}

// Legacy snapshot creation functions removed - now using full-snapshot.ts

// Load a snapshot for a specific date
export async function loadSnapshot(clanTag: string, date: string): Promise<DailySnapshot | null> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try new clan_snapshots table first
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
        console.log(`[Snapshots] No clan snapshot found for ${safeTag} on ${date}`);
      } else {
        // Convert database row back to FullClanSnapshot format
        const fullSnapshot: FullClanSnapshot = {
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
        
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
    } catch (error) {
      console.error('[Snapshots] Failed to load from clan_snapshots:', error);
    }
  }

  // Fallback to local data if configured
  if (cfg.useLocalData) {
    try {
      // Try full-snapshots directory first
      const fullSnapshotDir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(fullSnapshotDir);
      const matchingFile = files.find(f => f.startsWith(`${safeTag}_`) && f.includes(date));
      if (matchingFile) {
        const filePath = path.join(fullSnapshotDir, matchingFile);
        const raw = await fsp.readFile(filePath, 'utf-8');
        const fullSnapshot = JSON.parse(raw) as FullClanSnapshot;
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
      
      // Fallback to legacy snapshots directory
      const p = path.join(process.cwd(), cfg.dataRoot, 'snapshots', `${safeTag}_${date}.json`);
      const raw = await fsp.readFile(p, 'utf-8');
      return JSON.parse(raw) as DailySnapshot;
    } catch (error) {
      console.log(`[Snapshots] No local snapshot found for ${safeTag} on ${date}`);
    }
  }

  return null;
}

// Get the most recent snapshot
export async function getLatestSnapshot(clanTag: string): Promise<DailySnapshot | null> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try new clan_snapshots table first
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
        console.log(`[Snapshots] No clan snapshots found for ${safeTag}`);
      } else {
        // Convert database row back to FullClanSnapshot format
        const fullSnapshot: FullClanSnapshot = {
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
        
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
    } catch (error) {
      console.error('[Snapshots] Failed to load latest from clan_snapshots:', error);
    }
  }

  // Fallback to local data if configured
  if (cfg.useLocalData) {
    try {
      // Try full-snapshots directory first
      const fullSnapshotDir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(fullSnapshotDir);
      const matchingFiles = files
        .filter(f => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (matchingFiles.length > 0) {
        const filePath = path.join(fullSnapshotDir, matchingFiles[0]);
        const raw = await fsp.readFile(filePath, 'utf-8');
        const fullSnapshot = JSON.parse(raw) as FullClanSnapshot;
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
      
      // Fallback to legacy snapshots directory
      const dir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
      const files2 = await fsp.readdir(dir);
      const list = files2
        .filter(f => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .sort()
        .reverse();
      if (list.length > 0) {
        const raw = await fsp.readFile(path.join(dir, list[0]), 'utf-8');
        return JSON.parse(raw) as DailySnapshot;
      }
    } catch (error) {
      console.log(`[Snapshots] No local snapshots found for ${safeTag}`);
    }
  }

  return null;
}

export async function getSnapshotBeforeDate(clanTag: string, beforeDate: string): Promise<DailySnapshot | null> {
  const safeTag = safeTagForFilename(clanTag);
  
  // Try new clan_snapshots table first
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('clan_snapshots')
        .select('*')
        .eq('clan_tag', safeTag)
        .lt('snapshot_date', beforeDate)
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        console.log(`[Snapshots] No clan snapshots found for ${safeTag} before ${beforeDate}`);
      } else {
        const record = data[0];
        // Convert database row back to FullClanSnapshot format
        const fullSnapshot: FullClanSnapshot = {
          clanTag: record.clan_tag,
          fetchedAt: record.fetched_at,
          clan: record.clan,
          memberSummaries: record.member_summaries,
          playerDetails: record.player_details,
          currentWar: record.current_war,
          warLog: record.war_log,
          capitalRaidSeasons: record.capital_seasons,
          metadata: record.metadata,
        };
        
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
    } catch (error) {
      console.error('[Snapshots] Failed to load from clan_snapshots:', error);
    }
  }

  // Fallback to local data if configured
  if (cfg.useLocalData) {
    try {
      // Try full-snapshots directory first
      const fullSnapshotDir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
      const files = await fsp.readdir(fullSnapshotDir);
      const list = files
        .filter((f) => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .filter((f) => {
          const datePart = f.slice(safeTag.length + 1, safeTag.length + 11);
          return datePart < beforeDate;
        })
        .sort()
        .reverse();
      if (list.length > 0) {
        const filePath = path.join(fullSnapshotDir, list[0]);
        const raw = await fsp.readFile(filePath, 'utf-8');
        const fullSnapshot = JSON.parse(raw) as FullClanSnapshot;
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }
      
      // Fallback to legacy snapshots directory
      const dir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
      const files2 = await fsp.readdir(dir);
      const list2 = files2
        .filter((f) => f.startsWith(`${safeTag}_`) && f.endsWith('.json'))
        .filter((f) => {
          const datePart = f.slice(safeTag.length + 1, safeTag.length + 11);
          return datePart < beforeDate;
        })
        .sort()
        .reverse();
      if (list2.length === 0) return null;
      const raw = await fsp.readFile(path.join(dir, list2[0]), 'utf-8');
      return JSON.parse(raw) as DailySnapshot;
    } catch (error) {
      console.log(`[Snapshots] No local snapshots found for ${safeTag} before ${beforeDate}`);
    }
  }

  return null;
}

// Compare two snapshots and detect changes (enhanced with better sensitivity)
export function detectChanges(previous: DailySnapshot, current: DailySnapshot): MemberChange[] {
  const changes: MemberChange[] = [];
  
  // Create maps for easier comparison (normalize tags to uppercase)
  const prevMembers = new Map(previous.members.map(m => [normalizeTag(m.tag), m]));
  const currMembers = new Map(current.members.map(m => [normalizeTag(m.tag), m]));
  
  // Check for new members
  for (const [tag, member] of currMembers) {
    if (!prevMembers.has(tag)) {
      changes.push({
        type: 'new_member',
        member: {
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          role: member.role
        },
        description: `${member.name} joined the clan`
      });
    }
  }
  
  // Check for members who left
  for (const [tag, member] of prevMembers) {
    if (!currMembers.has(tag)) {
      changes.push({
        type: 'left_member',
        member: {
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          role: member.role
        },
        description: `${member.name} left the clan`
      });
    }
  }
  
  // Check for changes in existing members with enhanced sensitivity
  for (const [tag, currentMember] of currMembers) {
    const prevMember = prevMembers.get(tag);
    if (!prevMember) continue;
    
    // Town Hall level changes
    if (currentMember.townHallLevel !== prevMember.townHallLevel) {
      changes.push({
        type: 'town_hall_upgrade',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.townHallLevel,
        newValue: currentMember.townHallLevel,
        description: `${currentMember.name} upgraded to Town Hall ${currentMember.townHallLevel}`
      });
    }
    
    // Hero upgrades
    const heroes = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;
    for (const hero of heroes) {
      const prevLevel = prevMember[hero];
      const currLevel = currentMember[hero];
      
      if (prevLevel !== currLevel && currLevel !== null && currLevel !== undefined && currLevel > (prevLevel || 0)) {
        changes.push({
          type: 'hero_upgrade',
          member: {
            name: currentMember.name,
            tag: currentMember.tag,
            townHallLevel: currentMember.townHallLevel,
            role: currentMember.role
          },
          previousValue: prevLevel,
          newValue: currLevel,
          description: `${currentMember.name} upgraded ${hero.toUpperCase()} to level ${currLevel}`
        });
      }
    }
    
    // Enhanced trophy changes (lower threshold for better sensitivity)
    const trophyDiff = (currentMember.trophies || 0) - (prevMember.trophies || 0);
    if (Math.abs(trophyDiff) >= 20) { // Lowered from 50
      changes.push({
        type: 'trophy_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.trophies,
        newValue: currentMember.trophies,
        description: `${currentMember.name} ${trophyDiff > 0 ? 'gained' : 'lost'} ${Math.abs(trophyDiff)} trophies`
      });
    }
    
    // Enhanced donation changes (lower threshold for better sensitivity)
    const donationDiff = (currentMember.donations || 0) - (prevMember.donations || 0);
    if (donationDiff >= 25) { // Lowered from 100
      changes.push({
        type: 'donation_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.donations,
        newValue: currentMember.donations,
        description: `${currentMember.name} donated ${donationDiff} troops`
      });
    }
    
    // Donations received changes (lower threshold)
    const donationsReceivedDiff = (currentMember.donationsReceived || 0) - (prevMember.donationsReceived || 0);
    if (donationsReceivedDiff >= 25) { // Lowered from 50
      changes.push({
        type: 'donation_received_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.donationsReceived,
        newValue: currentMember.donationsReceived,
        description: `${currentMember.name} received ${donationsReceivedDiff} troops`
      });
    }
    
    // Attack wins changes (any increase)
    const attackWinsDiff = (currentMember.attackWins || 0) - (prevMember.attackWins || 0);
    if (attackWinsDiff > 0) {
      changes.push({
        type: 'attack_wins_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.attackWins,
        newValue: currentMember.attackWins,
        description: `${currentMember.name} gained ${attackWinsDiff} attack wins`
      });
    }
    
    // Versus battle wins changes (any increase)
    const versusWinsDiff = (currentMember.versusBattleWins || 0) - (prevMember.versusBattleWins || 0);
    if (versusWinsDiff > 0) {
      changes.push({
        type: 'versus_battle_wins_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.versusBattleWins,
        newValue: currentMember.versusBattleWins,
        description: `${currentMember.name} gained ${versusWinsDiff} versus battle wins`
      });
    }
    
    // Versus trophies changes (lower threshold)
    const versusTrophiesDiff = (currentMember.versusTrophies || 0) - (prevMember.versusTrophies || 0);
    if (Math.abs(versusTrophiesDiff) >= 10) { // Lowered from 20
      changes.push({
        type: 'versus_trophies_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.versusTrophies,
        newValue: currentMember.versusTrophies,
        description: `${currentMember.name} ${versusTrophiesDiff > 0 ? 'gained' : 'lost'} ${Math.abs(versusTrophiesDiff)} versus trophies`
      });
    }
    
    // Clan Capital contributions changes (any increase)
    const capitalContributionsDiff = (currentMember.clanCapitalContributions || 0) - (prevMember.clanCapitalContributions || 0);
    if (capitalContributionsDiff > 0) {
      changes.push({
        type: 'capital_contributions_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.clanCapitalContributions,
        newValue: currentMember.clanCapitalContributions,
        description: `${currentMember.name} contributed ${capitalContributionsDiff} capital gold`
      });
    }
    
    // Role changes
    if (currentMember.role !== prevMember.role) {
      changes.push({
        type: 'role_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.role,
        newValue: currentMember.role,
        description: `${currentMember.name} role changed to ${currentMember.role}`
      });
    }
  }
  
  return changes;
}

// Enhanced activity tracking with rock-solid signals and confidence levels
export type ActivityEvidence = {
  last_active_at: string; // timestamp of the snapshot where change was observed
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  evidence: string[]; // list of fields that changed
  priority: number; // 1-5, higher = more recent activity
  activity_level?: 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive';
  days_since_activity?: number;
};

// Real-time activity calculation from current member data
export function calculateRealTimeActivity(member: Member): {
  activity_level: 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive';
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  evidence: string[];
  last_active_at: string;
} {
  const now = new Date().toISOString();
  const evidence: string[] = [];
  let activity_level: 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive' = 'Inactive';
  let confidence: 'definitive' | 'high' | 'medium' | 'weak' = 'weak';

  // Check donation activity (most reliable indicator)
  if (member.donations && member.donations > 0) {
    if (member.donations >= 1000) {
      activity_level = 'Very High';
      confidence = 'high';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 500) {
      activity_level = 'High';
      confidence = 'high';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 200) {
      activity_level = 'Medium';
      confidence = 'medium';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 50) {
      activity_level = 'Low';
      confidence = 'medium';
      evidence.push(`donations: ${member.donations}`);
    }
  }

  // Check attack wins (war activity - highest priority)
  if (member.attackWins && member.attackWins > 0) {
    activity_level = 'Very High';
    confidence = 'definitive';
    evidence.push(`attack_wins: ${member.attackWins}`);
  }

  // Check clan capital contributions (very recent activity)
  if (member.clanCapitalContributions && member.clanCapitalContributions > 0) {
    activity_level = 'Very High';
    confidence = 'definitive';
    evidence.push(`capital_contributions: ${member.clanCapitalContributions}`);
  }

  // Check versus battle activity
  if (member.versusBattleWins && member.versusBattleWins > 0) {
    if (activity_level === 'Inactive') {
      activity_level = 'Medium';
      confidence = 'medium';
    }
    evidence.push(`versus_battles: ${member.versusBattleWins}`);
  }

  // Check trophy level (indicates recent play)
  if (member.trophies && member.trophies > 0) {
    if (member.trophies >= 5000) {
      if (activity_level === 'Inactive') {
        activity_level = 'High';
        confidence = 'medium';
      }
      evidence.push(`trophies: ${member.trophies}`);
    } else if (member.trophies >= 3000) {
      if (activity_level === 'Inactive') {
        activity_level = 'Medium';
        confidence = 'medium';
      }
      evidence.push(`trophies: ${member.trophies}`);
    }
  }

  return {
    activity_level,
    confidence,
    evidence,
    last_active_at: now
  };
}

export function calculateLastActive(
  memberTag: string, 
  changes: MemberChange[], 
  snapshotTimestamp: string
): ActivityEvidence | null {
  // Filter changes for this specific member
  const memberChanges = changes.filter(c => c.member.tag === memberTag);
  
  if (memberChanges.length === 0) return null;
  
  // Rock-solid signals (definitive confidence) - in order of precedence
  const rockSolidSignals = [
    { type: 'war_activity', priority: 5 },
    { type: 'attack_wins_change', priority: 4 },
    { type: 'versus_battle_wins_change', priority: 4 },
    { type: 'versus_trophies_change', priority: 4 },
    { type: 'capital_contributions_change', priority: 4 },
    { type: 'donation_change', priority: 3 },
    { type: 'hero_upgrade', priority: 3 },
    { type: 'town_hall_upgrade', priority: 3 }
  ];
  
  // High-confidence signals
  const highConfidenceSignals = [
    { type: 'donation_received_change', priority: 2 },
    { type: 'trophy_change', priority: 2 },
    { type: 'role_change', priority: 1 }
  ];
  
  // Find the highest priority change
  let bestEvidence: ActivityEvidence | null = null;
  
  // Check rock-solid signals first
  for (const signal of rockSolidSignals) {
    const change = memberChanges.find(c => c.type === signal.type);
    if (change) {
      const evidence = generateEvidenceString(change);
      bestEvidence = {
        last_active_at: snapshotTimestamp,
        confidence: 'definitive',
        evidence: [evidence],
        priority: signal.priority
      };
      break; // Take the first (highest priority) rock-solid signal
    }
  }
  
  // If no rock-solid signal, check high-confidence signals
  if (!bestEvidence) {
    for (const signal of highConfidenceSignals) {
      const change = memberChanges.find(c => c.type === signal.type);
      if (change) {
        const evidence = generateEvidenceString(change);
        bestEvidence = {
          last_active_at: snapshotTimestamp,
          confidence: 'high',
          evidence: [evidence],
          priority: signal.priority
        };
        break;
      }
    }
  }
  
  // If still no evidence, collect all changes as weak signals
  if (!bestEvidence && memberChanges.length > 0) {
    const evidence = memberChanges.map(change => generateEvidenceString(change));
    bestEvidence = {
      last_active_at: snapshotTimestamp,
      confidence: 'weak',
      evidence,
      priority: 0
    };
  }
  
  return bestEvidence;
}

function generateEvidenceString(change: MemberChange): string {
  const type = change.type;
  const prev = change.previousValue;
  const curr = change.newValue;
  
  switch (type) {
    case 'attack_wins_change':
      return `attackWins: +${curr - prev}`;
    case 'donation_change':
      return `donations: +${curr - prev}`;
    case 'donation_received_change':
      return `donationsReceived: +${curr - prev}`;
    case 'versus_battle_wins_change':
      return `versusBattleWins: +${curr - prev}`;
    case 'versus_trophies_change':
      const diff = curr - prev;
      return `versusTrophies: ${diff > 0 ? '+' : ''}${diff}`;
    case 'capital_contributions_change':
      return `clanCapitalContributions: +${curr - prev}`;
    case 'trophy_change':
      const trophyDiff = curr - prev;
      return `trophies: ${trophyDiff > 0 ? '+' : ''}${trophyDiff}`;
    case 'hero_upgrade':
      return `hero: ${change.description.split(' upgraded ')[1]}`;
    case 'town_hall_upgrade':
      return `townHall: ${prev} → ${curr}`;
    case 'role_change':
      return `role: ${prev} → ${curr}`;
    default:
      return `${type}: ${change.description}`;
  }
}

// Save change summary
export async function saveChangeSummary(summary: ChangeSummary): Promise<void> {
  await ensureDirectories();

  if (cfg.useLocalData) {
    const changesPath = getChangesPath(summary.clanTag, summary.date);
    await fsp.writeFile(changesPath, JSON.stringify(summary, null, 2));
  }

  if (cfg.useSupabase) {
    const safeTag = safeTagForFilename(summary.clanTag);
    const filename = `${safeTag}_${summary.date}.json`;
    await uploadJsonToSupabase('changes', filename, summary);
  }
}

// Load change summary
export async function loadChangeSummary(clanTag: string, date: string): Promise<ChangeSummary | null> {
  if (cfg.useLocalData) {
    try {
      const changesPath = getChangesPath(clanTag, date);
      const data = await fsp.readFile(changesPath, 'utf-8');
      return JSON.parse(data) as ChangeSummary;
    } catch (error) {
      return null;
    }
  }

  if (cfg.useSupabase) {
    const safeTag = safeTagForFilename(clanTag);
    const filename = `${safeTag}_${date}.json`;
    return downloadJsonFromSupabase<ChangeSummary>('changes', filename);
  }

  return null;
}

// Get all change summaries for a clan
export async function getAllChangeSummaries(clanTag: string): Promise<ChangeSummary[]> {
  const safeTag = safeTagForFilename(clanTag);

  if (cfg.useLocalData) {
    const changesDir = path.join(process.cwd(), cfg.dataRoot, 'changes');
    try {
      const files = await fsp.readdir(changesDir);
      const changeFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse();
      const summaries: ChangeSummary[] = [];
      const readPromises = changeFiles.map(async (file) => {
        try {
          const data = await fsp.readFile(path.join(changesDir, file), 'utf-8');
          return JSON.parse(data) as ChangeSummary;
        } catch (error) {
          console.error(`Failed to load change summary ${file}:`, error);
          return null;
        }
      });

      const results = await Promise.all(readPromises);
      summaries.push(...results.filter((summary): summary is ChangeSummary => summary !== null));
      return summaries;
    } catch (error) {
      return [];
    }
  }

  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.storage.from('changes').list('', { limit: 1000 });
      if (error || !data) return [];
      const relevant = data.filter((file) => file.name?.startsWith(`${safeTag}_`));
      const summaries = await Promise.all(
        relevant.map((file) => downloadJsonFromSupabase<ChangeSummary>('changes', file.name))
      );
      return summaries.filter((summary): summary is ChangeSummary => Boolean(summary));
    } catch (error) {
      console.error('[Supabase] Failed to list change summaries:', error);
      return [];
    }
  }

  return [];
}
