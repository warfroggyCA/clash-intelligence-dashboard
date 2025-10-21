/**
 * SIMPLE ROSTER TABLE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 * Wrapped in DashboardLayout for consistent look and feel
 */

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { TownHallBadge, LeagueBadge } from '@/components/ui';
import { getRoleBadgeVariant } from '@/lib/leadership';
import { calculateRushPercentage, getMemberActivity, getTownHallLevel, getHeroCaps } from '@/lib/business/calculations';
import { cfg } from '@/lib/config';
import LeadershipGuard from '@/components/LeadershipGuard';
import type { Member } from '@/types';
import RosterPlayerNotesModal from '@/components/leadership/RosterPlayerNotesModal';
import RosterPlayerTenureModal from '@/components/leadership/RosterPlayerTenureModal';
import RosterPlayerDepartureModal from '@/components/leadership/RosterPlayerDepartureModal';
import { normalizeTag } from '@/lib/tags';

// Lazy load DashboardLayout to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

// Actions Menu Component
interface ActionsMenuProps {
  player: RosterMember;
  onViewProfile: (e: React.MouseEvent, player: RosterMember) => void;
  onCopyTag: (e: React.MouseEvent, player: RosterMember) => void;
  onManageNotes: (e: React.MouseEvent, player: RosterMember) => void;
  onDeparture: (e: React.MouseEvent, player: RosterMember) => void;
  onGrantTenure: (e: React.MouseEvent, player: RosterMember) => void;
  onEditTenure: (e: React.MouseEvent, player: RosterMember) => void;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({
  player,
  onViewProfile,
  onCopyTag,
  onManageNotes,
  onDeparture,
  onGrantTenure,
  onEditTenure,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-brand-text-tertiary hover:text-brand-text-primary hover:bg-brand-surface-hover rounded transition-colors"
        title="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-brand-surface-primary border border-brand-border rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={(e) => {
                onViewProfile(e, player);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
            >
              View Profile
            </button>
            <button
              onClick={(e) => {
                onCopyTag(e, player);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
            >
              Copy Tag
            </button>
            
            <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
              <button
                onClick={(e) => {
                  onManageNotes(e, player);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
              >
                Manage Notes
              </button>
              <button
                onClick={(e) => {
                  onDeparture(e, player);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
              >
                Record Departure
              </button>
              <button
                onClick={(e) => {
                  onGrantTenure(e, player);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
              >
                Grant Tenure
              </button>
              <button
                onClick={(e) => {
                  onEditTenure(e, player);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors"
              >
                Edit Tenure
              </button>
            </LeadershipGuard>
          </div>
        </div>
      )}
    </div>
  );
};

interface RosterMember extends Member {
  tag: string;
  name: string;
  townHallLevel: number;
  role: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  lastWeekTrophies?: number;
  tenureDays?: number | null; // Mapped from API tenureDays field
  tenureAsOf?: string | null;
}

interface RosterData {
  members: RosterMember[];
  clanName: string;
  date: string;
  clanTag: string;
}

type SortKey = 'name' | 'th' | 'role' | 'league' | 'trophies' | 'lastWeek' | 'season' | 'tenure' | 'rush' | 'bk' | 'aq' | 'gw' | 'rc' | 'mp' | 'activity' | 'donations' | 'received';
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
  type ActionModalState =
    | { kind: 'notes'; player: RosterMember }
    | { kind: 'departure'; player: RosterMember }
    | { kind: 'tenure'; player: RosterMember; action: 'granted' | 'revoked' };
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);

  // Sorting function
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Action handlers
  const handleViewProfile = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/player/${player.tag.replace('#', '')}`, '_blank');
  };

  const handleCopyTag = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(player.tag);
    // You could add a toast notification here
  };

  const handleManageNotes = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    setActionModal({ kind: 'notes', player });
  };

  const handleDeparture = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    setActionModal({ kind: 'departure', player });
  };

  const handleGrantTenure = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    setActionModal({ kind: 'tenure', player, action: 'granted' });
  };

  const handleEditTenure = (e: React.MouseEvent, player: RosterMember) => {
    e.preventDefault();
    e.stopPropagation();
    setActionModal({ kind: 'tenure', player, action: 'revoked' });
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
          // The Infallible Three-Tiered Sorting Logic
          // Tier 1: Competitive Eligibility (Primary Filter)
          // Players with rankedLeagueId !== 105000000 are seeded in competitive system
          const aCompetitiveFlag = (a.rankedLeagueId && a.rankedLeagueId !== 105000000) ? 1 : 0;
          const bCompetitiveFlag = (b.rankedLeagueId && b.rankedLeagueId !== 105000000) ? 1 : 0;
          
          // Primary sort: Competitive players first (descending)
          if (aCompetitiveFlag !== bCompetitiveFlag) {
            comparison = aCompetitiveFlag - bCompetitiveFlag; // 1 comes before 0 (descending)
          } else if (aCompetitiveFlag === 1) {
            // Tier 2: Both are competitive - sort by league tier ID (descending)
            const aLeagueTier = a.rankedLeagueId || 0;
            const bLeagueTier = b.rankedLeagueId || 0;
            comparison = aLeagueTier - bLeagueTier; // Higher ID = higher tier
            
            // Tier 2b: If same league, sort by last week trophies (descending)
            if (comparison === 0) {
              comparison = (a.lastWeekTrophies ?? 0) - (b.lastWeekTrophies ?? 0);
            }
          } else {
            // Tier 3: Both are unranked - sort by legacy trophies (descending)
            comparison = a.trophies - b.trophies;
          }
          break;
        case 'trophies':
          comparison = a.trophies - b.trophies;
          break;
        case 'lastWeek':
          comparison = (a.lastWeekTrophies ?? 0) - (b.lastWeekTrophies ?? 0);
          break;
        case 'season':
          comparison = (a.seasonTotalTrophies ?? 0) - (b.seasonTotalTrophies ?? 0);
          break;
        case 'tenure':
          comparison = (a.tenureDays ?? 0) - (b.tenureDays ?? 0);
          break;
        case 'rush':
          comparison = calculateRushPercentage(a) - calculateRushPercentage(b);
          break;
        case 'bk':
          comparison = (a.bk || 0) - (b.bk || 0);
          break;
        case 'aq':
          comparison = (a.aq || 0) - (b.aq || 0);
          break;
        case 'gw':
          comparison = (a.gw || 0) - (b.gw || 0);
          break;
        case 'rc':
          comparison = (a.rc || 0) - (b.rc || 0);
          break;
        case 'mp':
          comparison = (a.mp || 0) - (b.mp || 0);
          break;
        case 'activity':
          const aActivity = getMemberActivity(a).score;
          const bActivity = getMemberActivity(b).score;
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
              lastWeekTrophies: m.lastWeekTrophies,
              donations: m.donations,
              donationsReceived: m.donationsReceived,
              rankedLeagueId: m.rankedLeagueId,
              rankedTrophies: m.rankedTrophies,
              // Show league badge only if player is seeded in ranked system
              // rankedLeagueId === 105000000 means truly unranked (not registered)
              // rankedLeagueId !== 105000000 means seeded in new 34-tier competitive system
              rankedLeagueName: (m.rankedLeagueId && m.rankedLeagueId !== 105000000) 
                ? m.rankedLeagueName 
                : null,
              // Hero levels for rush calculation
              bk: m.bk,
              aq: m.aq,
              gw: m.gw,
              rc: m.rc,
              mp: m.mp,
              seasonTotalTrophies: m.seasonTotalTrophies ?? null,
              activity: m.activity ?? null,
              tenureDays: m.tenureDays ?? null,
              tenureAsOf: m.tenureAsOf ?? null,
              tenure_as_of: m.tenure_as_of ?? null,
            })),
            clanName: apiData.data.clan.name,
            clanTag: apiData.data.clan.tag,
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

  const clanTag = roster?.clanTag ?? cfg.homeClanTag ?? '#UNKNOWN';

  return (
    <>
      <DashboardLayout clanName={roster.clanName}>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-clash-gold mb-2">Clan Roster</h1>
              <p className="text-sm text-brand-text-secondary">
                {roster.members.length} members · Updated {(() => {
                  if (!roster.date) return 'Unknown';
                  const date = new Date(roster.date);
                  return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Roster Table - Desktop */}
        <div className="hidden md:block rounded-xl border border-brand-border bg-brand-surface shadow-lg overflow-visible w-full">
          <div className="overflow-visible">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-surface-secondary border-b border-brand-border">
                  <th 
                    onClick={() => handleSort('name')}
                    title="Player name - Click to sort"
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Player {sortKey === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('role')}
                    title="Clan role: Leader > Co-Leader > Elder > Member - Click to sort"
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Role {sortKey === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('th')}
                    title="Town Hall level - Higher TH unlocks more troops, defenses, and heroes - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    TH {sortKey === 'th' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('league')}
                    title="Ranked battle league - Shows current competitive tier based on trophy count - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    League {sortKey === 'league' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('trophies')}
                    title="Current trophy count from multiplayer battles - Higher trophies = harder opponents - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Trophies {sortKey === 'trophies' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                <th 
                  onClick={() => handleSort('lastWeek')}
                  title="Last week's final trophy count (Monday 4:30 AM UTC snapshot before Tuesday reset) - Shows previous week's competitive performance - Click to sort"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                >
                  Last Week {sortKey === 'lastWeek' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('season')}
                  title="Cumulative trophy total via Monday finals since season start"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                >
                  Running Total {sortKey === 'season' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('tenure')}
                  title="Days since joining the clan - Click to sort"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                >
                  Tenure (days) {sortKey === 'tenure' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('rush')}
                    title="Rush % - Heroes below max for current TH level. Lower is better (0% = maxed) - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Rush % {sortKey === 'rush' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('bk')}
                    title="Barbarian King level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    BK {sortKey === 'bk' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('aq')}
                    title="Archer Queen level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    AQ {sortKey === 'aq' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('gw')}
                    title="Grand Warden level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    GW {sortKey === 'gw' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('rc')}
                    title="Royal Champion level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    RC {sortKey === 'rc' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('mp')}
                    title="Minion Prince level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    MP {sortKey === 'mp' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('activity')}
                    title="Activity level based on: ranked battles (20 pts), donations (15 pts), hero progress (10 pts), role (10 pts), trophies (10 pts) - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Activity {sortKey === 'activity' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('donations')}
                    title="Troops donated to clan members this season - Higher is better - Click to sort"
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Donated {sortKey === 'donations' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('received')}
                    title="Troops received from clan members this season - Compare with donated to see balance - Click to sort"
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
                  >
                    Received {sortKey === 'received' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {sortedMembers.map((player, index) => {
                  const roleBadgeVariant = getRoleBadgeVariant(player.role);
                  const rushPercent = calculateRushPercentage(player);
                  const activity = getMemberActivity(player);
                  const maxHeroes = getHeroCaps(player.townHallLevel);
                  
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

Heroes: BK ${player.bk || 0}, AQ ${player.aq || 0}, GW ${player.gw || 0}, RC ${player.rc || 0}, MP ${player.mp || 0}

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
                          href={`/player/${player.tag.replace('#', '')}`}
                          className="text-white hover:text-slate-200 hover:underline transition-colors"
                          style={{ fontFamily: "'Clash Display', sans-serif" }}
                        >
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          title={roleTooltip}
                          className="text-sm text-brand-text-secondary cursor-help"
                        >
                          {player.role === 'leader' ? 'Leader' : player.role === 'coLeader' ? 'Co-Leader' : player.role === 'admin' ? 'Elder' : 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center" title={`Town Hall ${player.townHallLevel}`}>
                          <TownHallBadge
                            level={player.townHallLevel}
                            size="sm"
                            showLevel
                            showBox={false}
                            levelBadgeClassName="rounded-full border-0 bg-slate-950/95 px-1.5 text-sm font-bold text-brand-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                          />
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
                            <span title={leagueTooltip} className="text-xs text-brand-text-tertiary cursor-help">Inactive</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <div 
                            title={`Current trophy count: ${player.trophies.toLocaleString()}`}
                            className="relative cursor-help" 
                            style={{ width: '40px', height: '40px' }}
                          >
                            <Image 
                              src="/assets/clash/trophy.png"
                              alt="Trophy"
                              width={40}
                              height={40}
                              className="w-full h-full object-contain"
                            />
                            <span 
                              className="absolute bottom-0 right-0 text-white font-bold text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)' }}
                            >
                              {player.trophies.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {player.lastWeekTrophies !== null && player.lastWeekTrophies !== undefined ? (
                          <span 
                            title={`Last week's final trophy count: ${player.lastWeekTrophies.toLocaleString()}`}
                            className="font-mono text-sm font-semibold text-brand-text-secondary cursor-help"
                          >
                            {player.lastWeekTrophies.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {player.seasonTotalTrophies !== null && player.seasonTotalTrophies !== undefined ? (
                          <span 
                            title={`Running total trophies (sum of weekly finals): ${player.seasonTotalTrophies.toLocaleString()}`}
                            className="font-mono text-sm font-semibold text-brand-text-secondary cursor-help"
                          >
                            {player.seasonTotalTrophies.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {player.tenureDays !== null && player.tenureDays !== undefined ? (
                          <span 
                            title={`Tenure: ${player.tenureDays} days since joining`}
                            className="font-mono text-sm font-semibold text-brand-text-secondary cursor-help"
                          >
                            {player.tenureDays}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={rushTooltip}
                          className={`font-mono text-sm font-semibold cursor-help ${rushColor}`}
                        >
                          {rushPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={`Barbarian King: ${player.bk || 0}/${maxHeroes.bk || 0}\n${(maxHeroes.bk || 0) > 0 ? `Progress: ${Math.round(((player.bk || 0) / (maxHeroes.bk || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.bk || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={`Archer Queen: ${player.aq || 0}/${maxHeroes.aq || 0}\n${(maxHeroes.aq || 0) > 0 ? `Progress: ${Math.round(((player.aq || 0) / (maxHeroes.aq || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.aq || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={`Grand Warden: ${player.gw || 0}/${maxHeroes.gw || 0}\n${(maxHeroes.gw || 0) > 0 ? `Progress: ${Math.round(((player.gw || 0) / (maxHeroes.gw || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.gw || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={`Royal Champion: ${player.rc || 0}/${maxHeroes.rc || 0}\n${(maxHeroes.rc || 0) > 0 ? `Progress: ${Math.round(((player.rc || 0) / (maxHeroes.rc || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.rc || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={`Minion Prince: ${player.mp || 0}/${maxHeroes.mp || 0}\n${(maxHeroes.mp || 0) > 0 ? `Progress: ${Math.round(((player.mp || 0) / (maxHeroes.mp || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.mp || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          title={activityTooltip}
                          className="text-sm text-brand-text-secondary cursor-help"
                        >
                          {activity.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-green-600 font-medium cursor-help"
                        >
                          {player.donations === 0 ? '—' : player.donations}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-blue-600 font-medium cursor-help"
                        >
                          {player.donationsReceived === 0 ? '—' : player.donationsReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ActionsMenu 
                          player={player}
                          onViewProfile={handleViewProfile}
                          onCopyTag={handleCopyTag}
                          onManageNotes={handleManageNotes}
                          onDeparture={handleDeparture}
                          onGrantTenure={handleGrantTenure}
                          onEditTenure={handleEditTenure}
                        />
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
            const activity = getMemberActivity(player);
            const maxHeroes = getHeroCaps(player.townHallLevel);
            
            const rushColor = rushPercent >= 70 ? 'text-red-600' : 
                             rushPercent >= 40 ? 'text-yellow-600' : 
                             'text-green-600';
            
            const activityColor = activity.level === 'Very Active' ? 'bg-green-100 text-green-800 border-green-200' :
                                 activity.level === 'Active' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                 activity.level === 'Moderate' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                 activity.level === 'Low' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                 'bg-red-100 text-red-800 border-red-200';
            
            // Mobile tooltips (same as desktop)
            const activityTooltip = `Activity Score: ${activity.score}/65 pts
• ${activity.indicators.join('\n• ')}

Scoring:
• Ranked battles (0-20 pts)
• Donations (0-15 pts)
• Hero development (0-10 pts)
• Leadership role (0-10 pts)
• Trophy level (0-10 pts)`;

            const rushTooltip = `Rush: ${rushPercent}%
Heroes are ${rushPercent}% below max for TH${player.townHallLevel}.

Heroes: BK ${player.bk || 0}, AQ ${player.aq || 0}, GW ${player.gw || 0}, RC ${player.rc || 0}, MP ${player.mp || 0}

Lower is better (0% = maxed)`;

            const leagueTooltip = player.rankedLeagueName 
              ? `${player.rankedLeagueName}
${player.trophies} trophies

Actively participating in ranked battles this season.`
              : `Not participating in ranked battles
Player is enrolled but hasn't earned trophies yet this season.`;

            const roleTooltip = player.role === 'leader' 
              ? 'Clan Leader - Full clan management permissions'
              : player.role === 'coLeader'
              ? 'Co-Leader - Can invite, promote, and manage wars'
              : player.role === 'admin'
              ? 'Elder - Can invite and donate to clan members'
              : 'Member - Standard clan member';

            const donationBalance = player.donationsReceived - player.donations;
            const donationTooltip = `Donated: ${player.donations}
Received: ${player.donationsReceived}
Balance: ${donationBalance > 0 ? '+' : ''}${donationBalance}

${donationBalance > 0 ? 'Receives more than gives' : donationBalance < 0 ? 'Gives more than receives' : 'Balanced donations'}`;
            
            return (
            <div
              key={player.tag}
              className="rounded-lg border border-brand-border bg-brand-surface shadow-sm p-3"
            >
              {/* Clean Header Layout */}
              <div className="flex items-start gap-3 mb-3">
                {/* Left: Name, Role, Badges */}
                <div className="flex-1 min-w-0">
                  {/* Name with Role */}
                  <div className="flex items-baseline gap-1.5 mb-2 flex-wrap">
                      <Link
                        href={`/player/${player.tag.replace('#', '')}`}
                        className="text-base font-bold text-white hover:text-slate-200 hover:underline truncate leading-tight"
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                      {player.name}
                    </Link>
                    <span className="text-sm text-brand-text-tertiary leading-tight">•</span>
                    <span 
                      title={roleTooltip}
                      className="text-sm text-brand-text-tertiary cursor-help leading-tight"
                    >
                      {player.role === 'leader' ? 'Leader' : player.role === 'coLeader' ? 'Co-Leader' : player.role === 'admin' ? 'Elder' : 'Member'}
                    </span>
                  </div>
                  
                  {/* Trophy, TH & League Badges - Same Size */}
                  <div className="flex items-center gap-2">
                    <div 
                      title={`Current trophy count: ${player.trophies.toLocaleString()}`}
                      className="relative cursor-help" 
                      style={{ width: '48px', height: '48px' }}
                    >
                      <Image 
                        src="/assets/clash/trophy.png"
                        alt="Trophy"
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                      />
                      <span 
                        className="absolute bottom-0 right-0 text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)' }}
                      >
                        {player.trophies >= 1000 ? `${(player.trophies / 1000).toFixed(1)}k` : player.trophies}
                      </span>
                    </div>
                    <div title={`Town Hall ${player.townHallLevel}`} className="relative cursor-help" style={{ width: '48px', height: '48px' }}>
                      <Image 
                        src={`/assets/clash/Townhalls/TH${player.townHallLevel}.png`}
                        alt={`TH${player.townHallLevel}`}
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '🏰';
                        }}
                      />
                      <span 
                        className="absolute bottom-0 right-0 text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)' }}
                      >
                        {player.townHallLevel}
                      </span>
                    </div>
                    {player.rankedLeagueName && (
                      <div title={leagueTooltip} className="cursor-help">
                        <LeagueBadge 
                          league={player.rankedLeagueName} 
                          trophies={player.trophies}
                          size="sm" 
                          showText={false}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: All Stats Organized */}
                <div className="flex-shrink-0 text-xs space-y-2">
                  {/* Rush */}
                  <div className="flex items-center gap-2">
                    <div title={rushTooltip} className="cursor-help text-right">
                      <div className="text-brand-text-tertiary text-[10px]">Rush</div>
                      <div className={`font-mono font-semibold ${rushColor}`}>{rushPercent}%</div>
                    </div>
                  </div>

                  {/* Activity */}
                  <div title={activityTooltip} className="cursor-help text-right">
                    <div className="text-brand-text-tertiary text-[10px]">Activity</div>
                    <div className="text-sm text-brand-text-secondary font-medium">
                      {activity.level}
                    </div>
                  </div>

                  {/* Donations */}
                  <div title={donationTooltip} className="cursor-help text-right pt-1 border-t border-brand-border/30">
                    <div className="text-brand-text-tertiary text-[10px]">Don: <span className="font-mono text-green-600 font-semibold">{player.donations === 0 ? '—' : player.donations}</span></div>
                    <div className="text-brand-text-tertiary text-[10px]">Rec: <span className="font-mono text-blue-600 font-semibold">{player.donationsReceived === 0 ? '—' : player.donationsReceived}</span></div>
                    <div className="text-brand-text-tertiary text-[10px]">Bal: <span className={`font-mono font-semibold ${donationBalance > 0 ? 'text-red-600' : donationBalance < 0 ? 'text-green-600' : 'text-brand-text-tertiary'}`}>
                      {donationBalance > 0 ? '+' : ''}{donationBalance}
                    </span></div>
                  </div>
                </div>
              </div>

              {/* Heroes Row - Bottom */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-brand-border/30">
                <div 
                  title={`Barbarian King: ${player.bk || 0}/${maxHeroes.bk || 0}\n${(maxHeroes.bk || 0) > 0 ? `Progress: ${Math.round(((player.bk || 0) / (maxHeroes.bk || 1)) * 100)}%` : 'Not available at this TH'}`}
                  className="flex flex-col items-center cursor-help"
                >
                  <span className="text-brand-text-tertiary text-[10px]">BK</span>
                  <span className="font-mono font-semibold text-brand-text-primary">{player.bk || '-'}</span>
                </div>
                <div 
                  title={`Archer Queen: ${player.aq || 0}/${maxHeroes.aq || 0}\n${(maxHeroes.aq || 0) > 0 ? `Progress: ${Math.round(((player.aq || 0) / (maxHeroes.aq || 1)) * 100)}%` : 'Not available at this TH'}`}
                  className="flex flex-col items-center cursor-help"
                >
                  <span className="text-brand-text-tertiary text-[10px]">AQ</span>
                  <span className="font-mono font-semibold text-brand-text-primary">{player.aq || '-'}</span>
                </div>
                <div 
                  title={`Grand Warden: ${player.gw || 0}/${maxHeroes.gw || 0}\n${(maxHeroes.gw || 0) > 0 ? `Progress: ${Math.round(((player.gw || 0) / (maxHeroes.gw || 1)) * 100)}%` : 'Not available at this TH'}`}
                  className="flex flex-col items-center cursor-help"
                >
                  <span className="text-brand-text-tertiary text-[10px]">GW</span>
                  <span className="font-mono font-semibold text-brand-text-primary">{player.gw || '-'}</span>
                </div>
                <div 
                  title={`Royal Champion: ${player.rc || 0}/${maxHeroes.rc || 0}\n${(maxHeroes.rc || 0) > 0 ? `Progress: ${Math.round(((player.rc || 0) / (maxHeroes.rc || 1)) * 100)}%` : 'Not available at this TH'}`}
                  className="flex flex-col items-center cursor-help"
                >
                  <span className="text-brand-text-tertiary text-[10px]">RC</span>
                  <span className="font-mono font-semibold text-brand-text-primary">{player.rc || '-'}</span>
                </div>
                <div 
                  title={`Minion Prince: ${player.mp || 0}/${maxHeroes.mp || 0}\n${(maxHeroes.mp || 0) > 0 ? `Progress: ${Math.round(((player.mp || 0) / (maxHeroes.mp || 1)) * 100)}%` : 'Not available at this TH'}`}
                  className="flex flex-col items-center cursor-help"
                >
                  <span className="text-brand-text-tertiary text-[10px]">MP</span>
                  <span className="font-mono font-semibold text-brand-text-primary">{player.mp || '-'}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>

      {actionModal?.kind === 'notes' && (
        <RosterPlayerNotesModal
          clanTag={clanTag}
          playerTag={actionModal.player.tag}
          playerName={actionModal.player.name}
          onClose={() => setActionModal(null)}
        />
      )}

      {actionModal?.kind === 'departure' && (
        <RosterPlayerDepartureModal
          clanTag={clanTag}
          playerTag={actionModal.player.tag}
          playerName={actionModal.player.name}
          onClose={() => setActionModal(null)}
          onSuccess={() => setActionModal(null)}
        />
      )}

      {actionModal?.kind === 'tenure' && (
        <RosterPlayerTenureModal
          clanTag={clanTag}
          playerTag={actionModal.player.tag}
          playerName={actionModal.player.name}
          defaultAction={actionModal.action}
          onClose={() => setActionModal(null)}
          onSuccess={(result) => {
            if (result) {
              setRoster((prev) => {
                if (!prev) return prev;
                const targetTag = normalizeTag(actionModal.player.tag);
                const members = prev.members.map((member) =>
                  normalizeTag(member.tag) === targetTag
                    ? {
                        ...member,
                        tenureDays: result.tenureDays,
                        tenureAsOf: result.asOf,
                        tenure_as_of: result.asOf,
                      }
                    : member
                );
                return { ...prev, members };
              });
            }
            setActionModal(null);
          }}
        />
      )}
    </>
  );
}
