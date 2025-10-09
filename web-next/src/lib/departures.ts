import { promises as fs } from 'fs';
import path from 'path';
import { normalizeTag } from './tags';
import { cfg } from './config';
import { getSupabaseAdminClient } from './supabase-admin';

export interface DepartureRecord {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason?: string;
  notes?: string;
  addedBy?: string;
  lastSeen?: string;
  lastRole?: string;
  lastTownHall?: number;
  lastTrophies?: number;
  resolved?: boolean;
  resolvedAt?: string;
  rejoinDate?: string;
}

export interface RejoinNotification {
  memberTag: string;
  memberName: string;
  previousDeparture: DepartureRecord;
  rejoinDate: string;
  daysAway: number;
}

const DEPARTURES_DIR = path.join(process.cwd(), 'data', 'departures');
const DEPARTURES_BUCKET = 'departures';
const PLAYER_DB_BUCKET = 'player-db';

// Ensure departures directory exists
async function ensureDeparturesDir() {
  if (!cfg.useLocalData) return;
  try {
    await fs.mkdir(DEPARTURES_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Get departure file path for a clan
function getDepartureFilePath(clanTag: string): string {
  // Preserve uppercase file convention for backward compatibility
  const cleanTag = normalizeTag(clanTag).slice(1).toUpperCase();
  return path.join(DEPARTURES_DIR, `${cleanTag}.json`);
}

function getDepartureFilename(clanTag: string) {
  return `${normalizeTag(clanTag).slice(1).toUpperCase()}.json`;
}

async function loadDeparturesFromSupabase(clanTag: string): Promise<DepartureRecord[] | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const filename = getDepartureFilename(clanTag);
    const { data, error } = await supabase.storage.from(DEPARTURES_BUCKET).download(filename);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as DepartureRecord[];
  } catch (error) {
    console.error('[Departures] Failed to load from Supabase:', error);
    return null;
  }
}

async function saveDeparturesToSupabase(clanTag: string, departures: DepartureRecord[]): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const filename = getDepartureFilename(clanTag);
    const { error } = await supabase.storage
      .from(DEPARTURES_BUCKET)
      .upload(filename, JSON.stringify(departures, null, 2), { contentType: 'application/json', upsert: true });
    if (error) throw error;
  } catch (error) {
    console.error('[Departures] Failed to save to Supabase:', error);
  }
}

