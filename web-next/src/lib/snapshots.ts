// web-next/src/lib/snapshots.ts
// Daily snapshot storage and change detection system

import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from './coc';

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

function getSnapshotPath(clanTag: string, date: string): string {
  const safeTag = clanTag.replace('#', '').toLowerCase();
  return path.join(process.cwd(), cfg.dataRoot, 'snapshots', `${safeTag}_${date}.json`);
}

function getChangesPath(clanTag: string, date: string): string {
  const safeTag = clanTag.replace('#', '').toLowerCase();
  return path.join(process.cwd(), cfg.dataRoot, 'changes', `${safeTag}_${date}.json`);
}

// Ensure directories exist
async function ensureDirectories(): Promise<void> {
  const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
  const changesDir = path.join(process.cwd(), cfg.dataRoot, 'changes');
  
  try {
    await fsp.mkdir(snapshotsDir, { recursive: true });
    await fsp.mkdir(changesDir, { recursive: true });
  } catch (error) {
    // Directories might already exist
  }
}

// Create a daily snapshot
export async function createDailySnapshot(clanTag: string): Promise<DailySnapshot> {
  await ensureDirectories();
  
  const date = ymdToday();
  const timestamp = new Date().toISOString();
  
  // Fetch clan data
  const [clanInfo, members] = await Promise.all([
    getClanInfo(clanTag),
    getClanMembers(clanTag)
  ]);

  // Enrich members with detailed data (using existing rate limiter)
  const enrichedMembers: Member[] = [];
  for (const member of members) {
    try {
      const player = await getPlayer(member.tag);
      const heroes = extractHeroLevels(player);
      
      enrichedMembers.push({
        name: member.name,
        tag: member.tag,
        townHallLevel: player.townHallLevel,
        bk: typeof heroes.bk === "number" ? heroes.bk : null,
        aq: typeof heroes.aq === "number" ? heroes.aq : null,
        gw: typeof heroes.gw === "number" ? heroes.gw : null,
        rc: typeof heroes.rc === "number" ? heroes.rc : null,
        mp: typeof heroes.mp === "number" ? heroes.mp : null,
        trophies: member.trophies,
        donations: member.donations,
        donationsReceived: member.donationsReceived,
        role: member.role,
        tenure_days: 0, // Will be populated from ledger if needed
        // Additional properties for change detection
        attackWins: player.attackWins || 0,
        versusBattleWins: player.versusBattleWins || 0,
        versusTrophies: player.versusTrophies || 0,
        clanCapitalContributions: player.clanCapitalContributions || 0,
      });
    } catch (error) {
      console.error(`Failed to fetch player data for ${member.tag}:`, error);
      // Add basic member data even if detailed fetch fails
      enrichedMembers.push({
        name: member.name,
        tag: member.tag,
        trophies: member.trophies,
        donations: member.donations,
        donationsReceived: member.donationsReceived,
        role: member.role,
        // Set default values for change detection properties
        attackWins: 0,
        versusBattleWins: 0,
        versusTrophies: 0,
        clanCapitalContributions: 0,
      });
    }
  }

  const snapshot: DailySnapshot = {
    date,
    clanTag,
    clanName: (clanInfo as any)?.name,
    timestamp,
    members: enrichedMembers,
    memberCount: enrichedMembers.length,
    totalTrophies: enrichedMembers.reduce((sum, m) => sum + (m.trophies || 0), 0),
    totalDonations: enrichedMembers.reduce((sum, m) => sum + (m.donations || 0), 0),
  };

  // Save snapshot
  const snapshotPath = getSnapshotPath(clanTag, date);
  await fsp.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

  return snapshot;
}

// Load a snapshot for a specific date
export async function loadSnapshot(clanTag: string, date: string): Promise<DailySnapshot | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const safeTag = clanTag.replace('#', '').toLowerCase();
    const filename = `${safeTag}_${date}.json`;
    
    // Get the file URL from database
    const { data: snapshotData, error } = await supabase
      .from('snapshots')
      .select('file_url')
      .eq('clan_tag', safeTag)
      .eq('filename', filename)
      .single();
    
    if (error || !snapshotData) {
      return null;
    }
    
    // Fetch the actual snapshot data
    const response = await fetch(snapshotData.file_url);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data as DailySnapshot;
  } catch (error) {
    return null;
  }
}

// Get the most recent snapshot
export async function getLatestSnapshot(clanTag: string): Promise<DailySnapshot | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const safeTag = clanTag.replace('#', '').toLowerCase();
    
    // Get the most recent snapshot from database
    const { data: snapshotData, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('clan_tag', safeTag)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !snapshotData) {
      return null;
    }
    
    // For now, return null since we don't have the actual snapshot data stored
    // The snapshots in Supabase only have metadata, not the full member data
    console.log('Snapshot metadata found but no member data available');
    return null;
  } catch (error) {
    return null;
  }
}

// Compare two snapshots and detect changes
export function detectChanges(previous: DailySnapshot, current: DailySnapshot): MemberChange[] {
  const changes: MemberChange[] = [];
  
  // Create maps for easier comparison
  const prevMembers = new Map(previous.members.map(m => [m.tag, m]));
  const currMembers = new Map(current.members.map(m => [m.tag, m]));
  
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
  
  // Check for changes in existing members
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
    
    // Trophy changes (significant changes only)
    const trophyDiff = (currentMember.trophies || 0) - (prevMember.trophies || 0);
    if (Math.abs(trophyDiff) >= 50) {
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
    
    // Donation changes (significant changes only) - ROCK-SOLID SIGNAL
    const donationDiff = (currentMember.donations || 0) - (prevMember.donations || 0);
    if (donationDiff >= 100) {
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
    
    // Donations received changes - HIGH-CONFIDENCE SIGNAL
    const donationsReceivedDiff = (currentMember.donationsReceived || 0) - (prevMember.donationsReceived || 0);
    if (donationsReceivedDiff >= 50) {
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
    
    // Attack wins changes - ROCK-SOLID SIGNAL
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
    
    // Versus battle wins changes - ROCK-SOLID SIGNAL
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
    
    // Versus trophies changes - ROCK-SOLID SIGNAL
    const versusTrophiesDiff = (currentMember.versusTrophies || 0) - (prevMember.versusTrophies || 0);
    if (Math.abs(versusTrophiesDiff) >= 20) {
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
    
    // Clan Capital contributions changes - ROCK-SOLID SIGNAL
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
  confidence: 'definitive' | 'high' | 'weak';
  evidence: string[]; // list of fields that changed
  priority: number; // 1-5, higher = more recent activity
};

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
  
  const changesPath = getChangesPath(summary.clanTag, summary.date);
  await fsp.writeFile(changesPath, JSON.stringify(summary, null, 2));
}

// Load change summary
export async function loadChangeSummary(clanTag: string, date: string): Promise<ChangeSummary | null> {
  try {
    const changesPath = getChangesPath(clanTag, date);
    const data = await fsp.readFile(changesPath, 'utf-8');
    return JSON.parse(data) as ChangeSummary;
  } catch (error) {
    return null;
  }
}

// Get all change summaries for a clan
export async function getAllChangeSummaries(clanTag: string): Promise<ChangeSummary[]> {
  const changesDir = path.join(process.cwd(), cfg.dataRoot, 'changes');
  const safeTag = clanTag.replace('#', '').toLowerCase();
  
  try {
    const files = await fsp.readdir(changesDir);
    const changeFiles = files
      .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
      .sort()
      .reverse();
    
    // Read all files in parallel for much better performance
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
