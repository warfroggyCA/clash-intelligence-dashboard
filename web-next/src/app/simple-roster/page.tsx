/**
 * SIMPLE ROSTER TABLE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 * Wrapped in DashboardLayout for consistent look and feel
 */

"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TownHallBadge, LeagueBadge } from '@/components/ui';
import { getRoleBadgeVariant } from '@/lib/leadership';
import { calculateRushPercentage, calculateActivityScore, getTownHallLevel } from '@/lib/business/calculations';

// Lazy load DashboardLayout to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

interface RosterMember {
  tag: string;
  name: string;
  townHallLevel: number;
  role: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  rankedLeagueName?: string;
  rankedLeagueId?: number;
  rankedTrophies?: number | null;
  bk?: number;
  aq?: number;
  gw?: number;
  rc?: number;
  mp?: number;
}

interface RosterData {
  members: RosterMember[];
  clanName: string;
  date: string;
}

type SortKey = 'name' | 'th' | 'role' | 'league' | 'trophies' | 'rush' | 'activity' | 'donations' | 'received';
type SortDirection = 'asc' | 'desc';

// League tier ranking for sorting (highest to lowest)
// Based on Clash of Clans ranked league hierarchy
const LEAGUE_TIERS: Record<string, number> = {
  'Legend League': 12,
  'Titan League': 11,
  'Electro League': 10,
  'Dragon League': 9,
  'PEKKA League': 8,
  'Golem League': 7,
  'Witch League': 6,        // Witch is higher than Valkyrie
  'Valkyrie League': 5,
  'Wizard League': 4,
  'Archer League': 3,
  'Barbarian League': 2,
  'Skeleton League': 1,
};

const getLeagueTier = (leagueName?: string): number => {
  if (!leagueName) return 0;
  // Extract base league name (e.g., "Electro League 33" -> "Electro League")
  const baseName = leagueName.split(' ').slice(0, 2).join(' ');
  return LEAGUE_TIERS[baseName] || 0;
};

