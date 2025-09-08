"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

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

  useEffect(() => {
    loadPlayerDatabase();
  }, [currentClanMembers]);

  const loadPlayerDatabase = () => {
    try {
      setLoading(true);
      const playerRecords: PlayerRecord[] = [];
      
      // Scan localStorage for all player notes
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('player_notes_')) {
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
        }
      }
      
      // Sort by last updated (most recent first)
      playerRecords.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
      setPlayers(playerRecords);
    } catch (error) {
      console.error('Failed to load player database:', error);
    } finally {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Player Database</h2>
          <p className="text-sm text-gray-600 mt-1">Players who have left the clan or were never in the clan</p>
        </div>
        <button
          onClick={loadPlayerDatabase}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="mb-4">
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
          <div className="space-y-2">
            {filteredPlayers.map((player) => (
              <div
                key={player.tag}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openPlayerModal(player)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{player.name}</h3>
                    <p className="text-sm text-gray-600">{player.tag}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {player.notes.length} note{player.notes.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      Last updated: {new Date(player.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {player.notes[0]?.note || 'No notes available'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {showPlayerModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Player: {selectedPlayer.name}</h2>
              <button onClick={closePlayerModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
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
    </div>
  );
}
