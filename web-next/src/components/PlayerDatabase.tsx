"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import CreatePlayerNoteModal from "./CreatePlayerNoteModal";

interface PlayerNote {
  timestamp: string;
  note: string;
  customFields: Record<string, string>;
}

interface PlayerRecord {
  tag: string;
  name: string;
  notes: PlayerNote[];
  lastUpdated: string;
}

interface PlayerDatabaseProps {
  currentClanMembers?: string[]; // Array of current clan member tags
}

export default function PlayerDatabase({ currentClanMembers = [] }: PlayerDatabaseProps) {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showCreatePlayerNote, setShowCreatePlayerNote] = useState(false);

  useEffect(() => {
    loadPlayerDatabase();
    applyPlayerNameResolutions();
    // Note: syncDepartureData() removed from automatic execution to prevent duplicates
    // Users can manually sync using the "Sync Departures" button
  }, [currentClanMembers]);

  // Function to apply player name resolutions from the cron job
  const applyPlayerNameResolutions = async () => {
    try {
      const response = await fetch('/api/player-resolver');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.playerNames) {
          let resolved = 0;
          
          // Update localStorage with resolved names
          Object.entries(data.playerNames).forEach(([playerTag, playerName]) => {
            const nameKey = `player_name_${playerTag}`;
            const currentName = localStorage.getItem(nameKey);
            
            // Only update if we don't have a name or if it's "Unknown Player"
            if (!currentName || currentName === 'Unknown Player') {
              localStorage.setItem(nameKey, playerName as string);
              resolved++;
            }
          });
          
          if (resolved > 0) {
            console.log(`[PlayerDatabase] Resolved ${resolved} unknown player names`);
            // Reload data to show updated names
            loadPlayerDatabase();
          }
        }
      }
    } catch (error) {
      console.error('[PlayerDatabase] Error applying player name resolutions:', error);
    }
  };

  // Function to sync departure data and create player notes
  const syncDepartureData = async () => {
    try {
      const response = await fetch('/api/player-db/sync-departures', {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.departureData) {
          let syncedCount = 0;
          
          // Process each departure and create player notes
          for (const departure of data.departureData) {
            const notesKey = `player_notes_${departure.memberTag.toUpperCase()}`;
            let existingNotes = JSON.parse(localStorage.getItem(notesKey) || "[]");
            
            // Check if we already have a departure note for this specific departure date and reason
            const departureDate = new Date(departure.departureDate).toLocaleDateString();
            const hasDepartureNote = existingNotes.some((note: any) => 
              note.note.includes('Member departed on') && 
              note.note.includes(departureDate) &&
              note.customFields?.['Departure Date'] === departureDate &&
              note.customFields?.['Departure Reason'] === (departure.departureReason || 'Not specified')
            );
            
            if (!hasDepartureNote) {
              const timestamp = new Date().toISOString();
              const noteData = {
                timestamp,
                note: `Member departed on ${departureDate}. ${departure.departureReason ? `Reason: ${departure.departureReason}` : 'No reason provided'}. ${departure.notes ? `Additional notes: ${departure.notes}` : ''}`,
                customFields: {
                  'Last Role': departure.lastRole || 'Unknown',
                  'Last TH Level': departure.lastTownHall?.toString() || 'Unknown',
                  'Last Trophies': departure.lastTrophies?.toString() || 'Unknown',
                  'Departure Date': departureDate,
                  'Departure Reason': departure.departureReason || 'Not specified',
                  'Added By': departure.addedBy || 'System'
                }
              };
              
              existingNotes.push(noteData);
              localStorage.setItem(notesKey, JSON.stringify(existingNotes));
              
              // Store player name for reference
              const nameKey = `player_name_${departure.memberTag.toUpperCase()}`;
              localStorage.setItem(nameKey, departure.memberName);
              
              syncedCount++;
            }
          }
          
          if (syncedCount > 0) {
            console.log(`[PlayerDatabase] Synced ${syncedCount} departure records to Player DB`);
            // Reload the database to show the new entries
            loadPlayerDatabase();
          }
        }
      }
    } catch (error) {
      console.error('[PlayerDatabase] Error syncing departure data:', error);
    }
  };

  // Function to clean up duplicate notes
  const cleanupDuplicateNotes = () => {
    try {
      let cleanedCount = 0;
      const keys = Object.keys(localStorage).filter(key => key.startsWith('player_notes_'));
      
      keys.forEach(key => {
        const notes = JSON.parse(localStorage.getItem(key) || "[]");
        const uniqueNotes = [];
        const seenNotes = new Set();
        
        notes.forEach((note: any) => {
          // Create a unique identifier for the note based on content and custom fields
          const noteId = `${note.note}_${JSON.stringify(note.customFields || {})}`;
          
          if (!seenNotes.has(noteId)) {
            seenNotes.add(noteId);
            uniqueNotes.push(note);
          } else {
            cleanedCount++;
          }
        });
        
        if (uniqueNotes.length !== notes.length) {
          localStorage.setItem(key, JSON.stringify(uniqueNotes));
          console.log(`[Cleanup] Removed ${notes.length - uniqueNotes.length} duplicate notes for ${key}`);
        }
      });
      
      if (cleanedCount > 0) {
        alert(`Cleaned up ${cleanedCount} duplicate notes!`);
        loadPlayerDatabase(); // Reload to show the cleaned data
      } else {
        alert('No duplicate notes found.');
      }
    } catch (error) {
      console.error('[PlayerDatabase] Error cleaning up duplicate notes:', error);
      alert('Error cleaning up duplicate notes. Check console for details.');
    }
  };

  // Function to migrate historical departures from snapshots
  const migrateHistoricalDepartures = async () => {
    try {
      setLoading(true);
      console.log('[PlayerDatabase] Starting historical departure migration...');
      
      const response = await fetch('/api/migrate-departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }) // Scan last 7 days
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`[PlayerDatabase] Migration completed: ${data.departuresFound} departures found`);
          
          // Show success message
          alert(`Migration completed!\n\nFound ${data.departuresFound} historical departures from ${data.snapshotsProcessed} snapshots.\n\nDate range: ${data.dateRange.from} to ${data.dateRange.to}\n\nClick Refresh to see the new entries.`);
          
          // Sync the new departure data
          await syncDepartureData();
        } else {
          console.error('[PlayerDatabase] Migration failed:', data.error);
          alert(`Migration failed: ${data.error}`);
        }
      } else {
        const errorData = await response.json();
        console.error('[PlayerDatabase] Migration API error:', errorData);
        alert(`Migration failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[PlayerDatabase] Error during migration:', error);
      alert(`Migration failed: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerDatabase = () => {
    try {
      setLoading(true);
      const playerRecords: PlayerRecord[] = [];
      
      // Get all localStorage keys at once to avoid repeated key() calls
      const allKeys = Object.keys(localStorage);
      const noteKeys = allKeys.filter(key => key.startsWith('player_notes_'));
      
      // Process in batches to avoid blocking the UI
      const processBatch = (keys: string[], startIndex: number = 0) => {
        const batchSize = 10; // Process 10 at a time
        const batch = keys.slice(startIndex, startIndex + batchSize);
        
        batch.forEach(key => {
          const playerTag = key.replace('player_notes_', '');
          const notes = JSON.parse(localStorage.getItem(key) || '[]');
          
          if (notes.length > 0) {
            // Get player name if stored
            const nameKey = `player_name_${playerTag}`;
            const playerName = localStorage.getItem(nameKey) || 'Unknown Player';
            
            // Find most recent note timestamp
            const lastUpdated = notes.reduce((latest: string, note: PlayerNote) => {
              return note.timestamp > latest ? note.timestamp : latest;
            }, notes[0]?.timestamp || '');
            
            // Only include players who are NOT currently in the clan
            if (!currentClanMembers.includes(playerTag)) {
              playerRecords.push({
                tag: playerTag,
                name: playerName,
                notes,
                lastUpdated
              });
            }
          }
        });
        
        // Continue with next batch if there are more keys
        if (startIndex + batchSize < keys.length) {
          setTimeout(() => processBatch(keys, startIndex + batchSize), 0);
        } else {
          // All batches processed, sort and update state
          playerRecords.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
          setPlayers(playerRecords);
          setLoading(false);
        }
      };
      
      if (noteKeys.length === 0) {
        setLoading(false);
      } else {
        processBatch(noteKeys);
      }
    } catch (error) {
      console.error('Failed to load player database:', error);
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.notes.some(note => 
      note.note.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const openPlayerModal = (player: PlayerRecord) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };

  const closePlayerModal = () => {
    setSelectedPlayer(null);
    setShowPlayerModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-gray-500">Loading player database...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Player Database</h2>
          <p className="text-sm text-gray-600 mt-1">Players who have left the clan or were never in the clan</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreatePlayerNote(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Note</span>
          </button>
          <button
            onClick={migrateHistoricalDepartures}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <span>📊</span>
            <span>Scan History</span>
          </button>
          <button
            onClick={syncDepartureData}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center space-x-2"
          >
            <span>🔄</span>
            <span>Sync Departures</span>
          </button>
          <button
            onClick={cleanupDuplicateNotes}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <span>🧹</span>
            <span>Clean Duplicates</span>
          </button>
          <button
            onClick={loadPlayerDatabase}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search players by name, tag, or note content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No players found matching your search.' : 'No departed players with notes found. This database shows players who have left the clan or were never in the clan.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Last Note</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPlayers.map((player) => (
                  <tr
                    key={player.tag}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openPlayerModal(player)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-500">{player.tag}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={player.notes[0]?.note || 'No notes available'}>
                        {player.notes[0]?.note || 'No notes available'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {player.notes.length} note{player.notes.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(player.lastUpdated).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {showPlayerModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold truncate pr-2">Player: {selectedPlayer.name}</h2>
              <button onClick={closePlayerModal} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p><strong>Tag:</strong> {selectedPlayer.tag}</p>
              <p><strong>Name:</strong> {selectedPlayer.name}</p>
              <p><strong>Total Notes:</strong> {selectedPlayer.notes.length}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">All Notes</h3>
              {selectedPlayer.notes.map((note, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-2">
                    {new Date(note.timestamp).toLocaleString()}
                  </div>
                  <div className="text-gray-700 mb-3">{note.note}</div>
                  {Object.keys(note.customFields).length > 0 && (
                    <div className="text-sm">
                      <strong>Custom Fields:</strong>
                      <div className="mt-1 space-y-1">
                        {Object.entries(note.customFields).map(([key, value]) => (
                          <div key={key} className="text-gray-600">
                            <strong>{key}:</strong> {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Player Note Modal */}
      {showCreatePlayerNote && (
        <CreatePlayerNoteModal
          onClose={() => {
            setShowCreatePlayerNote(false);
            // Refresh the database after creating a note
            loadPlayerDatabase();
          }}
        />
      )}
    </div>
  );
}
