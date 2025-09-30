/**
 * RosterTable Component
 * 
 * The main roster table component that displays clan member data with advanced functionality.
 * Features sorting, filtering, pagination, and responsive design.
 * 
 * Features:
 * - Advanced sorting with multiple columns
 * - Real-time filtering and search
 * - Pagination for large datasets
 * - Responsive design (desktop table + mobile cards)
 * - Performance optimization with virtual scrolling
 * - Accessibility features
 * - Leadership-based actions
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { Member, Roster, SortKey, SortDirection } from '@/types';
import { safeLocaleTimeString } from '@/lib/date';
import { 
  calculateRushPercentage, 
  calculateDonationBalance, 
  calculateActivityScore,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
  isNetReceiver,
  isLowDonator
} from '@/lib/business/calculations';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { MobileCard } from './MobileCard';
import { PlayerCard } from './PlayerCard';
import { TableFilters } from './TableFilters';
import { Pagination } from './Pagination';
import { Button, Input, TownHallBadge, LeagueBadge, ResourceDisplay, HeroLevel } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';

// =============================================================================
// TYPES
// =============================================================================

export interface RosterTableProps {
  className?: string;
}

export interface TableFilters {
  search: string;
  role: string;
  townHall: string;
  rushLevel: string;
  activityLevel: string;
  donationStatus: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PAGE_SIZE = 50;
const MOBILE_BREAKPOINT = 768;

const RUSH_LEVELS = {
  'all': 'All Players',
  'very-rushed': 'Very Rushed (70%+)',
  'rushed': 'Rushed (40-69%)',
  'not-rushed': 'Not Rushed (<40%)'
} as const;

const ACTIVITY_LEVELS = {
  'all': 'All Activity Levels',
  'very-active': 'Very Active',
  'active': 'Active',
  'moderate': 'Moderate',
  'low': 'Low',
  'inactive': 'Inactive'
} as const;

const DONATION_STATUS = {
  'all': 'All Donation Status',
  'net-receiver': 'Net Receiver',
  'net-donator': 'Net Donator',
  'low-donator': 'Low Donator'
} as const;

// =============================================================================
// SORTING LOGIC
// =============================================================================

const sortMembers = (members: Member[], sortKey: SortKey, sortDirection: SortDirection): Member[] => {
  return [...members].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortKey) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'role':
        const roleOrder = { 'leader': 4, 'coleader': 3, 'elder': 2, 'member': 1 };
        aValue = roleOrder[a.role as keyof typeof roleOrder] || 0;
        bValue = roleOrder[b.role as keyof typeof roleOrder] || 0;
        break;
      case 'th':
        aValue = getTownHallLevel(a);
        bValue = getTownHallLevel(b);
        break;
      case 'bk':
      case 'aq':
      case 'gw':
      case 'rc':
      case 'mp':
        aValue = a[sortKey] || 0;
        bValue = b[sortKey] || 0;
        break;
      case 'rush':
        aValue = calculateRushPercentage(a);
        bValue = calculateRushPercentage(b);
        break;
      case 'trophies':
        aValue = a.trophies || 0;
        bValue = b.trophies || 0;
        break;
      case 'donations':
        aValue = a.donations || 0;
        bValue = b.donations || 0;
        break;
      case 'donationsReceived':
        aValue = a.donationsReceived || 0;
        bValue = b.donationsReceived || 0;
        break;
      case 'tenure':
        aValue = a.tenure_days || a.tenure || 0;
        bValue = b.tenure_days || b.tenure || 0;
        break;
      case 'activity':
        aValue = calculateActivityScore(a).score;
        bValue = calculateActivityScore(b).score;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

// =============================================================================
// FILTERING LOGIC
// =============================================================================

const filterMembers = (members: Member[], filters: TableFilters): Member[] => {
  return members.filter(member => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm) ||
        member.tag.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
    }

    // Role filter
    if (filters.role && filters.role !== 'all') {
      if (filters.role === 'leadership') {
        const r = (member.role || '').toLowerCase();
        if (!(r === 'leader' || r === 'coleader' || member.role === 'coLeader')) return false;
      } else if (member.role !== filters.role) {
        return false;
      }
    }

    // Town Hall filter
    if (filters.townHall && filters.townHall !== 'all') {
      const th = getTownHallLevel(member);
      if (th.toString() !== filters.townHall) return false;
    }

    // Rush level filter
    if (filters.rushLevel && filters.rushLevel !== 'all') {
      const rushPercent = calculateRushPercentage(member);
      switch (filters.rushLevel) {
        case 'very-rushed':
          if (rushPercent < 70) return false;
          break;
        case 'rushed':
          if (rushPercent < 40 || rushPercent >= 70) return false;
          break;
        case 'not-rushed':
          if (rushPercent >= 40) return false;
          break;
      }
    }

    // Activity level filter
    if (filters.activityLevel && filters.activityLevel !== 'all') {
      const activity = calculateActivityScore(member);
      if (activity.level.toLowerCase() !== filters.activityLevel) return false;
    }

    // Donation status filter
    if (filters.donationStatus && filters.donationStatus !== 'all') {
      const donationBalance = calculateDonationBalance(member);
      switch (filters.donationStatus) {
        case 'net-receiver':
          if (donationBalance.balance <= 0) return false;
          break;
        case 'net-donator':
          if (donationBalance.balance >= 0) return false;
          break;
        case 'low-donator':
          if (!isLowDonator(member)) return false;
          break;
      }
    }

    return true;
  });
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const RosterTable: React.FC<RosterTableProps> = ({ className = '' }) => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (typeof window !== 'undefined') {
    console.log(`[RenderTrace] RosterTable#${renderCountRef.current}`);
  }
  const { roster, sortKey, sortDir, setSortKey, setSortDir, dataFetchedAt } = useDashboardStore();
  const rosterViewMode = useDashboardStore((state) => state.rosterViewMode);
  const setRosterViewMode = useDashboardStore((state) => state.setRosterViewMode);
  const [filters, setFilters] = useState<TableFilters>({
    search: '',
    role: 'all',
    townHall: 'all',
    rushLevel: 'all',
    activityLevel: 'all',
    donationStatus: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  // Get members from roster
  const members = useMemo(() => roster?.members ?? [], [roster?.members]);

  // Apply sorting and filtering
  const sortedMembers = useMemo(() => {
    return sortMembers(members, sortKey, sortDir);
  }, [members, sortKey, sortDir]);

  const filteredMembers = useMemo(() => {
    return filterMembers(sortedMembers, filters);
  }, [sortedMembers, filters]);

  const filteredCount = filteredMembers.length;

  // Pagination
  const totalItems = filteredMembers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

  // Handlers
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey, sortDir, setSortKey, setSortDir]);

  const handleFilterChange = useCallback((newFilters: Partial<TableFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleSelectMember = useCallback((member: Member) => {
    const normalizedTag = member.tag.startsWith('#') ? member.tag.slice(1) : member.tag;
    router.push(`/player/${normalizedTag}`);
  }, [router]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      role: 'all',
      townHall: 'all',
      rushLevel: 'all',
      activityLevel: 'all',
      donationStatus: 'all'
    });
    setCurrentPage(1);
  }, []);

  // Get unique values for filter options
  const uniqueRoles = useMemo(() => {
    const roles = new Set(members.map(m => m.role).filter((role): role is string => Boolean(role)));
    return Array.from(roles).sort();
  }, [members]);

  const uniqueTownHalls = useMemo(() => {
    const ths = new Set(members.map(m => getTownHallLevel(m)));
    return Array.from(ths).sort((a, b) => b - a);
  }, [members]);

  const hasActiveFilters =
    filters.search ||
    filters.role !== 'all' ||
    filters.townHall !== 'all' ||
    filters.rushLevel !== 'all' ||
    filters.activityLevel !== 'all' ||
    filters.donationStatus !== 'all';

  if (!roster) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">🏰</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Clan Loaded</h3>
        <p className="text-gray-600">Load a clan to view the member roster</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">👥</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Members Found</h3>
        <p className="text-gray-600">This clan has no members or the data could not be loaded</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 text-slate-800 ${className}`}>
      {/* Filters + Quick Actions side-by-side on large screens */}
      <div className="grid grid-cols-1 gap-4 items-start">
        {showFilters ? (
          <TableFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            uniqueRoles={uniqueRoles}
            uniqueTownHalls={uniqueTownHalls}
            totalMembers={members.length}
            filteredCount={filteredCount}
            onClose={() => setShowFilters(false)}
          />
        ) : (
          <div className="clash-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-high-contrast">Filters</span>
                <span className="text-xs text-muted-contrast">
                  {filteredCount} of {members.length} members
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    onClick={handleClearFilters}
                    variant="outline"
                    size="sm"
                    className="text-clash-red border-clash-red/50 hover:bg-clash-red/10 focus-ring"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  onClick={() => setShowFilters(true)}
                  size="sm"
                  variant="outline"
                  className="px-4 border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle focus-ring"
                >
                  Show Filters
                </Button>
              </div>
            </div>
            <Input
              type="text"
              placeholder="Search members by name or tag..."
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="mt-1"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-contrast">
              <span className="text-muted-contrast">Quick filters:</span>
              <Button
                onClick={() => handleFilterChange({ role: filters.role === 'leadership' ? 'all' : 'leadership' })}
                variant={filters.role === 'leadership' ? 'primary' : 'outline'}
                size="sm"
                className={`text-xs focus-ring ${filters.role === 'leadership' ? 'border border-brand-primary/40 bg-brand-primary text-white' : 'border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle'}`}
              >
                Leaders & Co-Leaders
              </Button>
              <Button
                onClick={() => handleFilterChange({ role: filters.role === 'elder' ? 'all' : 'elder' })}
                variant={filters.role === 'elder' ? 'primary' : 'outline'}
                size="sm"
                className={`text-xs focus-ring ${filters.role === 'elder' ? 'border border-brand-primary/40 bg-brand-primary text-white' : 'border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle'}`}
              >
                Elders
              </Button>
              <Button
                onClick={() => handleFilterChange({ rushLevel: filters.rushLevel === 'very-rushed' ? 'all' : 'very-rushed' })}
                variant={filters.rushLevel === 'very-rushed' ? 'primary' : 'outline'}
                size="sm"
                className={`text-xs focus-ring ${filters.rushLevel === 'very-rushed' ? 'border border-brand-primary/40 bg-brand-primary text-white' : 'border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle'}`}
              >
                Very Rushed
              </Button>
              <Button
                onClick={() => handleFilterChange({ activityLevel: filters.activityLevel === 'inactive' ? 'all' : 'inactive' })}
                variant={filters.activityLevel === 'inactive' ? 'primary' : 'outline'}
                size="sm"
                className={`text-xs focus-ring ${filters.activityLevel === 'inactive' ? 'border border-brand-primary/40 bg-brand-primary text-white' : 'border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle'}`}
              >
                Inactive
              </Button>
              <Button
                onClick={() => handleFilterChange({ donationStatus: filters.donationStatus === 'low-donator' ? 'all' : 'low-donator' })}
                variant={filters.donationStatus === 'low-donator' ? 'primary' : 'outline'}
                size="sm"
                className={`text-xs focus-ring ${filters.donationStatus === 'low-donator' ? 'border border-brand-primary/40 bg-brand-primary text-white' : 'border border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle'}`}
              >
                Low Donators
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant={rosterViewMode === 'table' ? 'primary' : 'ghost'}
            onClick={() => setRosterViewMode('table')}
            className={`view-toggle-btn ${rosterViewMode === 'table' ? 'view-toggle-btn--active' : ''}`}
          >
            <List className="h-4 w-4" aria-hidden />
            <span>Table View</span>
          </Button>
          <Button
            size="sm"
            variant={rosterViewMode === 'cards' ? 'primary' : 'ghost'}
            onClick={() => setRosterViewMode('cards')}
            className={`view-toggle-btn ${rosterViewMode === 'cards' ? 'view-toggle-btn--active' : ''}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            <span>Card View</span>
          </Button>
        </div>
      </div>


      {rosterViewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedMembers.map((member) => (
            <PlayerCard key={member.tag} member={member} onSelect={handleSelectMember} />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <div className="clash-card overflow-hidden">
              <table className="clash-table" role="table" aria-label="Clan member roster">
                <TableHeader
                  sortKey={sortKey}
                  sortDirection={sortDir}
                  onSort={handleSort}
                />
                <tbody>
                  {paginatedMembers.map((member, index) => (
                    <TableRow
                      key={`${member.tag}-${index}`}
                      member={member}
                      index={index}
                      roster={roster}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block lg:hidden space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            {paginatedMembers.map((member, index) => (
              <MobileCard
                key={`${member.tag}-${index}`}
                member={member}
                index={index}
                roster={roster}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Data Source Indicator - Footer */}
      {roster && (
        <div className="clash-card mt-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 text-sm text-medium-contrast sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${roster.source === 'live' ? 'bg-clash-green' : 'bg-clash-blue'}`}></div>
                <span className="font-semibold text-high-contrast">
                  Data Source: {roster.source === 'live' ? 'Live API' : 'Snapshot'}
                </span>
              </div>
              <div className="text-muted-contrast">Date: {roster.date}</div>
              <div className="text-muted-contrast">Members: {roster.members.length}</div>
            </div>
            <div className="text-xs text-muted-contrast sm:text-right">
              Last updated: {safeLocaleTimeString(dataFetchedAt, {
                fallback: 'Unknown',
                context: 'RosterTable dataFetchedAt'
              })}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default RosterTable;
