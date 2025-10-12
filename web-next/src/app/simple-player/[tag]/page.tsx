/**
 * SIMPLE PLAYER PROFILE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 */

"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PlayerProfile {
  summary: {
    name: string;
    tag: string;
    role: string;
    clanName: string;
    townHallLevel: number;
    trophies: number;
    rankedLeague?: {
      name: string;
    } | null;
    league?: {
      name: string;
    } | null;
    donationBalance: {
      given: number;
      received: number;
      balance: number;
    };
    rushScore: number;
    activityLevel: string;
  };
  heroes: Array<{
    name: string;
    level: number;
    maxForTH: number;
  }>;
}

export default function SimplePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const tag = params?.tag as string;
  
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
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
        
        const data = await response.json();
        setProfile(data);
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

  if (!profile) {
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

  const { summary, heroes } = profile;

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
              <h1 className="text-4xl font-bold mb-2">{summary.name}</h1>
              <p className="text-gray-400 font-mono">{summary.tag}</p>
              <p className="text-gray-400">{summary.clanName}</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-600 rounded-lg text-2xl font-bold mb-2">
                {summary.townHallLevel}
              </div>
              <p className="text-xs text-gray-400">Town Hall</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Role</p>
              <p className="text-lg font-semibold capitalize">{summary.role}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Trophies</p>
              <p className="text-lg font-semibold">{summary.trophies.toLocaleString()}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Activity</p>
              <p className="text-lg font-semibold">{summary.activityLevel}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Rush Score</p>
              <p className="text-lg font-semibold">{summary.rushScore}%</p>
            </div>
          </div>
        </div>

        {/* League */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">League</h2>
          <div className="flex items-center gap-4">
            {summary.rankedLeague?.name && (
              <div className="bg-gray-700 rounded p-4 flex-1">
                <p className="text-xs text-gray-400 mb-1">⚔️ Ranked League</p>
                <p className="text-lg font-semibold">{summary.rankedLeague.name}</p>
              </div>
            )}
            {summary.league?.name && (
              <div className="bg-gray-700 rounded p-4 flex-1">
                <p className="text-xs text-gray-400 mb-1">Trophy League</p>
                <p className="text-lg font-semibold">{summary.league.name}</p>
              </div>
            )}
            {!summary.rankedLeague?.name && !summary.league?.name && (
              <div className="bg-gray-700 rounded p-4 flex-1">
                <p className="text-gray-400">Unranked</p>
              </div>
            )}
          </div>
        </div>

        {/* Donations */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Donations</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded p-4">
              <p className="text-xs text-gray-400 mb-1">Given</p>
              <p className="text-2xl font-bold text-green-400">{summary.donationBalance.given}</p>
            </div>
            <div className="bg-gray-700 rounded p-4">
              <p className="text-xs text-gray-400 mb-1">Received</p>
              <p className="text-2xl font-bold text-blue-400">{summary.donationBalance.received}</p>
            </div>
            <div className="bg-gray-700 rounded p-4">
              <p className="text-xs text-gray-400 mb-1">Balance</p>
              <p className={`text-2xl font-bold ${
                summary.donationBalance.balance > 0 ? 'text-green-400' : 
                summary.donationBalance.balance < 0 ? 'text-red-400' : 
                'text-gray-400'
              }`}>
                {summary.donationBalance.balance > 0 ? '+' : ''}{summary.donationBalance.balance}
              </p>
            </div>
          </div>
        </div>

        {/* Heroes */}
        {heroes && heroes.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Heroes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {heroes.map((hero) => (
                <div key={hero.name} className="bg-gray-700 rounded p-4 text-center">
                  <p className="text-sm text-gray-400 mb-2">{hero.name}</p>
                  <p className="text-3xl font-bold mb-1">{hero.level}</p>
                  <p className="text-xs text-gray-500">Max: {hero.maxForTH}</p>
                  <div className="mt-2 bg-gray-600 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full"
                      style={{ width: `${(hero.level / hero.maxForTH) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
