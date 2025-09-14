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

import React, { useMemo, useState, useCallback } from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { Member, Roster, SortKey, SortDirection } from '@/types';
import { 
  calculateRushPercentage, 
  calculateOverallRush,
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
import { TableFilters } from './TableFilters';
import { Pagination } from './Pagination';
import { Button } from '@/components/ui';
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
      case 'overallRush':
        aValue = calculateOverallRush(a);
        bValue = calculateOverallRush(b);
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
  const { roster, sortKey, sortDir, setSortKey, setSortDir } = useDashboardStore();
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

  // Get members from roster
  const members = roster?.members || [];

  // Apply sorting and filtering
  const sortedMembers = useMemo(() => {
    return sortMembers(members, sortKey, sortDir);
  }, [members, sortKey, sortDir]);

  const filteredMembers = useMemo(() => {
    return filterMembers(sortedMembers, filters);
  }, [sortedMembers, filters]);

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
    <div className={`space-y-6 ${className}`}>
      {/* Table Filters */}
      <TableFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        uniqueRoles={uniqueRoles}
        uniqueTownHalls={uniqueTownHalls}
        totalMembers={members.length}
        filteredCount={filteredMembers.length}
      />

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <table className="min-w-full text-sm">
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

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {paginatedMembers.map((member, index) => (
          <MobileCard
            key={`${member.tag}-${index}`}
            member={member}
            index={index}
            roster={roster}
          />
        ))}
      </div>

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

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{members.length}</div>
            <div className="text-sm text-gray-600">Total Members</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{filteredMembers.length}</div>
            <div className="text-sm text-gray-600">Filtered</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(members.reduce((sum, m) => sum + getTownHallLevel(m), 0) / members.length)}
            </div>
            <div className="text-sm text-gray-600">Avg TH</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {members.reduce((sum, m) => sum + (m.donations || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Donations</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RosterTable;
