/**
 * TableFilters Component
 * 
 * Advanced filtering interface for the roster table.
 * Provides search, role filtering, and other advanced filtering options.
 * 
 * Features:
 * - Real-time search functionality
 * - Role-based filtering
 * - Town Hall level filtering
 * - Rush level filtering
 * - Activity level filtering
 * - Donation status filtering
 * - Clear filters functionality
 * - Filter count display
 * - Responsive design
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState, useEffect } from 'react';
import { Input, Button } from '@/components/ui';

// =============================================================================
// TYPES
// =============================================================================

export interface TableFiltersProps {
  filters: {
    search: string;
    role: string;
    townHall: string;
    rushLevel: string;
    activityLevel: string;
    donationStatus: string;
  };
  onFilterChange: (filters: Partial<TableFiltersProps['filters']>) => void;
  onClearFilters: () => void;
  uniqueRoles: string[];
  uniqueTownHalls: number[];
  totalMembers: number;
  filteredCount: number;
  className?: string;
  onClose?: () => void;
}

// =============================================================================
// FILTER OPTIONS
// =============================================================================

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
// FILTER COMPONENTS
// =============================================================================

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
  className?: string;
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
  className = ''
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        {Object.entries(options).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TableFilters: React.FC<TableFiltersProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  uniqueRoles,
  uniqueTownHalls,
  totalMembers,
  filteredCount,
  className = '',
  onClose,
}) => {
  const [searchDebounce, setSearchDebounce] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDebounce !== filters.search) {
        onFilterChange({ search: searchDebounce });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchDebounce, filters.search, onFilterChange]);

  useEffect(() => {
    setSearchDebounce(filters.search);
  }, [filters.search]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search ||
    filters.role !== 'all' ||
    filters.townHall !== 'all' ||
    filters.rushLevel !== 'all' ||
    filters.activityLevel !== 'all' ||
    filters.donationStatus !== 'all';

  return (
    <div className={`bg-white backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-5 text-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {filteredCount} of {totalMembers} members
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                {Object.values(filters).filter(v => v && v !== 'all').length} active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <Button
              onClick={onClearFilters}
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
            >
              Clear All
            </Button>
          )}
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Hide
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Search Members
        </label>
        <Input
          type="text"
          placeholder="Search by name or tag..."
          value={searchDebounce}
          onChange={(e) => setSearchDebounce(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Role Filter */}
        <FilterSelect
          label="Role"
          value={filters.role}
          onChange={(value) => onFilterChange({ role: value })}
          options={{
            'all': 'All Roles',
            ...uniqueRoles.reduce((acc, role) => {
              acc[role] = role.charAt(0).toUpperCase() + role.slice(1);
              return acc;
            }, {} as Record<string, string>)
          }}
        />

        {/* Town Hall Filter */}
        <FilterSelect
          label="Town Hall Level"
          value={filters.townHall}
          onChange={(value) => onFilterChange({ townHall: value })}
          options={{
            'all': 'All Town Halls',
            ...uniqueTownHalls.reduce((acc, th) => {
              acc[th.toString()] = `TH${th}`;
              return acc;
            }, {} as Record<string, string>)
          }}
        />

        {/* Rush Level Filter */}
        <FilterSelect
          label="Rush Level"
          value={filters.rushLevel}
          onChange={(value) => onFilterChange({ rushLevel: value })}
          options={RUSH_LEVELS}
        />

        {/* Activity Level Filter */}
        <FilterSelect
          label="Activity Level"
          value={filters.activityLevel}
          onChange={(value) => onFilterChange({ activityLevel: value })}
          options={ACTIVITY_LEVELS}
        />

        {/* Donation Status Filter */}
        <FilterSelect
          label="Donation Status"
          value={filters.donationStatus}
          onChange={(value) => onFilterChange({ donationStatus: value })}
          options={DONATION_STATUS}
        />
      </div>

      {/* Quick Filter Chips */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600">Quick filters:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onFilterChange({ role: filters.role === 'leadership' ? 'all' : 'leadership' })}
              variant="outline"
              size="sm"
              className={`text-xs transition-colors ${
                filters.role === 'leadership'
                  ? 'border-amber-400 bg-amber-100/60 text-amber-700 dark:border-amber-300/60 dark:bg-amber-400/15 dark:text-amber-200'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'
              }`}
              title="Leaders & Co-Leaders"
            >
              Leaders & Co-Leaders
            </Button>
            <Button
              onClick={() => onFilterChange({ role: filters.role === 'elder' ? 'all' : 'elder' })}
              variant="outline"
              size="sm"
              className={`text-xs transition-colors ${
                filters.role === 'elder'
                  ? 'border-amber-400 bg-amber-100/60 text-amber-700 dark:border-amber-300/60 dark:bg-amber-400/15 dark:text-amber-200'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'
              }`}
            >
              Elders
            </Button>
            <Button
              onClick={() => onFilterChange({ rushLevel: filters.rushLevel === 'very-rushed' ? 'all' : 'very-rushed' })}
              variant="outline"
              size="sm"
              className={`text-xs transition-colors ${
                filters.rushLevel === 'very-rushed'
                  ? 'border-amber-400 bg-amber-100/60 text-amber-700 dark:border-amber-300/60 dark:bg-amber-400/15 dark:text-amber-200'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'
              }`}
            >
              Very Rushed
            </Button>
            <Button
              onClick={() => onFilterChange({ activityLevel: filters.activityLevel === 'inactive' ? 'all' : 'inactive' })}
              variant="outline"
              size="sm"
              className={`text-xs transition-colors ${
                filters.activityLevel === 'inactive'
                  ? 'border-amber-400 bg-amber-100/60 text-amber-700 dark:border-amber-300/60 dark:bg-amber-400/15 dark:text-amber-200'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'
              }`}
            >
              Inactive
            </Button>
            <Button
              onClick={() => onFilterChange({ donationStatus: filters.donationStatus === 'low-donator' ? 'all' : 'low-donator' })}
              variant="outline"
              size="sm"
              className={`text-xs transition-colors ${
                filters.donationStatus === 'low-donator'
                  ? 'border-amber-400 bg-amber-100/60 text-amber-700 dark:border-amber-300/60 dark:bg-amber-400/15 dark:text-amber-200'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'
              }`}
            >
              Low Donators
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Summary */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            <strong>Active filters:</strong>
            <div className="mt-1 flex flex-wrap gap-2">
              {filters.search && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                  Search: &quot;{filters.search}&quot;
                </span>
              )}
              {filters.role !== 'all' && (
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                  Role: {filters.role}
                </span>
              )}
              {filters.townHall !== 'all' && (
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                  TH: {filters.townHall}
                </span>
              )}
              {filters.rushLevel !== 'all' && (
                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                  Rush: {RUSH_LEVELS[filters.rushLevel as keyof typeof RUSH_LEVELS]}
                </span>
              )}
              {filters.activityLevel !== 'all' && (
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                  Activity: {filters.activityLevel}
                </span>
              )}
              {filters.donationStatus !== 'all' && (
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
                  Donations: {filters.donationStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableFilters;
