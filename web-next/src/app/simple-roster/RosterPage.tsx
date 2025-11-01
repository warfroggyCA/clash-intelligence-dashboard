/**
 * SIMPLE ROSTER TABLE
 * Clean implementation - just fetch and display
 * No complex state management, no Zustand, no infinite loops
 * Wrapped in DashboardLayout for consistent look and feel
 */

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { parseUtcDate, formatUtcDateTime, formatUtcDate } from '@/lib/date-format';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { TownHallBadge, LeagueBadge } from '@/components/ui';
import { getRoleBadgeVariant } from '@/lib/leadership';
import { calculateRushPercentage, getMemberActivity, getTownHallLevel, getHeroCaps } from '@/lib/business/calculations';
import { cfg } from '@/lib/config';
import LeadershipGuard from '@/components/LeadershipGuard';
import RosterPlayerNotesModal from '@/components/leadership/RosterPlayerNotesModal';
import RosterPlayerTenureModal from '@/components/leadership/RosterPlayerTenureModal';
import RosterPlayerDepartureModal from '@/components/leadership/RosterPlayerDepartureModal';
import { normalizeTag } from '@/lib/tags';
import {
  transformRosterApiResponse,
  type RosterData,
  type RosterMember,
  type RosterApiResponse,
} from './roster-transform';
import type { Member } from '@/types';
import {
  handleExportCSV,
  handleExportDiscord,
  handleCopySummary,
} from '@/lib/export/roster-export';
import { showToast } from '@/lib/toast';

// Lazy load DashboardLayout to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

// Helper function to check if a player is a new joiner (joined in last 7 days)
function isNewJoiner(player: RosterMember): boolean {
  if (player.tenureDays === null || player.tenureDays === undefined) return false;
  return player.tenureDays <= 7;
}

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

type SortKey = 'name' | 'th' | 'role' | 'league' | 'trophies' | 'lastWeek' | 'season' | 'tenure' | 'rush' | 'bk' | 'aq' | 'gw' | 'rc' | 'mp' | 'activity' | 'donations' | 'received' | 'vip';
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

interface SimpleRosterPageProps {
  initialRoster?: RosterData | null;
}

