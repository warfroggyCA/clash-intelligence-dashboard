import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { safeLocaleDateString } from '@/lib/date';

// POST /api/player-db/sync-departures
// This endpoint syncs departure data to the Player DB by creating player notes
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-db/sync-departures');
  try {
    // First, check the main departures directory for existing data
    const departuresDir = path.join(process.cwd(), 'data', 'departures');
    const clanTag = process.env.HOME_CLAN_TAG || '#2PR8R8V8P';
    const safeTag = clanTag.replace('#', '').toUpperCase();
    const mainDeparturesFile = path.join(departuresDir, `${safeTag}.json`);
    
    let departures = [];
    
    // Try to load from main departures file first
    try {
      const data = await fs.readFile(mainDeparturesFile, 'utf-8');
      departures = JSON.parse(data);
      console.log(`[Sync] Loaded ${departures.length} departures from main departures file`);
    } catch (error) {
      // Try the player-db directory as fallback
      const playerDBDir = path.join(process.cwd(), 'data', 'player-db');
      const filePath = path.join(playerDBDir, 'departures.json');
      
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        departures = JSON.parse(data);
        console.log(`[Sync] Loaded ${departures.length} departures from player-db file`);
      } catch (error2) {
        // No departure data found
        return json({ success: true, data: { synced: 0, message: 'No departure data to sync' } });
      }
    }
    
    let syncedCount = 0;
    const errors = [];
    
    for (const departure of departures) {
      try {
        // Create the departure note data
        const timestamp = new Date().toISOString();
        const formattedDepartureDate = safeLocaleDateString(departure.departureDate, {
          fallback: 'Unknown Date',
          context: 'SyncDepartures departure.departureDate'
        });
        const noteData = {
          timestamp,
          note: `Member departed on ${formattedDepartureDate}. ${departure.departureReason ? `Reason: ${departure.departureReason}` : 'No reason provided'}. ${departure.notes ? `Additional notes: ${departure.notes}` : ''}`,
          customFields: {
            'Last Role': departure.lastRole || 'Unknown',
            'Last TH Level': departure.lastTownHall?.toString() || 'Unknown',
            'Last Trophies': departure.lastTrophies?.toString() || 'Unknown',
            'Departure Date': formattedDepartureDate,
            'Departure Reason': departure.departureReason || 'Not specified',
            'Added By': departure.addedBy || 'System'
          }
        };

        // This will be handled by the client-side Player DB component
        // We'll return the data and let the client create the localStorage entries
        syncedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync ${departure.memberName}: ${errorMessage}`);
      }
    }
    
    // Clear the player-db departures file after processing to prevent re-syncing
    if (departures.length > 0) {
      try {
        const playerDBDir = path.join(process.cwd(), 'data', 'player-db');
        const filePath = path.join(playerDBDir, 'departures.json');
        await fs.writeFile(filePath, '[]', 'utf-8');
        console.log('[Sync] Cleared player-db departures file to prevent re-syncing');
      } catch (error) {
        console.warn('[Sync] Could not clear player-db departures file:', error);
      }
    }
    
    return json({
      success: true,
      data: {
        synced: syncedCount,
        total: departures.length,
        errors: errors.length > 0 ? errors : undefined,
        departureData: departures
      }
    });
  } catch (error: any) {
    console.error('Error syncing departures to Player DB:', error);
    return json({ 
      success: false,
      error: error.message || 'Failed to sync departures',
      message: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
