/**
 * SIMPLE PLAYER PROFILE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 * Wrapped in DashboardLayout for consistent look and feel
 */

"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Lazy load DashboardLayout to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

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
        console.log('[SimplePlayer] Fetching player data from /api/v2/player/', tag);
        const response = await fetch(`/api/v2/player/${tag}`);
        
        console.log('[SimplePlayer] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[SimplePlayer] Error response:', errorText);
          throw new Error(`Failed to load player: ${response.status} - ${errorText.substring(0, 100)}`);
        }
        
        const apiData = await response.json();
        console.log('[SimplePlayer] API data:', {
          success: apiData.success,
          hasData: !!apiData.data,
          playerName: apiData.data?.name
        });
        
        if (apiData.success && apiData.data) {
          setPlayer(apiData.data);
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        console.error('[SimplePlayer] Load error:', err);
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
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button 
          onClick={() => router.back()}
          className="mb-6 px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
        >
          <span>←</span> Back to Roster
        </button>

        {/* Player Header */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-2xl p-8 mb-6 border border-blue-500/20 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg text-3xl">
                👤
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {player.name}
                </h1>
                <p className="text-blue-300 font-mono text-lg">{player.tag}</p>
                {player.clan?.name && (
                  <p className="text-gray-300 flex items-center gap-2 mt-1">
                    <span className="text-xl">🏰</span>
                    {player.clan.name}
                  </p>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl text-3xl font-bold mb-2 shadow-lg">
                {player.townHallLevel}
              </div>
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Town Hall</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {player.role && (
              <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Role</p>
                <p className="text-xl font-bold capitalize text-yellow-400">{player.role}</p>
              </div>
            )}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">🏆 Trophies</p>
              <p className="text-xl font-bold text-yellow-400">{player.trophies.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">📤 Donations</p>
              <p className="text-xl font-bold text-green-400">{donations}</p>
            </div>
          </div>
        </div>

        {/* League */}
        {(player.rankedLeague || player.league) && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-700/50 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <span className="text-2xl">🎖️</span>
              League
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {player.rankedLeague?.name && (
                <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-xl p-6 border border-red-500/30">
                  <p className="text-sm text-red-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span>⚔️</span> Ranked League
                  </p>
                  <p className="text-2xl font-bold text-red-200">{player.rankedLeague.name}</p>
                </div>
              )}
              {player.league?.name && (
                <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-xl p-6 border border-blue-500/30">
                  <p className="text-sm text-blue-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span>🏆</span> Trophy League
                  </p>
                  <p className="text-2xl font-bold text-blue-200">{player.league.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Donations */}
        {(donations > 0 || donationsReceived > 0) && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-700/50 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <span className="text-2xl">🎁</span>
              Donations
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-xl p-6 border border-green-500/30">
                <p className="text-sm text-green-300 mb-2 uppercase tracking-wider">📤 Given</p>
                <p className="text-4xl font-bold text-green-400">{donations}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-xl p-6 border border-blue-500/30">
                <p className="text-sm text-blue-300 mb-2 uppercase tracking-wider">📥 Received</p>
                <p className="text-4xl font-bold text-blue-400">{donationsReceived}</p>
              </div>
              <div className={`rounded-xl p-6 border ${
                donationBalance > 0 
                  ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30' 
                  : donationBalance < 0
                  ? 'bg-gradient-to-br from-red-900/40 to-rose-900/40 border-red-500/30'
                  : 'bg-gradient-to-br from-gray-900/40 to-slate-900/40 border-gray-500/30'
              }`}>
                <p className="text-sm text-gray-300 mb-2 uppercase tracking-wider">⚖️ Balance</p>
                <p className={`text-4xl font-bold ${
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
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <span className="text-2xl">⚔️</span>
              Heroes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {heroes.map((hero) => (
                <div key={hero.name} className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-6 text-center border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200">
                  <p className="text-sm text-purple-300 mb-3 font-semibold">{hero.name}</p>
                  <p className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    {hero.level}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
