// web-next/src/lib/player-resolver.ts
import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import { getSupabaseAdminClient } from './supabase-admin';
import type { DailySnapshot } from './snapshots';
import { convertFullSnapshotToDailySnapshot } from './snapshots';

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
    const clanTag = cfg.homeClanTag;
    
    if (!clanTag) {
      throw new Error('No home clan configured');
    }

    const safeTag = safeTagForFilename(clanTag);

    // Collect recent snapshots (latest + previous 30)
    const snapshots: DailySnapshot[] = await loadRecentSnapshots(safeTag, 30);

    if (!snapshots.length) {
      console.log('[PlayerResolver] No snapshots found');
      return results;
    }

    const playerNameLookup = new Map<string, string>();
    for (const snap of snapshots) {
      (snap.members || []).forEach((member: any) => {
        if (!playerNameLookup.has(member.tag)) {
          playerNameLookup.set(member.tag, member.name);
        }
      });
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

    if (cfg.useLocalData) {
      const resolutionFile = path.join(dataDir, 'player-name-resolution.json');
      await fsp.writeFile(resolutionFile, JSON.stringify(resolutionData, null, 2));
    }

    if (cfg.useSupabase) {
      try {
        const supabase = getSupabaseAdminClient();
        await supabase.storage
          .from('player-db')
          .upload('player-name-resolution.json', JSON.stringify(resolutionData, null, 2), {
            contentType: 'application/json',
            upsert: true,
          });
      } catch (error) {
        console.error('[PlayerResolver] Failed to upload resolution data to Supabase:', error);
      }
    }

    console.log(`[PlayerResolver] Created resolution data with ${playerNameLookup.size} player names`);
    
    results.resolved = playerNameLookup.size;

  } catch (error: any) {
    console.error('[PlayerResolver] Error resolving unknown players:', error);
    results.errors.push(error.message);
  }

  return results;
}

async function loadRecentSnapshots(safeTag: string, limit = 30): Promise<DailySnapshot[]> {
  const snapshots: DailySnapshot[] = [];

  if (cfg.useLocalData) {
    const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
    try {
      const files = await fsp.readdir(snapshotsDir);
      const snapshotFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      for (const file of snapshotFiles) {
        try {
          const snapshotData = await fsp.readFile(path.join(snapshotsDir, file), 'utf-8');
          snapshots.push(JSON.parse(snapshotData));
        } catch (error) {
          console.warn(`[PlayerResolver] Failed to load snapshot ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('[PlayerResolver] Failed to read local snapshots:', error);
    }
  }

  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('clan_snapshots')
        .select('clan_tag, fetched_at, snapshot_date, clan, member_summaries, player_details, current_war, war_log, capital_seasons, metadata')
        .eq('clan_tag', safeTag)
        .order('snapshot_date', { ascending: false })
        .limit(limit);

      if (!error && data?.length) {
        for (const record of data as any[]) {
          try {
            const fullSnapshot = {
              clanTag: normalizeTag(record.clan_tag),
              fetchedAt: record.fetched_at,
              clan: record.clan,
              memberSummaries: record.member_summaries,
              playerDetails: record.player_details,
              currentWar: record.current_war,
              warLog: record.war_log,
              capitalRaidSeasons: record.capital_seasons,
              metadata: record.metadata,
            };
            const daily = convertFullSnapshotToDailySnapshot(fullSnapshot);
            snapshots.push(daily);
          } catch (error) {
            console.warn('[PlayerResolver] Failed to parse Supabase clan snapshot:', error);
          }
        }
      } else {
        if (error && error.code !== 'PGRST116') {
          console.error('[PlayerResolver] Failed to load clan_snapshots:', error);
        }

        // Fallback to legacy snapshots bucket if needed
        const { data: legacyData, error: legacyError } = await supabase
          .from('snapshots')
          .select('filename, file_url, date')
          .eq('clan_tag', safeTag)
          .order('date', { ascending: false })
          .limit(limit);
        if (!legacyError && legacyData) {
          for (const row of legacyData as any[]) {
            try {
              let json: DailySnapshot | null = null;
              if (row.file_url) {
                const response = await fetch(row.file_url);
                if (response.ok) {
                  json = await response.json();
                }
              }
              if (!json) {
                const { data: fileData } = await supabase.storage.from('snapshots').download(row.filename);
                if (fileData) {
                  const text = await fileData.text();
                  json = JSON.parse(text);
                }
              }
              if (json) snapshots.push(json);
            } catch (error) {
              console.warn('[PlayerResolver] Failed to load legacy Supabase snapshot:', error);
            }
          }
        } else if (legacyError && legacyError.code !== 'PGRST116') {
          console.error('[PlayerResolver] Failed to load legacy snapshots:', legacyError);
        }
      }
    } catch (error) {
      console.error('[PlayerResolver] Failed to load snapshots from Supabase:', error);
    }
  }

  return snapshots;
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