export default function SimpleRosterPage({ initialRoster }: SimpleRosterPageProps = {}) {
  const [roster, setRoster] = useState<RosterData | null>(() => initialRoster ?? null);
  const [loading, setLoading] = useState(() => !initialRoster);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('league');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastRefreshRef = useRef<number>(0);
  const staleCheckRef = useRef<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Expose refresh function globally for DashboardLayout
  useEffect(() => {
    (window as any).refreshRosterData = () => {
      console.log('[SimpleRoster] Manual refresh triggered');
      setRefreshTrigger(prev => prev + 1);
    };
    
    return () => {
      delete (window as any).refreshRosterData;
    };
  }, []);

  useEffect(() => {
    if (initialRoster) {
      setRoster(initialRoster);
      setLoading(false);
      setError(null);
    }
  }, [initialRoster]);
  
  type ActionModalState =
    | { kind: 'notes'; player: RosterMember }
    | { kind: 'departure'; player: RosterMember }
    | { kind: 'tenure'; player: RosterMember; action: 'granted' | 'revoked' };
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);

  // Export handlers
  const handleExportCSVClick = async () => {
    if (!roster) {
      showToast('No roster data to export', 'error');
      return;
    }
    setExportMenuOpen(false);
    const success = await handleExportCSV(roster);
    if (success) {
      showToast('CSV exported successfully', 'success');
    } else {
      showToast('Failed to export CSV', 'error');
    }
  };

  const handleExportDiscordClick = async () => {
    if (!roster) {
      showToast('No roster data to export', 'error');
      return;
    }
    setExportMenuOpen(false);
    const success = await handleExportDiscord(roster);
    if (success) {
      showToast('Discord format copied to clipboard', 'success');
    } else {
      showToast('Failed to copy Discord format', 'error');
    }
  };

  const handleCopySummaryClick = async () => {
    if (!roster) {
      showToast('No roster data to export', 'error');
      return;
    }
    setExportMenuOpen(false);
    const success = await handleCopySummary(roster);
    if (success) {
      showToast('Summary copied to clipboard', 'success');
    } else {
      showToast('Failed to copy summary', 'error');
    }
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

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
          comparison = (a.townHallLevel ?? 0) - (b.townHallLevel ?? 0);
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
            comparison = (a.trophies ?? 0) - (b.trophies ?? 0);
          }
          break;
        case 'trophies':
          comparison = (a.trophies ?? 0) - (b.trophies ?? 0);
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
          comparison = calculateRushPercentage(a as Member) - calculateRushPercentage(b as Member);
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
          const aActivity = getMemberActivity(a as Member).score;
          const bActivity = getMemberActivity(b as Member).score;
          comparison = aActivity - bActivity;
          break;
        case 'donations':
          comparison = (a.donations ?? 0) - (b.donations ?? 0);
          break;
        case 'received':
          comparison = (a.donationsReceived ?? 0) - (b.donationsReceived ?? 0);
          break;
        case 'vip':
          const aVip = a.vip?.score ?? 0;
          const bVip = b.vip?.score ?? 0;
          comparison = aVip - bVip;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return members;
  }, [roster, sortKey, sortDirection]);

  useEffect(() => {
    let cancelled = false;
    const shouldFetch = refreshTrigger > 0 || !initialRoster;
    if (!shouldFetch) {
      return () => {
        cancelled = true;
      };
    }

    async function loadRoster() {
      try {
        setLoading(true);
        setError(null);
        console.log('[SimpleRoster] Fetching roster data from /api/v2/roster');
        const response = await fetch('/api/v2/roster', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        console.log('[SimpleRoster] Response status:', response.status);
        console.log('[SimpleRoster] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[SimpleRoster] Error response:', errorText);
          throw new Error(`Failed to load roster: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const apiData = (await response.json()) as RosterApiResponse;
        console.log('[SimpleRoster] API data structure:', {
          success: apiData.success,
          hasData: !!apiData.data,
          hasClan: !!apiData.data?.clan,
          hasMembers: !!apiData.data?.members,
          memberCount: apiData.data?.members?.length,
          dateInfo: apiData.data?.dateInfo
        });

        // Check if data is stale (today > snapshot date)
        const dateInfo = apiData.data?.dateInfo;
        if (dateInfo?.isStale) {
          console.warn('[SimpleRoster] Data is stale:', {
            currentDate: dateInfo.currentDate,
            snapshotDate: dateInfo.snapshotDate,
            isStale: dateInfo.isStale
          });
          // Note: We'll still display the data, but show a warning
          // The cron jobs should have run, but if they didn't, we'll show stale data
        }

        const transformed = transformRosterApiResponse(apiData);
        console.log('[SimpleRoster] Transformed roster:', {
          clanName: transformed.clanName,
          memberCount: transformed.members.length,
          snapshotDate: transformed.snapshotMetadata?.snapshotDate,
          sampleMember: transformed.members[0] ? {
            name: transformed.members[0].name,
            tag: transformed.members[0].tag,
            vip: transformed.members[0].vip
          } : null
        });

        if (!cancelled) {
          setRoster(transformed);
        }
      } catch (err) {
        console.error('[SimpleRoster] Load error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load roster');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, initialRoster]);
  
  // Check for stale data on mount and periodically (with cooldown to prevent infinite loops)
  useEffect(() => {
    if (!roster?.snapshotMetadata?.snapshotDate) return;
    
    const snapshotDate = roster.snapshotMetadata.snapshotDate;
    const today = new Date().toISOString().split('T')[0];
    const snapshotDateOnly = snapshotDate.split('T')[0];
    
    // If data is fresh, reset the stale check flag
    if (today <= snapshotDateOnly) {
      staleCheckRef.current = false;
      return;
    }
    
    const checkStaleData = () => {
      // Prevent checking if we just refreshed (within last 60 seconds)
      const now = Date.now();
      if (now - lastRefreshRef.current < 60000) {
        return;
      }
      
      if (today > snapshotDateOnly && !staleCheckRef.current) {
        console.warn('[SimpleRoster] Data is stale - triggering refresh', {
          today,
          snapshotDate: snapshotDateOnly
        });
        staleCheckRef.current = true; // Mark as checked
        lastRefreshRef.current = now; // Track refresh time
        // Auto-refresh if data is stale
        setRefreshTrigger(prev => prev + 1);
      }
    };
    
    // Only check once per snapshotDate, not on every render
    if (!staleCheckRef.current) {
      checkStaleData();
    }
    
    // Reset stale check flag after 5 minutes to allow re-checking
    const resetInterval = setTimeout(() => {
      staleCheckRef.current = false;
    }, 5 * 60 * 1000);
    
    return () => {
      clearTimeout(resetInterval);
    };
  }, [roster?.snapshotMetadata?.snapshotDate]); // Only depend on snapshotDate, not entire roster

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-clash-gold mb-2">Clan Roster</h1>
              <p 
                className="text-sm text-brand-text-secondary cursor-help break-words"
                title="Member count and snapshot update information. The snapshot date represents when the data was captured (typically daily at 4:30 AM UTC). The 'Updated' timestamp shows when this data was last fetched from the database."
              >
                {roster.members.length} members · Updated {(() => {
                  const fetchedAtDate =
                    parseUtcDate(roster.snapshotMetadata?.fetchedAt ?? null) ??
                    parseUtcDate(roster.meta?.computedAt ?? null) ??
                    parseUtcDate(roster.date ?? null);
                  if (!fetchedAtDate) return 'Unknown';
                  const formattedUtc = formatUtcDateTime(fetchedAtDate);
                  const relative = formatDistanceToNow(fetchedAtDate, { addSuffix: true });
                  const snapshotDisplay = (() => {
                    const parsedSnapshot =
                      parseUtcDate(roster.snapshotMetadata?.snapshotDate ?? null) ??
                      parseUtcDate(roster.date ?? null);
                    return parsedSnapshot ? formatUtcDate(parsedSnapshot) : roster.snapshotMetadata?.snapshotDate ?? null;
                  })();
                  return `${formattedUtc} UTC${relative ? ` • ${relative}` : ''}${
                    snapshotDisplay ? ` • Clash Day ${snapshotDisplay}` : ''
                  }`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  console.log('[SimpleRoster] Manual refresh button clicked');
                  setRefreshTrigger(prev => prev + 1);
                }}
                className="px-4 py-2.5 bg-brand-surface-secondary hover:bg-brand-surface-hover border border-brand-border text-brand-text-primary rounded-lg transition-all duration-200 flex items-center gap-2 font-medium text-sm shadow-sm hover:shadow-md hover:border-brand-accent/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data</span>
              </button>
              
              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="px-4 py-2.5 bg-brand-surface-secondary hover:bg-brand-surface-hover border border-brand-border text-brand-text-primary rounded-lg transition-all duration-200 flex items-center gap-2 font-medium text-sm shadow-sm hover:shadow-md hover:border-brand-accent/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export</span>
                  <svg className={`w-3 h-3 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {exportMenuOpen && (
                  <div className="absolute right-0 sm:right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-brand-surface-primary border border-brand-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="py-1">
                      <button
                        onClick={handleExportCSVClick}
                        className="w-full px-4 py-2.5 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={handleExportDiscordClick}
                        className="w-full px-4 py-2.5 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Copy Discord Format</span>
                      </button>
                      <button
                        onClick={handleCopySummaryClick}
                        className="w-full px-4 py-2.5 text-left text-sm text-brand-text-primary hover:bg-brand-surface-hover transition-colors flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>Copy Full Table</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {roster && (() => {
          // Calculate average VIP score
          const membersWithVip = roster.members.filter(m => m.vip?.score != null);
          const avgVip = membersWithVip.length > 0
            ? membersWithVip.reduce((sum, m) => sum + (m.vip?.score ?? 0), 0) / membersWithVip.length
            : 0;

          // Top VIP leaders (top 5)
          const topVipLeaders = [...roster.members]
            .filter(m => m.vip?.score != null)
            .sort((a, b) => (b.vip?.score ?? 0) - (a.vip?.score ?? 0))
            .slice(0, 5);

          // Activity breakdown
          const activityCounts = {
            veryActive: 0,
            active: 0,
            moderate: 0,
            low: 0,
            inactive: 0,
          };

          roster.members.forEach((member) => {
            const activity = getMemberActivity(member as Member);
            if (activity.level === 'Very Active') activityCounts.veryActive++;
            else if (activity.level === 'Active') activityCounts.active++;
            else if (activity.level === 'Moderate') activityCounts.moderate++;
            else if (activity.level === 'Low') activityCounts.low++;
            else activityCounts.inactive++;
          });

          // New joiners count (joined in last 7 days)
          const newJoiners = roster.members.filter(m => isNewJoiner(m));
          const newJoinersCount = newJoiners.length;

          return (
            <div className="mb-6 grid grid-cols-5 gap-2">
              {/* Total Members Card */}
              <div 
                className="rounded-xl border border-brand-border bg-brand-surface-secondary p-4 shadow-sm hover:shadow-md transition-shadow cursor-help tooltip-overlay min-w-0"
                title="Total number of members currently on the clan roster. This count reflects the most recent snapshot data and includes all members regardless of their activity level or role."
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-brand-text-secondary mb-1">Total Members</p>
                    <p className="text-2xl font-bold text-brand-text-primary">{roster.members.length}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surfaceRaised/70 flex-shrink-0">
                    <svg className="w-5 h-5 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* New Joiners Card */}
              <div 
                className="rounded-xl border border-brand-border bg-brand-surface-secondary p-4 shadow-sm hover:shadow-md transition-shadow cursor-help tooltip-overlay min-w-0"
                title="Members who joined the clan in the last 7 days. These are new recruits who may need onboarding and support. Tenure is calculated as days since joining the clan, with new joiners having 7 days or less."
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-brand-text-secondary mb-1">New Joiners</p>
                    <p className="text-2xl font-bold text-emerald-400">{newJoinersCount}</p>
                    {newJoinersCount > 0 && (
                      <p className="text-[10px] text-brand-text-tertiary mt-0.5">
                        This week
                      </p>
                    )}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Average VIP Score Card */}
              <div 
                className="rounded-xl border border-brand-border bg-brand-surface-secondary p-4 shadow-sm hover:shadow-md transition-shadow cursor-help tooltip-overlay min-w-0"
                title="Average VIP (Very Important Player) Score across all clan members.

VIP Score measures comprehensive clan contribution:
• 50% Competitive Performance
  - Ranked battles (LAI + TPG)
  - War performance (Offensive + Defensive)
• 30% Support Performance
  - Donations to clan members
  - Clan Capital contributions
• 20% Development Performance
  - Base quality (rush percentage)
  - Activity level
  - Hero progression

Higher scores indicate more valuable clan members. Calculated weekly from Monday snapshots."
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-brand-text-secondary mb-1">Avg VIP Score</p>
                    <p className="text-2xl font-bold text-clash-gold">{avgVip > 0 ? avgVip.toFixed(1) : '—'}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surfaceRaised/70 flex-shrink-0">
                    <svg className="w-5 h-5 text-clash-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Top VIP Leaders Card */}
              <div 
                className="rounded-xl border border-brand-border bg-brand-surface-secondary p-4 shadow-sm hover:shadow-md transition-shadow cursor-help tooltip-overlay min-w-0"
                title="Top VIP Leader from the clan roster.

VIP Score measures comprehensive clan contribution:
• Competitive Performance (50%)
• Support Performance (30%)
• Development Performance (20%)

The top leader represents the member with the highest overall contribution score. Shows the #1 leader and indicates how many more are in the top 5 rankings."
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-brand-text-secondary mb-1">Top VIP Leader</p>
                  {topVipLeaders.length > 0 ? (
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base font-bold text-brand-text-primary truncate">{topVipLeaders[0].name}</span>
                        <span className="text-xs font-semibold text-clash-gold flex-shrink-0">{topVipLeaders[0].vip?.score.toFixed(1)}</span>
                      </div>
                      {topVipLeaders.length > 1 && (
                        <p className="text-[10px] text-brand-text-tertiary">
                          +{topVipLeaders.length - 1} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-base font-bold text-brand-text-secondary">—</p>
                  )}
                </div>
              </div>

              {/* Activity Breakdown Card */}
              <div 
                className="rounded-xl border border-brand-border bg-brand-surface-secondary p-4 shadow-sm hover:shadow-md transition-shadow cursor-help tooltip-overlay min-w-0"
                title="Breakdown of clan member activity levels based on recent performance.

Activity Score Calculation (0-65 points):
• Ranked Battles (0-20 pts): Participating in ranked multiplayer battles
• Donations (0-15 pts): Troops donated to clan members
• Hero Development (0-10 pts): Hero upgrades and progression
• Leadership Role (0-10 pts): Leader, Co-Leader, or Elder role
• Trophy Level (0-10 pts): Current trophy count tier

Activity Levels:
• Very Active: Highest scoring members (typically 50+ pts)
• Active: Engaged members (typically 30-49 pts)
• Moderate: Some participation (typically 15-29 pts)
• Low: Minimal activity (typically 5-14 pts)
• Inactive: No recent activity (typically 0-4 pts)

Helps identify engaged vs. inactive members."
              >
                <div className="mb-2">
                  <p className="text-xs text-brand-text-secondary mb-1.5">Activity Breakdown</p>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-brand-text-tertiary cursor-help"
                        title="Very Active: Members scoring 50+ activity points. Highly engaged in ranked battles, donations, and clan activities."
                      >
                        Very Active
                      </span>
                      <span className="font-semibold text-green-400">{activityCounts.veryActive}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-brand-text-tertiary cursor-help"
                        title="Active: Members scoring 30-49 activity points. Regularly participating in clan activities."
                      >
                        Active
                      </span>
                      <span className="font-semibold text-blue-400">{activityCounts.active}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-brand-text-tertiary cursor-help"
                        title="Moderate: Members scoring 15-29 activity points. Some participation but not highly engaged."
                      >
                        Moderate
                      </span>
                      <span className="font-semibold text-yellow-400">{activityCounts.moderate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-brand-text-tertiary cursor-help"
                        title="Inactive: Members scoring 0-14 activity points. Minimal or no recent clan activity."
                      >
                        Inactive
                      </span>
                      <span className="font-semibold text-red-400">{activityCounts.inactive}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Roster Table - Desktop */}
        <div className="hidden md:block rounded-xl border border-brand-border bg-brand-surface shadow-lg overflow-hidden w-full">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-[1400px] w-full border-collapse">
              <thead>
                <tr className="bg-brand-surface-secondary border-b border-brand-border">
                  <th 
                    onClick={() => handleSort('name')}
                    title="Player name - Click to sort"
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[120px]"
                  >
                    Player {sortKey === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('role')}
                    title="Clan role: Leader > Co-Leader > Elder > Member - Click to sort"
                    className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[80px]"
                  >
                    Role {sortKey === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('th')}
                    title="Town Hall level - Higher TH unlocks more troops, defenses, and heroes - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[60px]"
                  >
                    TH {sortKey === 'th' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('league')}
                    title="Ranked battle league - Shows current competitive tier based on trophy count - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[90px]"
                  >
                    League {sortKey === 'league' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('trophies')}
                    title="Current trophy count from multiplayer battles - Higher trophies = harder opponents - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[90px]"
                  >
                    Trophies {sortKey === 'trophies' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('vip')}
                    title="VIP Score (Very Important Player) - Measures comprehensive clan contribution (50% Competitive + 30% Support + 20% Development) - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[80px]"
                  >
                    VIP {sortKey === 'vip' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                <th 
                  onClick={() => handleSort('lastWeek')}
                  title="Last week's final trophy count (Monday 4:30 AM UTC snapshot before Tuesday reset) - Shows previous week's competitive performance - Click to sort"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[90px]"
                >
                  Last Week {sortKey === 'lastWeek' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('season')}
                  title="Cumulative trophy total via Monday finals since season start"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[110px]"
                >
                  Running Total {sortKey === 'season' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('tenure')}
                  title="Days since joining the clan - Click to sort"
                  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[100px]"
                >
                  Tenure (days) {sortKey === 'tenure' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('rush')}
                    title="Rush % - Heroes below max for current TH level. Lower is better (0% = maxed) - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[70px]"
                  >
                    Rush % {sortKey === 'rush' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('bk')}
                    title="Barbarian King level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[50px]"
                  >
                    BK {sortKey === 'bk' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('aq')}
                    title="Archer Queen level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[50px]"
                  >
                    AQ {sortKey === 'aq' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('gw')}
                    title="Grand Warden level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[50px]"
                  >
                    GW {sortKey === 'gw' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('rc')}
                    title="Royal Champion level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[50px]"
                  >
                    RC {sortKey === 'rc' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('mp')}
                    title="Minion Prince level - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[50px]"
                  >
                    MP {sortKey === 'mp' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('activity')}
                    title="Activity level based on: ranked battles (20 pts), donations (15 pts), hero progress (10 pts), role (10 pts), trophies (10 pts) - Click to sort"
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[90px]"
                  >
                    Activity {sortKey === 'activity' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('donations')}
                    title="Troops donated to clan members this season - Higher is better - Click to sort"
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[80px]"
                  >
                    Donated {sortKey === 'donations' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('received')}
                    title="Troops received from clan members this season - Compare with donated to see balance - Click to sort"
                    className="px-4 py-3 text-right text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent min-w-[80px]"
                  >
                    Received {sortKey === 'received' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider min-w-[80px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {sortedMembers.map((player, index) => {
                  const roleBadgeVariant = getRoleBadgeVariant(player.role);
                  const rushPercent = calculateRushPercentage(player as Member);
                  const activity = getMemberActivity(player as Member);
                  const maxHeroes = getHeroCaps(player.townHallLevel ?? 0);
                  
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
                  const donationBalance = (player.donationsReceived ?? 0) - (player.donations ?? 0);
                  const donationTooltip = `Donated: ${player.donations ?? 0}
Received: ${player.donationsReceived ?? 0}
Balance: ${donationBalance > 0 ? '+' : ''}${donationBalance}

${donationBalance > 0 ? 'Receives more than gives' : donationBalance < 0 ? 'Gives more than receives' : 'Balanced donations'}`;
                  
                  return (
                    <tr 
                      key={player.tag} 
                      className="hover:bg-brand-surface-hover transition-colors duration-150"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/player/${player.tag.replace('#', '')}`}
                            className="text-white hover:text-slate-200 hover:underline transition-colors"
                            style={{ fontFamily: "'Clash Display', sans-serif" }}
                          >
                            {player.name}
                          </Link>
                          {isNewJoiner(player) && (
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              title={`New joiner: Joined ${player.tenureDays} day${player.tenureDays === 1 ? '' : 's'} ago`}
                            >
                              New
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span 
                          title={roleTooltip}
                          className="text-sm text-brand-text-secondary cursor-help"
                        >
                          {player.role === 'leader' ? 'Leader' : player.role === 'coLeader' ? 'Co-Leader' : player.role === 'admin' ? 'Elder' : 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center" title={`Town Hall ${player.townHallLevel ?? '?'}`}>
                          <TownHallBadge
                            level={player.townHallLevel ?? 0}
                            size="sm"
                            showLevel
                            showBox={false}
                            levelBadgeClassName="rounded-full border-0 bg-slate-950/95 px-1.5 text-sm font-bold text-brand-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex justify-center">
                          <div 
                            title={`Current trophy count: ${(player.trophies ?? 0).toLocaleString()}`}
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
                              {(player.trophies ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {player.vip ? (
                          <div className="flex items-center justify-center">
                            <span
                              title={`VIP: ${player.vip.score.toFixed(1)}/100
Rank: #${player.vip.rank}
Competitive Performance: ${player.vip.competitive_score.toFixed(1)}/100
Support Performance: ${player.vip.support_score.toFixed(1)}/100
Development Performance: ${player.vip.development_score.toFixed(1)}/100
${player.vip.trend === 'up' ? '↑' : player.vip.trend === 'down' ? '↓' : '→'} ${player.vip.last_week_score ? `vs ${player.vip.last_week_score.toFixed(1)} last week` : ''}

VIP measures comprehensive clan contribution:
• Competitive (50%): Ranked Performance + War Performance
• Support (30%): Donations + Capital Contributions
• Development (20%): Base Quality + Activity`}
                              className={`font-semibold cursor-help ${
                                player.vip.score >= 80 ? 'text-green-400' :
                                player.vip.score >= 50 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}
                            >
                              {player.vip.score.toFixed(1)}
                              {player.vip.trend === 'up' && ' ↑'}
                              {player.vip.trend === 'down' && ' ↓'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-brand-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {player.lastWeekTrophies !== null && player.lastWeekTrophies !== undefined ? (
                          <span 
                            title={`Last week's final trophy count: ${(player.lastWeekTrophies ?? 0).toLocaleString()}`}
                            className="font-mono text-sm font-semibold text-brand-text-secondary cursor-help"
                          >
                            {(player.lastWeekTrophies ?? 0).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {player.seasonTotalTrophies !== null && player.seasonTotalTrophies !== undefined ? (
                          <span 
                            title={`Running total trophies (sum of weekly finals): ${(player.seasonTotalTrophies ?? 0).toLocaleString()}`}
                            className="font-mono text-sm font-semibold text-brand-text-secondary cursor-help"
                          >
                            {(player.seasonTotalTrophies ?? 0).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {player.tenureDays !== null && player.tenureDays !== undefined ? (
                          <div className="flex flex-col items-center gap-1">
                            <span 
                              title={`Tenure: ${player.tenureDays} day${player.tenureDays === 1 ? '' : 's'} since joining`}
                              className={`font-mono text-sm font-semibold cursor-help ${
                                isNewJoiner(player) 
                                  ? 'text-emerald-400' 
                                  : 'text-brand-text-secondary'
                              }`}
                            >
                              {player.tenureDays}
                            </span>
                            {isNewJoiner(player) && (
                              <span className="text-[10px] text-emerald-400/70 font-medium">
                                New
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-brand-text-muted">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={rushTooltip}
                          className={`font-mono text-sm font-semibold cursor-help ${rushColor}`}
                        >
                          {rushPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={`Barbarian King: ${player.bk || 0}/${maxHeroes.bk || 0}\n${(maxHeroes.bk || 0) > 0 ? `Progress: ${Math.round(((player.bk || 0) / (maxHeroes.bk || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.bk || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={`Archer Queen: ${player.aq || 0}/${maxHeroes.aq || 0}\n${(maxHeroes.aq || 0) > 0 ? `Progress: ${Math.round(((player.aq || 0) / (maxHeroes.aq || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.aq || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={`Grand Warden: ${player.gw || 0}/${maxHeroes.gw || 0}\n${(maxHeroes.gw || 0) > 0 ? `Progress: ${Math.round(((player.gw || 0) / (maxHeroes.gw || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.gw || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={`Royal Champion: ${player.rc || 0}/${maxHeroes.rc || 0}\n${(maxHeroes.rc || 0) > 0 ? `Progress: ${Math.round(((player.rc || 0) / (maxHeroes.rc || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.rc || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={`Minion Prince: ${player.mp || 0}/${maxHeroes.mp || 0}\n${(maxHeroes.mp || 0) > 0 ? `Progress: ${Math.round(((player.mp || 0) / (maxHeroes.mp || 1)) * 100)}%` : 'Not available at this TH'}`}
                          className="font-mono text-sm text-brand-text-primary cursor-help"
                        >
                          {player.mp || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          title={activityTooltip}
                          className="text-sm text-brand-text-secondary cursor-help"
                        >
                          {activity.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-green-600 font-medium cursor-help"
                        >
                          {player.donations === 0 ? '—' : player.donations}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span 
                          title={donationTooltip}
                          className="font-mono text-sm text-blue-600 font-medium cursor-help"
                        >
                          {player.donationsReceived === 0 ? '—' : player.donationsReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
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
            const rushPercent = calculateRushPercentage(player as Member);
            const activity = getMemberActivity(player as Member);
            const maxHeroes = getHeroCaps(player.townHallLevel ?? 0);
            
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

            const donationBalance = (player.donationsReceived ?? 0) - (player.donations ?? 0);
            const donationTooltip = `Donated: ${player.donations ?? 0}
Received: ${player.donationsReceived ?? 0}
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
                    {isNewJoiner(player) && (
                      <span 
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        title={`New joiner: Joined ${player.tenureDays} day${player.tenureDays === 1 ? '' : 's'} ago`}
                      >
                        New
                      </span>
                    )}
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
                      title={`Current trophy count: ${(player.trophies ?? 0).toLocaleString()}`}
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
                        {(player.trophies ?? 0) >= 1000 ? `${((player.trophies ?? 0) / 1000).toFixed(1)}k` : (player.trophies ?? 0)}
                      </span>
                    </div>
                    <div title={`Town Hall ${player.townHallLevel ?? '?'}`} className="relative cursor-help" style={{ width: '48px', height: '48px' }}>
                      <Image 
                        src={`/assets/clash/Townhalls/TH${player.townHallLevel ?? 0}.png`}
                        alt={`TH${player.townHallLevel ?? 0}`}
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

                  {/* VIP */}
                  {player.vip && (
                    <div 
                      title={`VIP: ${player.vip.score.toFixed(1)}/100
Rank: #${player.vip.rank}
Competitive Performance: ${player.vip.competitive_score.toFixed(1)}/100
Support Performance: ${player.vip.support_score.toFixed(1)}/100
Development Performance: ${player.vip.development_score.toFixed(1)}/100
${player.vip.trend === 'up' ? '↑' : player.vip.trend === 'down' ? '↓' : '→'} ${player.vip.last_week_score ? `vs ${player.vip.last_week_score.toFixed(1)} last week` : ''}`}
                      className="cursor-help text-right"
                    >
                      <div className="text-brand-text-tertiary text-[10px]">VIP</div>
                      <div className={`font-semibold text-sm ${
                        player.vip.score >= 80 ? 'text-green-400' :
                        player.vip.score >= 50 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {player.vip.score.toFixed(1)}
                        {player.vip.trend === 'up' && ' ↑'}
                        {player.vip.trend === 'down' && ' ↓'}
                      </div>
                    </div>
                  )}

                  {/* Donations */}
                  <div title={donationTooltip} className="cursor-help text-right pt-1 border-t border-brand-border/30">
                    <div className="text-brand-text-tertiary text-[10px]">Don: <span className="font-mono text-green-600 font-semibold">{player.donations === 0 ? '—' : player.donations}</span></div>
                    <div className="text-brand-text-tertiary text-[10px]">Rec: <span className="font-mono text-blue-600 font-semibold">{player.donationsReceived === 0 ? '—' : player.donationsReceived}</span></div>
                    <div className="text-brand-text-tertiary text-[10px]">Bal: <span className={`font-mono font-semibold ${donationBalance > 0 ? 'text-red-600' : donationBalance < 0 ? 'text-green-600' : 'text-brand-text-tertiary'}`}>
                      {donationBalance > 0 ? '+' : ''}{donationBalance}
                    </span></div>
                  </div>

                  {/* Tenure */}
                  {player.tenureDays !== null && player.tenureDays !== undefined && (
                    <div 
                      title={`Tenure: ${player.tenureDays} day${player.tenureDays === 1 ? '' : 's'} since joining`}
                      className="cursor-help text-right pt-1 border-t border-brand-border/30"
                    >
                      <div className="text-brand-text-tertiary text-[10px]">Tenure</div>
                      <div className={`font-mono font-semibold text-sm ${
                        isNewJoiner(player) 
                          ? 'text-emerald-400' 
                          : 'text-brand-text-secondary'
                      }`}>
                        {player.tenureDays}d
                        {isNewJoiner(player) && <span className="text-[10px] text-emerald-400/70 ml-1">New</span>}
                      </div>
                    </div>
                  )}
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
