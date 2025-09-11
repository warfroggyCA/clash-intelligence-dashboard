import { promises as fs } from 'fs';
import path from 'path';

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
}

export interface RejoinNotification {
  memberTag: string;
  memberName: string;
  previousDeparture: DepartureRecord;
  rejoinDate: string;
  daysAway: number;
}

const DEPARTURES_DIR = path.join(process.cwd(), 'data', 'departures');

// Ensure departures directory exists
async function ensureDeparturesDir() {
  try {
    await fs.mkdir(DEPARTURES_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Get departure file path for a clan
function getDepartureFilePath(clanTag: string): string {
  const cleanTag = clanTag.replace('#', '').toUpperCase();
  return path.join(DEPARTURES_DIR, `${cleanTag}.json`);
}

// Read all departures for a clan
export async function readDepartures(clanTag: string): Promise<DepartureRecord[]> {
  try {
    await ensureDeparturesDir();
    const filePath = getDepartureFilePath(clanTag);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty
    return [];
  }
}

// Write departures for a clan
export async function writeDepartures(clanTag: string, departures: DepartureRecord[]): Promise<void> {
  await ensureDeparturesDir();
  const filePath = getDepartureFilePath(clanTag);
  await fs.writeFile(filePath, JSON.stringify(departures, null, 2));
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
    const playerDBDir = path.join(process.cwd(), 'data', 'player-db');
    await fs.mkdir(playerDBDir, { recursive: true });
    
    const filePath = path.join(playerDBDir, 'departures.json');
    let departures = [];
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      departures = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }
    
    // Check if we already have this departure to avoid duplicates
    const existingIndex = departures.findIndex((d: any) => 
      d.memberTag === departure.memberTag && 
      d.departureDate === departure.departureDate
    );
    
    if (existingIndex >= 0) {
      // Update existing record
      departures[existingIndex] = departureData;
    } else {
      // Add new record
      departures.push(departureData);
    }
    
    await fs.writeFile(filePath, JSON.stringify(departures, null, 2));
    
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
  const currentMemberTags = new Set(currentMembers.map(m => m.tag));
  
  const rejoins: RejoinNotification[] = [];
  
  for (const departure of departures) {
    if (currentMemberTags.has(departure.memberTag)) {
      const departureDate = new Date(departure.departureDate);
      const now = new Date();
      const daysAway = Math.floor((now.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const currentMember = currentMembers.find(m => m.tag === departure.memberTag);
      
      rejoins.push({
        memberTag: departure.memberTag,
        memberName: currentMember?.name || departure.memberName,
        previousDeparture: departure,
        rejoinDate: now.toISOString(),
        daysAway
      });
    }
  }
  
  return rejoins;
}

// Get active departures (members who left and haven't returned)
export async function getActiveDepartures(
  clanTag: string,
  currentMembers: Array<{ tag: string; name: string }>
): Promise<DepartureRecord[]> {
  const departures = await readDepartures(clanTag);
  const currentMemberTags = new Set(currentMembers.map(m => m.tag));
  
  return departures.filter(departure => !currentMemberTags.has(departure.memberTag));
}

// Mark a departure as resolved (member returned)
export async function markDepartureResolved(clanTag: string, memberTag: string): Promise<void> {
  const departures = await readDepartures(clanTag);
  const filtered = departures.filter(d => d.memberTag !== memberTag);
  await writeDepartures(clanTag, filtered);
}
