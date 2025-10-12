/**
 * SIMPLE ROSTER TABLE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 */

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Player {
  tag: string;
  name: string;
  townHallLevel: number;
  role: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  rankedLeagueName?: string;
}

interface RosterData {
  members: Player[];
  clanName: string;
  date: string;
}

export default function SimpleRosterPage() {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoster() {
      try {
        setLoading(true);
        console.log('[SimpleRoster] Fetching roster data from /api/v2/roster');
        const response = await fetch('/api/v2/roster');
        
        console.log('[SimpleRoster] Response status:', response.status);
        console.log('[SimpleRoster] Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[SimpleRoster] Error response:', errorText);
          throw new Error(`Failed to load roster: ${response.status} - ${errorText.substring(0, 100)}`);
        }
        
        const apiData = await response.json();
        console.log('[SimpleRoster] API data structure:', {
          success: apiData.success,
          hasData: !!apiData.data,
          hasClan: !!apiData.data?.clan,
          hasMembers: !!apiData.data?.members,
          memberCount: apiData.data?.members?.length
        });
        
        // Transform API response to our format
        if (apiData.success && apiData.data) {
          const transformed = {
            members: apiData.data.members.map((m: any) => ({
              tag: m.tag,
              name: m.name,
              townHallLevel: m.townHallLevel,
              role: m.role,
              trophies: m.trophies,
              donations: m.donations,
              donationsReceived: m.donationsReceived,
              rankedLeagueName: m.rankedLeagueName
            })),
            clanName: apiData.data.clan.name,
            date: apiData.data.snapshot.fetchedAt
          };
          console.log('[SimpleRoster] Transformed roster:', {
            clanName: transformed.clanName,
            memberCount: transformed.members.length
          });
          setRoster(transformed);
        } else {
          console.error('[SimpleRoster] Invalid API response format:', apiData);
          throw new Error('Invalid API response format');
        }
      } catch (err) {
        console.error('[SimpleRoster] Load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load roster');
      } finally {
        setLoading(false);
      }
    }

    loadRoster();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Loading Roster...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-4 text-red-400">Error</h1>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">No Roster Data</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{roster.clanName}</h1>
          <p className="text-gray-400">Last updated: {new Date(roster.date).toLocaleDateString()}</p>
          <p className="text-gray-400">Members: {roster.members.length}</p>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-left">TH</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-right">Trophies</th>
                <th className="px-4 py-3 text-right">Donations</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-left">League</th>
              </tr>
            </thead>
            <tbody>
              {roster.members.map((player, index) => (
                <tr 
                  key={player.tag} 
                  className={`border-t border-gray-700 hover:bg-gray-750 ${
                    index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link 
                      href={`/simple-player/${player.tag.replace('#', '')}`}
                      className="text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      {player.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-600 rounded text-sm font-bold">
                      {player.townHallLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm px-2 py-1 rounded ${
                      player.role === 'leader' ? 'bg-yellow-600' :
                      player.role === 'coLeader' ? 'bg-orange-600' :
                      player.role === 'admin' ? 'bg-purple-600' :
                      'bg-gray-600'
                    }`}>
                      {player.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{player.trophies.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">{player.donations}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-400">{player.donationsReceived}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{player.rankedLeagueName || 'Unranked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