// Read all departures for a clan
export async function readDepartures(clanTag: string): Promise<DepartureRecord[]> {
  if (cfg.useLocalData) {
    try {
      await ensureDeparturesDir();
      const filePath = getDepartureFilePath(clanTag);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  if (cfg.useSupabase) {
    const data = await loadDeparturesFromSupabase(clanTag);
    return data || [];
  }

  return [];
}

// Write departures for a clan
export async function writeDepartures(clanTag: string, departures: DepartureRecord[]): Promise<void> {
  if (cfg.useLocalData) {
    await ensureDeparturesDir();
    const filePath = getDepartureFilePath(clanTag);
    await fs.writeFile(filePath, JSON.stringify(departures, null, 2));
  }

  if (cfg.useSupabase) {
    await saveDeparturesToSupabase(clanTag, departures);
  }
}

// Add a new departure record
export async function addDeparture(clanTag: string, departure: DepartureRecord): Promise<void> {
  const departures = await readDepartures(clanTag);
  
  // Check if this member already has a departure record
  const existingIndex = departures.findIndex(d => d.memberTag === departure.memberTag);
  
  if (existingIndex >= 0) {
    // Update existing record
    departures[existingIndex] = departure;
  } else {
    // Add new record
    departures.push(departure);
  }
  
  await writeDepartures(clanTag, departures);

  // Store departure data for Player DB integration
  await storeDepartureForPlayerDB(departure);
}

// Store departure data in a format that can be picked up by the Player DB
async function storeDepartureForPlayerDB(departure: DepartureRecord): Promise<void> {
  try {
    const departureData = {
      memberTag: departure.memberTag,
      memberName: departure.memberName,
      departureDate: departure.departureDate,
      lastRole: departure.lastRole,
      lastTownHall: departure.lastTownHall,
      lastTrophies: departure.lastTrophies,
      departureReason: departure.departureReason,
      notes: departure.notes,
      addedBy: 'System (Auto-detected)',
      timestamp: new Date().toISOString()
    };

    // Store in a special file that the Player DB can read
    if (cfg.useLocalData) {
      const playerDBDir = path.join(process.cwd(), 'data', 'player-db');
      await fs.mkdir(playerDBDir, { recursive: true });
      const filePath = path.join(playerDBDir, 'departures.json');
      let departures = [];
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        departures = JSON.parse(data);
      } catch {}
      const existingIndex = departures.findIndex((d: any) =>
        d.memberTag === departure.memberTag &&
        d.departureDate === departure.departureDate
      );
      if (existingIndex >= 0) {
        departures[existingIndex] = departureData;
      } else {
        departures.push(departureData);
      }
      await fs.writeFile(filePath, JSON.stringify(departures, null, 2));
    }

    if (cfg.useSupabase) {
      try {
        const supabase = getSupabaseAdminClient();
        const filename = 'departures.json';
        const { data, error } = await supabase.storage.from(PLAYER_DB_BUCKET).download(filename);
        let departures: any[] = [];
        if (!error && data) {
          const text = await data.text();
          departures = JSON.parse(text || '[]');
        }
        const existingIndex = departures.findIndex((d: any) =>
          d.memberTag === departure.memberTag &&
          d.departureDate === departure.departureDate
        );
        if (existingIndex >= 0) {
          departures[existingIndex] = departureData;
        } else {
          departures.push(departureData);
        }
        await supabase.storage
          .from(PLAYER_DB_BUCKET)
          .upload(filename, JSON.stringify(departures, null, 2), { contentType: 'application/json', upsert: true });
      } catch (error) {
        console.error('[Departure] Failed to store Player DB departure in Supabase:', error);
      }
    }

    console.log(`[Departure] Stored departure data for Player DB: ${departure.memberName} (${departure.memberTag})`);
  } catch (error) {
    console.error('Failed to store departure for Player DB:', error);
  }
}

// Check for rejoins (members who left and are now back)
export async function checkForRejoins(
  clanTag: string, 
  currentMembers: Array<{ tag: string; name: string }>
): Promise<RejoinNotification[]> {
  const departures = await readDepartures(clanTag);
  const currentMemberTags = new Set(currentMembers.map(m => normalizeTag(m.tag)));
  
  const rejoins: RejoinNotification[] = [];
  
  // Server-side noise filters: only return credible, recent rejoins
  const minDaysAway = Number(process.env.RPR_MIN_DAYS_AWAY || '1');
  const maxDepartureAgeDays = Number(process.env.RPR_MAX_DEPARTURE_AGE_DAYS || '45');

  for (const departure of departures) {
    if (departure.resolved) continue;

    const tag = normalizeTag(departure.memberTag);
    if (!currentMemberTags.has(tag)) continue; // not currently in clan → not a rejoin

    // Validate departure date
    const departureDate = departure.departureDate ? new Date(departure.departureDate) : null;
    if (!departureDate || Number.isNaN(departureDate.getTime())) continue;

    const now = new Date();
    const daysAway = Math.floor((now.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24));

    // Must be away for at least minDaysAway (avoid trivial flickers)
    if (!(typeof daysAway === 'number' && daysAway >= minDaysAway)) continue;
    // Ignore very old departures (likely already back long-term or bad data)
    if (daysAway > maxDepartureAgeDays) continue;

    const currentMember = currentMembers.find(m => normalizeTag(m.tag) === tag);

    rejoins.push({
      memberTag: departure.memberTag,
      memberName: currentMember?.name || departure.memberName,
      previousDeparture: departure,
      rejoinDate: now.toISOString(),
      daysAway
    });
  }
  
  return rejoins;
}

// Get active departures (members who left and haven't returned)
export async function getActiveDepartures(
  clanTag: string,
  currentMembers: Array<{ tag: string; name: string }>
): Promise<DepartureRecord[]> {
  const departures = await readDepartures(clanTag);
  const currentMemberTags = new Set(currentMembers.map(m => normalizeTag(m.tag)));
  
  return departures.filter(departure => !departure.resolved && !currentMemberTags.has(normalizeTag(departure.memberTag)));
}

// Mark a departure as resolved (member returned)
export async function markDepartureResolved(clanTag: string, memberTag: string): Promise<void> {
  const departures = await readDepartures(clanTag);
  const norm = normalizeTag(memberTag);
  const now = new Date().toISOString();
  const updated = departures.map((d) => {
    if (normalizeTag(d.memberTag) === norm) {
      return { ...d, resolved: true, resolvedAt: now, rejoinDate: now } as DepartureRecord;
    }
    return d;
  });
  await writeDepartures(clanTag, updated);
}
