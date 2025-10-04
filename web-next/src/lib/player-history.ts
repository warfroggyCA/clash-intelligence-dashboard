/**
 * Player History and Movement Tracking System
 * Handles complete player lifecycle including departures, returns, and alias tracking
 */

export interface PlayerAlias {
  name: string;
  firstSeen: string;
  lastSeen: string;
}

export interface PlayerMovement {
  type: 'joined' | 'departed' | 'returned';
  date: string;
  reason?: string;
  tenureAtDeparture?: number;
  notes?: string;
}

export interface PlayerHistoryRecord {
  tag: string;
  primaryName: string;
  aliases: PlayerAlias[];
  movements: PlayerMovement[];
  totalTenure: number;
  currentStint: { startDate: string; isActive: boolean; } | null;
  notes: Array<{ 
    timestamp: string; 
    note: string; 
    customFields?: Record<string, string>; 
  }>;
  status: 'active' | 'departed' | 'applicant' | 'rejected';
  lastUpdated: string;
}

/**
 * Detect if a player is returning based on current roster vs player database
 */
export function detectReturningPlayer(
  playerTag: string, 
  playerDatabase: PlayerHistoryRecord[]
): PlayerHistoryRecord | null {
  const normalizedTag = playerTag.replace('#', '').toUpperCase();
  
  // Find existing record for this player tag
  const existingRecord = playerDatabase.find(
    record => record.tag.replace('#', '').toUpperCase() === normalizedTag
  );
  
  if (!existingRecord) return null;
  
  // Check if player was previously departed
  const lastMovement = existingRecord.movements[existingRecord.movements.length - 1];
  const isDeparted = lastMovement?.type === 'departed' || existingRecord.status === 'departed';
  
  return isDeparted ? existingRecord : null;
}

/**
 * Find a player by alias/name match
 */
export function findPlayerByAlias(
  playerName: string, 
  playerDatabase: PlayerHistoryRecord[]
): PlayerHistoryRecord | null {
  const searchName = playerName.toLowerCase().trim();
  
  return playerDatabase.find(record => {
    // Check primary name
    if (record.primaryName.toLowerCase().trim() === searchName) {
      return true;
    }
    
    // Check aliases
    return record.aliases.some(alias => 
      alias.name.toLowerCase().trim() === searchName
    );
  }) || null;
}

/**
 * Add an alias to a player record
 */
