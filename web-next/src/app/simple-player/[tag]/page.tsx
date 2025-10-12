/**
 * SIMPLE PLAYER PROFILE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 */

"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PlayerData {
  name: string;
  tag: string;
  role?: string;
  townHallLevel: number;
  trophies: number;
  donations?: number;
  donationsReceived?: number;
  league?: {
    name: string;
  };
  rankedLeague?: {
    name: string;
  };
  heroes?: Array<{
    name: string;
    level: number;
    maxLevel?: number;
  }>;
  bk?: number;
  aq?: number;
  gw?: number;
  rc?: number;
  mp?: number;
  clan?: {
    name: string;
  };
}

export default function SimplePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const tag = params?.tag as string;
  
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tag) return;

    async function loadProfile() {
      try {
        setLoading(true);
        const response = await fetch(`/api/player/%23${tag}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load player: ${response.status}`);
        }
        
        const apiData = await response.json();
        
        if (apiData.success && apiData.data) {
          setPlayer(apiData.data);
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load player profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [tag]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Loading Player...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-4 text-red-400">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">No Player Data</h1>
        </div>
      </div>
    );
  }

  // Build heroes array from the player data
  const heroes = [];
  if (player.bk) heroes.push({ name: 'Barbarian King', level: player.bk });
  if (player.aq) heroes.push({ name: 'Archer Queen', level: player.aq });
  if (player.gw) heroes.push({ name: 'Grand Warden', level: player.gw });
  if (player.rc) heroes.push({ name: 'Royal Champion', level: player.rc });
  if (player.mp) heroes.push({ name: 'Minion Prince', level: player.mp });

  const donations = player.donations || 0;
  const donationsReceived = player.donationsReceived || 0;
  const donationBalance = donations - donationsReceived;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
        >
          ← Back
        </button>

        {/* Player Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{player.name}</h1>
              <p className="text-gray-400 font-mono">{player.tag}</p>
              {player.clan?.name && <p className="text-gray-400">{player.clan.name}</p>}
            </div>
            <div className="text-right">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-600 rounded-lg text-2xl font-bold mb-2">
                {player.townHallLevel}
              </div>
              <p className="text-xs text-gray-400">Town Hall</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {player.role && (
              <div className="bg-gray-700 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">Role</p>
                <p className="text-lg font-semibold capitalize">{player.role}</p>
              </div>
            )}
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Trophies</p>
              <p className="text-lg font-semibold">{player.trophies.toLocaleString()}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Donations</p>
              <p className="text-lg font-semibold text-green-400">{donations}</p>
            </div>
          </div>
        </div>

        {/* League */}
        {(player.rankedLeague || player.league) && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">League</h2>
            <div className="flex items-center gap-4">
              {player.rankedLeague?.name && (
                <div className="bg-gray-700 rounded p-4 flex-1">
                  <p className="text-xs text-gray-400 mb-1">⚔️ Ranked League</p>
                  <p className="text-lg font-semibold">{player.rankedLeague.name}</p>
                </div>
              )}
              {player.league?.name && (
                <div className="bg-gray-700 rounded p-4 flex-1">
                  <p className="text-xs text-gray-400 mb-1">Trophy League</p>
                  <p className="text-lg font-semibold">{player.league.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Donations */}
        {(donations > 0 || donationsReceived > 0) && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Donations</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700 rounded p-4">
                <p className="text-xs text-gray-400 mb-1">Given</p>
                <p className="text-2xl font-bold text-green-400">{donations}</p>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <p className="text-xs text-gray-400 mb-1">Received</p>
                <p className="text-2xl font-bold text-blue-400">{donationsReceived}</p>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <p className="text-xs text-gray-400 mb-1">Balance</p>
                <p className={`text-2xl font-bold ${
                  donationBalance > 0 ? 'text-green-400' : 
                  donationBalance < 0 ? 'text-red-400' : 
                  'text-gray-400'
                }`}>
                  {donationBalance > 0 ? '+' : ''}{donationBalance}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Heroes */}
        {heroes.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Heroes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {heroes.map((hero) => (
                <div key={hero.name} className="bg-gray-700 rounded p-4 text-center">
                  <p className="text-sm text-gray-400 mb-2">{hero.name}</p>
                  <p className="text-3xl font-bold">{hero.level}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
