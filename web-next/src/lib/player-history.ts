/**
 * Player History & Return Management System
 * Handles player departures, returns, aliases, and tenure tracking
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
  totalTenure: number; // cumulative across all stints
  currentStint: {
    startDate: string;
    isActive: boolean;
  } | null;
  notes: Array<{
    timestamp: string;
    note: string;
    customFields?: Record<string, string>;
  }>;
  status: 'active' | 'departed' | 'applicant' | 'rejected';
  lastUpdated: string;
}

/**
 * Detect if a player is a returning member
 */
export function detectReturningPlayer(
  playerTag: string,
  playerDatabase: any[]
): PlayerHistoryRecord | null {
  const record = playerDatabase.find(p => p.tag === playerTag);
  if (!record) return null;

  // Check if they have departure history
  const hasDeparted = record.notes?.some((note: any) => 
    note.customFields?.['Departure Date'] || 
    note.customFields?.['Movement Type'] === 'departed'
  );

  return hasDeparted ? record : null;
}

/**
 * Check if a player name is an alias of an existing player
 */
export function findPlayerByAlias(
  playerName: string,
  playerDatabase: PlayerHistoryRecord[]
): PlayerHistoryRecord | null {
  return playerDatabase.find(record => 
    record.aliases.some(alias => 
      alias.name.toLowerCase() === playerName.toLowerCase()
    )
  ) || null;
}

/**
 * Track name change as new alias
 */
export function addAlias(
  record: PlayerHistoryRecord,
  newName: string
): PlayerHistoryRecord {
  const existingAlias = record.aliases.find(a => a.name === newName);
  
  if (existingAlias) {
    existingAlias.lastSeen = new Date().toISOString();
  } else {
    record.aliases.push({
      name: newName,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
  }

  return record;
}

/**
 * Process player return
 */
export function processPlayerReturn(
  playerTag: string,
  playerName: string,
  previousRecord: PlayerHistoryRecord,
  options: {
    awardPreviousTenure?: number; // optional manual tenure to award
    returnNotes?: string;
  } = {}
): PlayerHistoryRecord {
  const now = new Date().toISOString();

  // Track name change if different
  if (playerName !== previousRecord.primaryName) {
    addAlias(previousRecord, previousRecord.primaryName);
    previousRecord.primaryName = playerName;
  }

  // Add return movement
  previousRecord.movements.push({
    type: 'returned',
    date: now,
    notes: options.returnNotes || 'Player returned to clan',
  });

  // Update current stint
  previousRecord.currentStint = {
    startDate: now,
    isActive: true,
  };

  // Award tenure if specified (manual decision)
  if (options.awardPreviousTenure) {
    previousRecord.totalTenure += options.awardPreviousTenure;
  }

  // Update status
  previousRecord.status = 'active';
  previousRecord.lastUpdated = now;

  // Add automatic return note
  previousRecord.notes.push({
    timestamp: now,
    note: `Player returned to clan${options.awardPreviousTenure ? ` (${options.awardPreviousTenure} days tenure awarded)` : ' (starting fresh)'}`,
    customFields: {
      'Movement Type': 'returned',
      'Return Date': now,
      'Awarded Tenure': options.awardPreviousTenure?.toString() || '0',
    },
  });

  return previousRecord;
}

/**
 * Process player departure
 */
export function processPlayerDeparture(
  record: PlayerHistoryRecord,
  options: {
    departureReason: string;
    tenureAtDeparture: number;
    departureNotes?: string;
  }
): PlayerHistoryRecord {
  const now = new Date().toISOString();

  // Add departure movement
  record.movements.push({
    type: 'departed',
    date: now,
    reason: options.departureReason,
    tenureAtDeparture: options.tenureAtDeparture,
    notes: options.departureNotes,
  });

  // Update current stint
  if (record.currentStint) {
    record.currentStint.isActive = false;
  }

  // Update status
  record.status = 'departed';
  record.lastUpdated = now;

  // Add departure note
  record.notes.push({
    timestamp: now,
    note: options.departureNotes || `Player departed: ${options.departureReason}`,
    customFields: {
      'Movement Type': 'departed',
      'Departure Date': now,
      'Departure Reason': options.departureReason,
      'Tenure at Departure': options.tenureAtDeparture.toString(),
    },
  });

  return record;
}

/**
 * Calculate statistics for a returning player
 */
export function getReturningPlayerStats(record: PlayerHistoryRecord) {
  const departures = record.movements.filter(m => m.type === 'departed');
  const returns = record.movements.filter(m => m.type === 'returned');
  
  const lastDeparture = departures[departures.length - 1];
  const daysSinceDeparture = lastDeparture 
    ? Math.floor((Date.now() - new Date(lastDeparture.date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    timesReturned: returns.length,
    timesDeparted: departures.length,
    lastDepartureReason: lastDeparture?.reason || 'Unknown',
    lastDepartureDate: lastDeparture?.date || null,
    daysSinceDeparture,
    lastTenure: lastDeparture?.tenureAtDeparture || 0,
    totalTenure: record.totalTenure,
    aliases: record.aliases.length,
  };
}

/**
 * Format movement history for display
 */
export function formatMovementHistory(movements: PlayerMovement[]): string[] {
  return movements.map(m => {
    const date = new Date(m.date).toLocaleDateString();
    switch (m.type) {
      case 'joined':
        return `${date}: Joined clan`;
      case 'departed':
        return `${date}: Departed (${m.reason || 'Unknown reason'})${m.tenureAtDeparture ? ` - ${m.tenureAtDeparture} days tenure` : ''}`;
      case 'returned':
        return `${date}: Returned to clan${m.notes ? ` - ${m.notes}` : ''}`;
      default:
        return `${date}: ${m.type}`;
    }
  });
}

/**
 * Sync player database with current roster to detect returns
 */
export function detectReturns(
  currentRoster: Array<{ tag: string; name: string }>,
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

  currentRoster.forEach(rosterMember => {
    const departedRecord = playerDatabase.find(
      p => p.tag === rosterMember.tag && p.status === 'departed'
    );

    if (departedRecord) {
      returns.push({
        player: departedRecord,
        currentName: rosterMember.name,
        nameChanged: rosterMember.name !== departedRecord.primaryName,
      });
    }
  });

  return returns;
}
