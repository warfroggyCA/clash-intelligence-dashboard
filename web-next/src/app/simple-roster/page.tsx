/**
 * SIMPLE ROSTER TABLE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 * Wrapped in DashboardLayout for consistent look and feel
 */

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TownHallBadge, LeagueBadge } from '@/components/ui';
import { getRoleBadgeVariant } from '@/lib/leadership';

// Lazy load DashboardLayout to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

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
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-clash-gold mb-2">Clan Roster</h1>
              <p className="text-sm text-brand-text-secondary">
                {roster.members.length} members · Updated {new Date(roster.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Roster Table - Desktop */}
        <div className="hidden md:block rounded-xl border border-brand-border bg-brand-surface shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-surface-secondary border-b border-brand-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">TH</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Trophies</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Donated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Received</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">League</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {roster.members.map((player, index) => {
                  const roleBadgeVariant = getRoleBadgeVariant(player.role);
                  return (
                    <tr 
                      key={player.tag} 
                      className="hover:bg-brand-surface-hover transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <Link 
                          href={`/simple-player/${player.tag.replace('#', '')}`}
                          className="text-brand-accent hover:text-brand-accent-hover font-medium hover:underline transition-colors"
                        >
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <TownHallBadge level={player.townHallLevel} size="sm" showLevel={true} showBox={false} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          player.role === 'leader' 
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                            : player.role === 'coLeader'
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : player.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {player.role === 'leader' ? 'Leader' : player.role === 'coLeader' ? 'Co-Leader' : player.role === 'admin' ? 'Elder' : 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-brand-text-primary font-medium">
                          {player.trophies.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-green-600 font-medium">
                          {player.donations}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-blue-600 font-medium">
                          {player.donationsReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          {player.rankedLeagueName ? (
                            <LeagueBadge 
                              league={player.rankedLeagueName} 
                              trophies={player.trophies}
                              size="sm" 
                              showText={false}
                            />
                          ) : (
                            <span className="text-xs text-brand-text-tertiary">Unranked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
