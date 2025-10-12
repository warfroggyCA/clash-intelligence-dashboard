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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🏰</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
                {roster.clanName}
              </h1>
              <div className="flex gap-6 mt-2 text-sm">
                <p className="text-blue-300">
                  <span className="text-gray-400">Updated:</span> {new Date(roster.date).toLocaleDateString()}
                </p>
                <p className="text-emerald-300">
                  <span className="text-gray-400">Members:</span> {roster.members.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Roster Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Player</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 uppercase tracking-wider">TH</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300 uppercase tracking-wider">🏆 Trophies</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300 uppercase tracking-wider">📤 Given</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300 uppercase tracking-wider">📥 Received</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">League</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {roster.members.map((player, index) => (
                  <tr 
                    key={player.tag} 
                    className="hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <Link 
                        href={`/simple-player/${player.tag.replace('#', '')}`}
                        className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors flex items-center gap-2"
                      >
                        <span className="text-lg">👤</span>
                        {player.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg text-sm font-bold shadow-md">
                        {player.townHallLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full font-medium shadow-sm ${
                        player.role === 'leader' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-50' :
                        player.role === 'coLeader' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-orange-50' :
                        player.role === 'admin' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-purple-50' :
                        'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-100'
                      }`}>
                        {player.role === 'leader' && '👑'}
                        {player.role === 'coLeader' && '⭐'}
                        {player.role === 'admin' && '🛡️'}
                        {player.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-yellow-400 font-semibold">
                        {player.trophies.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-green-400 font-semibold">
                        {player.donations}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-blue-400 font-semibold">
                        {player.donationsReceived}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-300 font-medium">
                        {player.rankedLeagueName || '🚫 Unranked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
