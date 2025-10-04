"use client";

import React, { useState } from 'react';

interface DepartureData {
  memberTag: string;
  memberName: string;
  departureDate: string;
  lastRole: string;
  lastTownHall: number;
  notes?: string;
  departureReason?: string;
  addedBy?: string;
}

interface SyncResult {
  synced: number;
  errors: string[];
  syncedPlayers: string[];
}

export default function DepartureSyncTool() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncDepartures = async () => {
    setIsSyncing(true);
    const errors: string[] = [];
    const syncedPlayers: string[] = [];
    let synced = 0;

    try {
      // Call the sync API endpoint
      const response = await fetch('/api/player-db/sync-departures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success && data.data && data.data.departureData) {
        console.log('Found departure data:', data.data.departureData.length, 'departures');
        // Process each departure and create localStorage entries
        for (const departure of data.data.departureData) {
          try {
            const notesKey = `player_notes_${departure.memberTag.toUpperCase()}`;
            const nameKey = `player_name_${departure.memberTag.toUpperCase()}`;
            
            // Check if we already have notes for this player
            const existingNotes = JSON.parse(localStorage.getItem(notesKey) || "[]");
            
            // Create departure note
            const departureDate = new Date(departure.departureDate).toLocaleDateString();
            const noteData = {
              timestamp: new Date().toISOString(),
              note: `Member departed on ${departureDate}. ${departure.departureReason ? `Reason: ${departure.departureReason}` : 'No reason provided'}. ${departure.notes ? `Additional notes: ${departure.notes}` : ''}`,
              customFields: {
                'Last Role': departure.lastRole || 'Unknown',
                'Last TH Level': departure.lastTownHall?.toString() || 'Unknown',
                'Departure Date': departureDate,
                'Departure Reason': departure.departureReason || 'Not specified',
                'Added By': departure.addedBy || 'System'
              }
            };

            // Check if we already have a departure note for this specific date
            const hasDepartureNote = existingNotes.some((note: any) => 
              note.note.includes('Member departed on') && 
              note.note.includes(departureDate)
            );

            if (!hasDepartureNote) {
              existingNotes.push(noteData);
              localStorage.setItem(notesKey, JSON.stringify(existingNotes));
              
              // Store player name
              localStorage.setItem(nameKey, departure.memberName);
              
              synced++;
              syncedPlayers.push(departure.memberTag);
              console.log(`Synced departure for ${departure.memberName} (${departure.memberTag})`);
            } else {
              console.log(`Departure note already exists for ${departure.memberName}`);
            }
          } catch (error) {
            const errorMsg = `Failed to sync ${departure.memberName}: ${error}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      } else {
        console.log('No departure data found. API response structure:', data);
        errors.push('No departure data found in API response');
      }

      setResult({
        synced,
        errors,
        syncedPlayers
      });

    } catch (error) {
      const errorMsg = `Sync failed: ${error}`;
      errors.push(errorMsg);
      setResult({
        synced: 0,
        errors,
        syncedPlayers: []
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">🔄 Departure Data Sync Tool</h2>
      
      <div className="space-y-4">
        <p className="text-gray-600">
          This tool will sync your stored departure data (from September 10th) into the Player Database.
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={syncDepartures}
            disabled={isSyncing}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : '🔄 Sync Departure Data'}
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Sync Results:</h3>
            <ul className="space-y-1 text-sm">
              <li>✅ Successfully synced {result.synced} players</li>
              {result.errors.length > 0 && (
                <li>❌ {result.errors.length} errors occurred</li>
              )}
            </ul>
            
            {result.syncedPlayers.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Synced Players:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.syncedPlayers.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-red-600">Errors:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
