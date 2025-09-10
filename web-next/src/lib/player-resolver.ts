// web-next/src/lib/player-resolver.ts
import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';

export interface PlayerNote {
  timestamp: string;
  note: string;
  customFields: Record<string, string>;
}

export interface PlayerRecord {
  tag: string;
  name: string;
  notes: PlayerNote[];
  lastUpdated: string;
}

/**
 * Resolves unknown player references by looking up current player names
 * from recent snapshots and updating localStorage accordingly
 */
export async function resolveUnknownPlayers(): Promise<{
  resolved: number;
  errors: string[];
}> {
  const results = {
    resolved: 0,
    errors: [] as string[]
  };

  try {
    console.log('[PlayerResolver] Starting unknown player resolution...');

    // Get all player note keys from localStorage (this would be done in browser context)
    // For cron job, we need to simulate this by checking the data directory
    const dataDir = path.join(process.cwd(), cfg.dataRoot);
    
    // Get recent snapshots to build a player name lookup
    const snapshotsDir = path.join(dataDir, 'snapshots');
    const clanTag = cfg.homeClanTag;
    
    if (!clanTag) {
      throw new Error('No home clan configured');
    }

    const safeTag = clanTag.replace('#', '').toLowerCase();
    
    // Get the most recent snapshot
    const files = await fsp.readdir(snapshotsDir);
    const snapshotFiles = files
      .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
      .sort()
      .reverse();

    if (snapshotFiles.length === 0) {
      console.log('[PlayerResolver] No snapshots found');
      return results;
    }

    // Load the most recent snapshot
    const latestSnapshotFile = snapshotFiles[0];
    const snapshotData = await fsp.readFile(path.join(snapshotsDir, latestSnapshotFile), 'utf-8');
    const snapshot = JSON.parse(snapshotData);

    // Build player name lookup from current and recent snapshots
    const playerNameLookup = new Map<string, string>();
    
    // Add current snapshot members
    if (snapshot.members) {
      snapshot.members.forEach((member: any) => {
        playerNameLookup.set(member.tag, member.name);
      });
    }

    // Add members from recent snapshots (last 30 days worth)
    const recentFiles = snapshotFiles.slice(0, 30); // Last 30 snapshots
    for (const file of recentFiles) {
      try {
        const fileData = await fsp.readFile(path.join(snapshotsDir, file), 'utf-8');
        const fileSnapshot = JSON.parse(fileData);
        
        if (fileSnapshot.members) {
          fileSnapshot.members.forEach((member: any) => {
            if (!playerNameLookup.has(member.tag)) {
              playerNameLookup.set(member.tag, member.name);
            }
          });
        }
      } catch (error) {
        console.warn(`[PlayerResolver] Failed to load snapshot ${file}:`, error);
      }
    }

    console.log(`[PlayerResolver] Built lookup for ${playerNameLookup.size} players`);

    // Check for player notes that need resolution
    // Since we're in a server context, we can't directly access localStorage
    // Instead, we'll create a function that can be called from the browser
    // or we'll store the resolution data in a file that the frontend can use

    // For now, let's create a resolution file that the frontend can use
    const resolutionData = {
      timestamp: new Date().toISOString(),
      playerNames: Object.fromEntries(playerNameLookup),
      totalPlayers: playerNameLookup.size
    };

    const resolutionFile = path.join(dataDir, 'player-name-resolution.json');
    await fsp.writeFile(resolutionFile, JSON.stringify(resolutionData, null, 2));

    console.log(`[PlayerResolver] Created resolution file with ${playerNameLookup.size} player names`);
    
    results.resolved = playerNameLookup.size;

  } catch (error: any) {
    console.error('[PlayerResolver] Error resolving unknown players:', error);
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Client-side function to apply player name resolutions
 * This should be called from the frontend to update localStorage
 */
export function applyPlayerNameResolutions(resolutionData: any): number {
  let resolved = 0;
  
  try {
    const { playerNames } = resolutionData;
    
    // Update localStorage with resolved names
    Object.entries(playerNames).forEach(([playerTag, playerName]) => {
      const nameKey = `player_name_${playerTag}`;
      const currentName = localStorage.getItem(nameKey);
      
      // Only update if we don't have a name or if it's "Unknown Player"
      if (!currentName || currentName === 'Unknown Player') {
        localStorage.setItem(nameKey, playerName as string);
        resolved++;
      }
    });
    
    console.log(`[PlayerResolver] Resolved ${resolved} unknown player names`);
  } catch (error) {
    console.error('[PlayerResolver] Error applying resolutions:', error);
  }
  
  return resolved;
}
