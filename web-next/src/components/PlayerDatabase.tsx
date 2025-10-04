"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, UserCheck } from "lucide-react";
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import CreatePlayerNoteModal from "./CreatePlayerNoteModal";
import FontSizeControl from "./FontSizeControl";
import DepartedPlayersTable from "./DepartedPlayersTable";
import ReturningPlayerReview from "./ReturningPlayerReview";
import { detectReturns, processPlayerReturn, type PlayerHistoryRecord } from '@/lib/player-history';

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
  const [activeView, setActiveView] = useState<'all' | 'departed'>('all');
  const [returningPlayers, setReturningPlayers] = useState<Array<{
    player: PlayerHistoryRecord;
    currentName: string;
    nameChanged: boolean;
  }>>([]);
  const [showReturningPlayerReview, setShowReturningPlayerReview] = useState(false);

  // Function to load player database from localStorage
  const loadPlayerDatabase = useCallback(() => {
    // Only run on client-side to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return;
    }

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
          
          // Detect returning players
          const currentRoster = currentClanMembers.map(tag => {
            const nameKey = `player_name_${tag}`;
            return {
              tag,
              name: localStorage.getItem(nameKey) || 'Unknown',
            };
          });
          
          // Convert PlayerRecords to PlayerHistoryRecords
          const historyRecords: PlayerHistoryRecord[] = playerRecords.map(record => {
            // Extract movement history from notes
            const movements = record.notes
              .filter(n => n.customFields?.['Movement Type'])
              .map(n => ({
                type: n.customFields?.['Movement Type'] as 'joined' | 'departed' | 'returned',
                date: n.customFields?.['Departure Date'] || n.customFields?.['Return Date'] || n.timestamp,
                reason: n.customFields?.['Departure Reason'],
                tenureAtDeparture: parseInt(n.customFields?.['Tenure at Departure'] || '0'),
                notes: n.note,
              }));

            // Calculate if departed
            const lastMovement = movements[movements.length - 1];
            const isDeparted = lastMovement?.type === 'departed';

            return {
              tag: record.tag,
              primaryName: record.name,
              aliases: [], // Will be built from name changes
              movements,
              totalTenure: 0, // Can be calculated from movements
              currentStint: isDeparted ? null : {
                startDate: lastMovement?.date || record.lastUpdated,
                isActive: true,
              },
              notes: record.notes,
              status: (record.status as any) || (isDeparted ? 'departed' : 'active'),
              lastUpdated: record.lastUpdated,
            };
          });

          const returns = detectReturns(currentRoster, historyRecords);
          if (returns.length > 0) {
            setReturningPlayers(returns);
            setShowReturningPlayerReview(true);
          }
          
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
  }, [currentClanMembers]);

  // Function to apply player name resolutions from the cron job
  const applyPlayerNameResolutions = useCallback(async () => {
    // Only run on client-side to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return;
    }

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
  }, [loadPlayerDatabase]);

  // Function to sync departure data and create player notes
  const syncDepartureData = async () => {
    // Only run on client-side to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return;
    }

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
            const departureDate = safeLocaleDateString(departure.departureDate, {
              fallback: 'Unknown Date',
              context: 'PlayerDatabase departure history entry'
            });
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
    // Only run on client-side to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return;
    }

    try {
      let cleanedCount = 0;
      const keys = Object.keys(localStorage).filter(key => key.startsWith('player_notes_'));
      
      keys.forEach(key => {
        const notes = JSON.parse(localStorage.getItem(key) || "[]");
        const uniqueNotes: any[] = [];
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Migration failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount and when dependencies change
  useEffect(() => {
    loadPlayerDatabase();
    applyPlayerNameResolutions();
    // Note: syncDepartureData() removed from automatic execution to prevent duplicates
    // Users can manually sync using the "Sync Departures" button
  }, [loadPlayerDatabase, applyPlayerNameResolutions]);

  // Handle processing player return
  const handleProcessReturn = useCallback((
    playerTag: string,
    options: { awardPreviousTenure?: number; returnNotes?: string }
  ) => {
    const returningPlayer = returningPlayers.find(r => r.player.tag === playerTag);
    if (!returningPlayer) return;

    // Process the return
    const updatedPlayer = processPlayerReturn(
      playerTag,
      returningPlayer.currentName,
      returningPlayer.player,
      options
    );

    // Save updated record to localStorage
    const notesKey = `player_notes_${playerTag}`;
    localStorage.setItem(notesKey, JSON.stringify(updatedPlayer.notes));

    // Update player name if changed
    const nameKey = `player_name_${playerTag}`;
    localStorage.setItem(nameKey, updatedPlayer.primaryName);

    // Save aliases
    if (updatedPlayer.aliases.length > 0) {
      const aliasKey = `player_aliases_${playerTag}`;
      localStorage.setItem(aliasKey, JSON.stringify(updatedPlayer.aliases));
    }

    // Reload player database
    loadPlayerDatabase();
  }, [returningPlayers, loadPlayerDatabase]);

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

  // Separate departed players (with departure info) from all players
  const departedPlayers = players.filter(p => {
    const hasDepartureInfo = p.notes.some(note => 
      note.customFields?.['Departure Date'] || 
      note.customFields?.['Departure Reason'] ||
      note.customFields?.['Tenure at Departure']
    );
    return hasDepartureInfo || p.status === 'Departed' || p.status === 'Left' || p.status === 'Kicked';
  });

  return (
    <div className="space-y-4">
      {/* Returning Players Banner */}
      {!showReturningPlayerReview && returningPlayers.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">
                  🎉 {returningPlayers.length} Departed Player{returningPlayers.length !== 1 ? 's' : ''} {returningPlayers.length !== 1 ? 'Have' : 'Has'} Returned!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Review their history and decide on tenure awards
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReturningPlayerReview(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
            >
              Review Returns
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Player Database</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activeView === 'departed' 
              ? 'Players who have departed from the clan'
              : 'All tracked players including departed members'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <FontSizeControl />
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

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('all')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition ${
              activeView === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            All Players ({players.length})
          </button>
          <button
            onClick={() => setActiveView('departed')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition ${
              activeView === 'departed'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Departed Players ({departedPlayers.length})
          </button>
        </div>
      </div>

      {/* Departed Players Table View */}
      {activeView === 'departed' ? (
        <DepartedPlayersTable 
          players={departedPlayers.map(p => ({
            ...p,
            departureDate: p.notes.find(n => n.customFields?.['Departure Date'])?.customFields?.['Departure Date'],
            departureReason: p.notes.find(n => n.customFields?.['Departure Reason'])?.customFields?.['Departure Reason'],
            tenure: parseInt(p.notes.find(n => n.customFields?.['Tenure at Departure'])?.customFields?.['Tenure at Departure'] || '0'),
          }))}
        />
      ) : (
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
                      {safeLocaleDateString(player.lastUpdated, {
                        fallback: 'Unknown',
                        context: 'PlayerDatabase table row lastUpdated'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* Player Detail Modal */}
      {showPlayerModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Compact Header with All Key Info */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-4 mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                    {selectedPlayer.name}
                  </h2>
                  <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                    {selectedPlayer.tag}
                  </span>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <span className="text-gray-600">
                    {selectedPlayer.notes.length} note{selectedPlayer.notes.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">Last updated: {safeLocaleDateString(selectedPlayer?.lastUpdated, {
                    fallback: 'Unknown',
                    context: 'PlayerDatabase selectedPlayer lastUpdated'
                  })}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">Status:</span>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={(typeof window !== 'undefined' ? (localStorage.getItem(`player_status_${selectedPlayer.tag}`) || '') : '')}
                    onChange={(e) => {
                      try {
                        const key = `player_status_${selectedPlayer.tag.toUpperCase()}`;
                        const val = e.target.value;
                        if (val) localStorage.setItem(key, val); else localStorage.removeItem(key);
                      } catch {}
                    }}
                  >
                    <option value="">—</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="consider-later">Consider Later</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={closePlayerModal} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors flex-shrink-0"
                title="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Compact Notes Section */}
            <div className="space-y-4">
              <details className="bg-gray-50 rounded border p-3">
                <summary className="cursor-pointer font-medium text-gray-800">How to use this modal</summary>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <p>- Set the player’s Status to track applicant progress (Shortlisted, Hired, Rejected, etc.).</p>
                  <p>- Click “Add Note” to append timestamped notes with custom fields (e.g., interview results or reasons).</p>
                  <p>- Notes and status are stored locally in your browser. Use “Scan History” to import departures.</p>
                </div>
              </details>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Player Notes</h3>
                <button
                  onClick={() => setShowCreatePlayerNote(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Note
                </button>
              </div>
              
              {selectedPlayer.notes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-lg mb-2">No notes added yet</p>
                  <p className="text-sm">Click &quot;Add Note&quot; to create your first note for this player</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPlayer.notes.map((note, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-sm text-gray-500">
                          {safeLocaleString(note.timestamp, {
                            fallback: 'Unknown',
                            context: 'PlayerDatabase note timestamp'
                          })}
                        </div>
                        {Object.keys(note.customFields).length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {Object.keys(note.customFields).length} field{Object.keys(note.customFields).length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-900 mb-3 leading-relaxed">{note.note}</div>
                      {Object.keys(note.customFields).length > 0 && (
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">Custom Fields:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(note.customFields).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-gray-600">{key}:</span>
                                <span className="ml-2 text-gray-900">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Player Note Modal */}
      {showCreatePlayerNote && (
        <CreatePlayerNoteModal
          prefilledPlayerTag={selectedPlayer?.tag}
          prefilledPlayerName={selectedPlayer?.name}
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