export function addAlias(
  record: PlayerHistoryRecord, 
  newName: string
): PlayerHistoryRecord {
  const trimmedName = newName.trim();
  
  // Don't add if it's the same as primary name
  if (trimmedName === record.primaryName) return record;
  
  // Don't add if alias already exists
  const existingAlias = record.aliases.find(
    alias => alias.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existingAlias) {
    // Update lastSeen
    existingAlias.lastSeen = new Date().toISOString();
    return { ...record };
  }
  
  // Add new alias
  const newAlias: PlayerAlias = {
    name: trimmedName,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
  
  return {
    ...record,
    aliases: [...record.aliases, newAlias],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Process a player return with options
 */
export function processPlayerReturn(
  playerTag: string,
  playerName: string,
  previousRecord: PlayerHistoryRecord,
  options: {
    awardPreviousTenure?: number;
    returnNotes?: string;
  } = {}
): PlayerHistoryRecord {
  const now = new Date().toISOString();
  
  // Create return movement
  const returnMovement: PlayerMovement = {
    type: 'returned',
    date: now,
    notes: options.returnNotes
  };
  
  // Update aliases if name changed
  let updatedRecord = previousRecord;
  if (playerName !== previousRecord.primaryName) {
    updatedRecord = addAlias(previousRecord, previousRecord.primaryName);
    updatedRecord.primaryName = playerName;
  }
  
  // Create return note with custom fields
  const returnNote = {
    timestamp: now,
    note: options.returnNotes || `Player returned to clan as ${playerName}`,
    customFields: {
      'Movement Type': 'returned',
      'Return Date': now,
      'Previous Tenure Awarded': options.awardPreviousTenure?.toString() || '0',
      'Name at Return': playerName
    }
  };
  
  return {
    ...updatedRecord,
    movements: [...updatedRecord.movements, returnMovement],
    currentStint: {
      startDate: now,
      isActive: true
    },
    totalTenure: updatedRecord.totalTenure + (options.awardPreviousTenure || 0),
    notes: [...updatedRecord.notes, returnNote],
    status: 'active',
    lastUpdated: now
  };
}

/**
 * Process a player departure
 */
export function processPlayerDeparture(
  record: PlayerHistoryRecord,
  options: {
    departureReason?: string;
    tenureAtDeparture?: number;
    departureNotes?: string;
  } = {}
): PlayerHistoryRecord {
  const now = new Date().toISOString();
  
  // Create departure movement
  const departureMovement: PlayerMovement = {
    type: 'departed',
    date: now,
    reason: options.departureReason,
    tenureAtDeparture: options.tenureAtDeparture,
    notes: options.departureNotes
  };
  
  // Create departure note with custom fields
  const departureNote = {
    timestamp: now,
    note: options.departureNotes || `Player departed: ${options.departureReason || 'Unknown reason'}`,
    customFields: {
      'Movement Type': 'departed',
      'Departure Date': now,
      'Departure Reason': options.departureReason || 'Unknown',
      'Tenure at Departure': options.tenureAtDeparture?.toString() || '0'
    }
  };
  
  return {
    ...record,
    movements: [...record.movements, departureMovement],
    currentStint: null,
    notes: [...record.notes, departureNote],
    status: 'departed',
    lastUpdated: now
  };
}

/**
 * Get returning player statistics
 */
export function getReturningPlayerStats(record: PlayerHistoryRecord) {
  const departures = record.movements.filter(m => m.type === 'departed');
  const returns = record.movements.filter(m => m.type === 'returned');
  
  const lastDeparture = departures[departures.length - 1];
  const daysSinceDeparture = lastDeparture 
    ? Math.floor((Date.now() - new Date(lastDeparture.date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return {
    totalDepartures: departures.length,
    totalReturns: returns.length,
    lastDepartureDate: lastDeparture?.date,
    lastDepartureReason: lastDeparture?.reason,
    daysSinceDeparture,
    previousTenure: lastDeparture?.tenureAtDeparture || 0,
    wasKicked: lastDeparture?.reason?.toLowerCase().includes('kick') || 
               lastDeparture?.reason?.toLowerCase().includes('boot') ||
               record.status === 'rejected'
  };
}

/**
 * Format movement history for display
 */
export function formatMovementHistory(movements: PlayerMovement[]): string[] {
  return movements.map(movement => {
    const date = new Date(movement.date).toLocaleDateString();
    let description = `${movement.type.charAt(0).toUpperCase() + movement.type.slice(1)} on ${date}`;
    
    if (movement.reason) {
      description += ` (${movement.reason})`;
    }
    
    if (movement.tenureAtDeparture) {
      description += ` - ${movement.tenureAtDeparture} days tenure`;
    }
    
    return description;
  });
}

/**
 * Detect returns for all players in current roster
 */
export function detectReturns(
  currentRoster: Array<{ tag: string; name: string; }>,
  playerDatabase: PlayerHistoryRecord[]
): Array<{
  player: PlayerHistoryRecord;
  currentName: string;
  nameChanged: boolean;
}> {
  const returns: Array<{
    player: PlayerHistoryRecord;
    currentName: string;
    nameChanged: boolean;
  }> = [];
  
  for (const rosterMember of currentRoster) {
    const returningPlayer = detectReturningPlayer(rosterMember.tag, playerDatabase);
    
    if (returningPlayer) {
      const nameChanged = rosterMember.name !== returningPlayer.primaryName;
      
      returns.push({
        player: returningPlayer,
        currentName: rosterMember.name,
        nameChanged
      });
    }
  }
  
  return returns;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generate tenure summary
 */
export function getTenureSummary(record: PlayerHistoryRecord): {
  currentTenure: number;
  totalTenure: number;
  averageStint: number;
  longestStint: number;
} {
  const now = Date.now();
  let currentTenure = 0;
  let totalTenure = record.totalTenure;
  let stints: number[] = [];
  
  if (record.currentStint?.isActive) {
    currentTenure = daysBetween(record.currentStint.startDate, new Date().toISOString());
    totalTenure += currentTenure;
  }
  
  // Calculate stint lengths from movements
  for (let i = 0; i < record.movements.length; i++) {
    const movement = record.movements[i];
    if (movement.type === 'joined' || movement.type === 'returned') {
      // Find corresponding departure
      const nextDeparture = record.movements
        .slice(i + 1)
        .find(m => m.type === 'departed');
      
      if (nextDeparture) {
        const stintLength = daysBetween(movement.date, nextDeparture.date);
        stints.push(stintLength);
      }
    }
  }
  
  const averageStint = stints.length > 0 
    ? Math.round(stints.reduce((sum, stint) => sum + stint, 0) / stints.length)
    : currentTenure;
  
  const longestStint = Math.max(...stints, currentTenure);
  
  return {
    currentTenure,
    totalTenure,
    averageStint,
    longestStint
  };
}