export default function SimpleRosterPage() {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('league');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sorting function
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Sorted members with memoization
  const sortedMembers = useMemo(() => {
    if (!roster) return [];
    
    const members = [...roster.members];
    
    members.sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'th':
          comparison = a.townHallLevel - b.townHallLevel;
          break;
        case 'role':
          const roleOrder = { leader: 4, coLeader: 3, admin: 2, member: 1 };
          comparison = (roleOrder[a.role as keyof typeof roleOrder] || 0) - 
                      (roleOrder[b.role as keyof typeof roleOrder] || 0);
          break;
        case 'league':
          // Primary: League tier, Secondary: Trophy count
          const aTier = getLeagueTier(a.rankedLeagueName);
          const bTier = getLeagueTier(b.rankedLeagueName);
          
          // If one has league and other doesn't, ranked goes first
          if (aTier > 0 && bTier === 0) {
            comparison = 1; // a has league, goes first (higher value)
          } else if (aTier === 0 && bTier > 0) {
            comparison = -1; // b has league, goes first
          } else if (aTier !== bTier) {
            // Both have leagues, compare tiers
            comparison = aTier - bTier;
          } else if (aTier > 0) {
            // Same tier, compare trophies
            comparison = a.trophies - b.trophies;
          } else {
            // Both unranked, sort by trophies
            comparison = a.trophies - b.trophies;
          }
          break;
        case 'trophies':
          comparison = a.trophies - b.trophies;
          break;
        case 'rush':
          comparison = calculateRushPercentage(a) - calculateRushPercentage(b);
          break;
        case 'activity':
          const aActivity = calculateActivityScore(a).score;
          const bActivity = calculateActivityScore(b).score;
          comparison = aActivity - bActivity;
          break;
        case 'donations':
          comparison = a.donations - b.donations;
          break;
        case 'received':
          comparison = a.donationsReceived - b.donationsReceived;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return members;
  }, [roster, sortKey, sortDirection]);

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
              rankedLeagueId: m.rankedLeagueId,
              rankedTrophies: m.rankedTrophies,
              // Only show ranked league badge if:
              // 1. They have a non-Unranked league tier (ID !== 105000000)
              // 2. AND they have trophies > 0 (indicating actual participation)
              rankedLeagueName: (
                m.rankedLeagueId && 
                m.rankedLeagueId !== 105000000 && 
                m.trophies > 0
              ) ? m.rankedLeagueName : null,
              // Hero levels for rush calculation
              bk: m.bk,
              aq: m.aq,
              gw: m.gw,
              rc: m.rc,
              mp: m.mp
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
    <DashboardLayout clanName={roster.clanName}>
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
                  <th 
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Player {sortKey === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('role')}
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Role {sortKey === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('th')}
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    TH {sortKey === 'th' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('league')}
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    League {sortKey === 'league' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('trophies')}
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Trophies {sortKey === 'trophies' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('rush')}
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Rush % {sortKey === 'rush' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('activity')}
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Activity {sortKey === 'activity' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('donations')}
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Donated {sortKey === 'donations' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('received')}
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Received {sortKey === 'received' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {sortedMembers.map((player, index) => {
                  const roleBadgeVariant = getRoleBadgeVariant(player.role);
                  const rushPercent = calculateRushPercentage(player);
                  const activity = calculateActivityScore(player);
                  
                  // Rush color coding
                  const rushColor = rushPercent >= 70 ? 'text-red-600' : 
                                   rushPercent >= 40 ? 'text-yellow-600' : 
                                   'text-green-600';
                  
                  // Activity color coding
                  const activityColor = activity.level === 'Very Active' ? 'bg-green-100 text-green-800 border-green-200' :
                                       activity.level === 'Active' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                       activity.level === 'Moderate' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                       activity.level === 'Low' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                       'bg-red-100 text-red-800 border-red-200';
                  
                  // Build detailed activity tooltip
                  const activityTooltip = `Activity Score: ${activity.score}/65 pts
• ${activity.indicators.join('\n• ')}

Scoring:
• Ranked battles (0-20 pts)
• Donations (0-15 pts)
• Hero development (0-10 pts)
• Leadership role (0-10 pts)
• Trophy level (0-10 pts)`;

                  // Rush percentage tooltip
                  const rushTooltip = `Rush: ${rushPercent}%
Heroes are ${rushPercent}% below max for TH${player.townHallLevel}.

Heroes: BK ${player.bk || 0}, AQ ${player.aq || 0}, GW ${player.gw || 0}, RC ${player.rc || 0}

Lower is better (0% = maxed)`;

                  // League tooltip
                  const leagueTooltip = player.rankedLeagueName 
                    ? `${player.rankedLeagueName}
${player.trophies} trophies

Actively participating in ranked battles this season.`
                    : `Not participating in ranked battles
Player is enrolled but hasn't earned trophies yet this season.`;

                  // Role tooltip
                  const roleTooltip = player.role === 'leader' 
                    ? 'Clan Leader - Full clan management permissions'
                    : player.role === 'coLeader'
                    ? 'Co-Leader - Can invite, promote, and manage wars'
                    : player.role === 'admin'
                    ? 'Elder - Can invite and donate to clan members'
                    : 'Member - Standard clan member';

                  // Donation tooltip
                  const donationBalance = player.donationsReceived - player.donations;
                  const donationTooltip = `Donated: ${player.donations}
Received: ${player.donationsReceived}
Balance: ${donationBalance > 0 ? '+' : ''}${donationBalance}

${donationBalance > 0 ? 'Receives more than gives' : donationBalance < 0 ? 'Gives more than receives' : 'Balanced donations'}`;
                  
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
                      <td className="px-4 py-3">
                        <span 
                          title={roleTooltip}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help ${
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <div title={`Town Hall ${player.townHallLevel}`}>
                            <TownHallBadge level={player.townHallLevel} size="sm" showLevel={true} showBox={false} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          {player.rankedLeagueName ? (
                            <div title={leagueTooltip} className="cursor-help">
                              <LeagueBadge 
                                league={player.rankedLeagueName} 
                                trophies={player.trophies}
                                size="sm" 
                                showText={false}
                              />
                            </div>
                          ) : (
                            <span title={leagueTooltip} className="text-xs text-brand-text-tertiary cursor-help">Unranked</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span 
                          title={`Current trophy count: ${player.trophies.toLocaleString()}`}
                          className="font-mono text-sm text-brand-text-primary font-medium cursor-help"
                        >
                          {player.trophies.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={rushTooltip}
                          className={`font-mono text-sm font-semibold cursor-help ${rushColor}`}
                        >
                          {rushPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span 
                            title={activityTooltip}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-help ${activityColor}`}
                          >
                            {activity.level}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-green-600 font-medium cursor-help"
                        >
                          {player.donations}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-blue-600 font-medium cursor-help"
                        >
                          {player.donationsReceived}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards - Mobile Only */}
        <div className="md:hidden space-y-4">
          {sortedMembers.map((player) => {
            const rushPercent = calculateRushPercentage(player);
            const activity = calculateActivityScore(player);
            
            const rushColor = rushPercent >= 70 ? 'text-red-600' : 
                             rushPercent >= 40 ? 'text-yellow-600' : 
                             'text-green-600';
            
            const activityColor = activity.level === 'Very Active' ? 'bg-green-100 text-green-800 border-green-200' :
                                 activity.level === 'Active' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                 activity.level === 'Moderate' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                 activity.level === 'Low' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                 'bg-red-100 text-red-800 border-red-200';
            
            return (
            <div
              key={player.tag}
              className="rounded-lg border border-brand-border bg-brand-surface shadow-md p-4"
            >
              {/* Player Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <Link
                    href={`/simple-player/${player.tag.replace('#', '')}`}
                    className="text-lg font-semibold text-brand-accent hover:text-brand-accent-hover hover:underline"
                  >
                    {player.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <TownHallBadge level={player.townHallLevel} size="sm" showLevel={true} showBox={false} />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
                  </div>
                </div>
                {player.rankedLeagueName && (
                  <LeagueBadge 
                    league={player.rankedLeagueName} 
                    trophies={player.trophies}
                    size="md" 
                    showText={false}
                  />
                )}
              </div>

              {/* Player Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-brand-text-tertiary text-xs mb-1">Trophies</p>
                  <p className="font-mono font-semibold text-brand-text-primary">{player.trophies.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-brand-text-tertiary text-xs mb-1">Rush %</p>
                  <p className={`font-mono font-semibold ${rushColor}`}>{rushPercent}%</p>
                </div>
                <div>
                  <p className="text-brand-text-tertiary text-xs mb-1">Donated</p>
                  <p className="font-mono font-semibold text-green-600">{player.donations}</p>
                </div>
                <div>
                  <p className="text-brand-text-tertiary text-xs mb-1">Received</p>
                  <p className="font-mono font-semibold text-blue-600">{player.donationsReceived}</p>
                </div>
              </div>

              {/* Activity Badge */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${activityColor}`}>
                  {activity.level}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
