/**
 * TableHeader Component
 * 
 * Handles the table header with sorting functionality and column grouping.
 * Provides visual feedback for active sorting and hover states.
 * 
 * Features:
 * - Column grouping with visual headers
 * - Sortable columns with direction indicators
 * - Responsive design
 * - Accessibility features
 * - Visual feedback for active sorting
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { SortKey, SortDirection } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface TableHeaderProps {
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}

// =============================================================================
// COLUMN CONFIGURATION
// =============================================================================

interface ColumnConfig {
  key: SortKey;
  label: string;
  shortLabel: string;
  group: string;
  sortable: boolean;
  className?: string;
  description: string;
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    key: 'name',
    label: 'Name',
    shortLabel: 'Name',
    group: 'Basic Info',
    sortable: true,
    className: 'border-r border-slate-300',
    description: 'Member name and tag'
  },
  {
    key: 'role',
    label: 'Role',
    shortLabel: 'Role',
    group: 'Basic Info',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Clan role (Leader, Co-Leader, Elder, Member)'
  },
  {
    key: 'th',
    label: 'TH',
    shortLabel: 'TH',
    group: 'Basic Info',
    sortable: true,
    className: 'border-r border-slate-400',
    description: 'Town Hall level'
  },
  {
    key: 'trophies',
    label: 'Trophies',
    shortLabel: 'Trophies',
    group: 'Basic Info',
    sortable: true,
    className: 'text-center border-r border-gray-400',
    description: 'Current trophy count'
  },
  {
    key: 'bk',
    label: 'BK',
    shortLabel: 'BK',
    group: 'Heroes',
    sortable: true,
    className: 'bg-gray-100 text-center border-r border-gray-300',
    description: 'Barbarian King level'
  },
  {
    key: 'aq',
    label: 'AQ',
    shortLabel: 'AQ',
    group: 'Heroes',
    sortable: true,
    className: 'bg-gray-100 text-center border-r border-gray-300',
    description: 'Archer Queen level'
  },
  {
    key: 'mp',
    label: 'MP',
    shortLabel: 'MP',
    group: 'Heroes',
    sortable: true,
    className: 'bg-gray-100 text-center border-r border-gray-300',
    description: 'Master Builder level'
  },
  {
    key: 'gw',
    label: 'GW',
    shortLabel: 'GW',
    group: 'Heroes',
    sortable: true,
    className: 'bg-gray-100 text-center border-r border-gray-300',
    description: 'Grand Warden level'
  },
  {
    key: 'rc',
    label: 'RC',
    shortLabel: 'RC',
    group: 'Heroes',
    sortable: true,
    className: 'bg-gray-100 text-center border-r border-gray-300',
    description: 'Royal Champion level'
  },
  {
    key: 'rush',
    label: 'Hero Rush %',
    shortLabel: 'Hero %',
    group: 'Analysis',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Hero Rush % = average hero shortfall vs Town Hall cap across unlocked heroes (BK/AQ/GW/RC plus MP if available)'
  },
  {
    key: 'activity',
    label: 'Activity',
    shortLabel: 'Activity',
    group: 'Analysis',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Activity level based on recent changes'
  },
  {
    key: 'donations',
    label: 'Given',
    shortLabel: 'Given',
    group: 'Donations',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Donations given this season'
  },
  {
    key: 'donationsReceived',
    label: 'Received',
    shortLabel: 'Received',
    group: 'Donations',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Donations received this season'
  },
  {
    key: 'tenure',
    label: 'Tenure',
    shortLabel: 'Tenure',
    group: 'Stats',
    sortable: true,
    className: 'text-center border-r border-gray-300',
    description: 'Days in clan'
  },
  {
    key: 'actions',
    label: 'Actions',
    shortLabel: 'Actions',
    group: 'Actions',
    sortable: false,
    className: 'text-center',
    description: 'Row actions'
  }
];

// =============================================================================
// GROUP CONFIGURATION
// =============================================================================

interface GroupConfig {
  name: string;
  icon: string;
  columns: number;
  className: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
  {
    name: 'Basic Info',
    icon: '👤',
    columns: 4,
    className: 'border-r border-slate-400'
  },
  {
    name: 'Heroes',
    icon: '⚔️',
    columns: 5,
    className: 'border-r border-slate-400'
  },
  {
    name: 'Analysis',
    icon: '📊',
    columns: 2,
    className: 'border-r border-slate-400'
  },
  {
    name: 'Donations',
    icon: '💝',
    columns: 2,
    className: 'border-r border-slate-400'
  },
  {
    name: 'Stats',
    icon: '📈',
    columns: 1,
    className: ''
  },
  {
    name: '',
    icon: '',
    columns: 1,
    className: ''
  }
];

// =============================================================================
// SORT INDICATOR COMPONENT
// =============================================================================

interface SortIndicatorProps {
  isActive: boolean;
  direction: SortDirection;
}

const SortIndicator: React.FC<SortIndicatorProps> = ({ isActive, direction }) => {
  if (!isActive) {
    return (
      <span className="text-gray-400 ml-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${isActive ? '!text-white' : 'text-blue-600'} ml-1`}>
      {direction === 'asc' ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </span>
  );
};

// =============================================================================
// HEADER CELL COMPONENT
// =============================================================================

interface HeaderCellProps {
  config: ColumnConfig;
  isActive: boolean;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}

const HeaderCell: React.FC<HeaderCellProps> = ({ config, isActive, direction, onSort }) => {
  const handleClick = () => {
    if (config.sortable) {
      onSort(config.key);
    }
  };

  const baseStyles = "py-3 px-4 font-semibold text-blue-800 transition-colors";
  const activeStyles = isActive ? "!bg-blue-800 !border-blue-600 !text-white" : "";
  const hoverStyles = config.sortable ? "hover:bg-blue-50 cursor-pointer" : "cursor-default";
  const sortableStyles = config.sortable ? "cursor-pointer" : "cursor-default";

  return (
    <th
      className={`${baseStyles} ${activeStyles} ${hoverStyles} ${config.className || ''}`}
      style={isActive ? { backgroundColor: '#1e40af', color: '#ffffff', borderColor: '#1d4ed8' } : {}}
      onClick={handleClick}
      title={config.description}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      role="columnheader"
      tabIndex={config.sortable ? 0 : -1}
      onKeyDown={(e) => {
        if (config.sortable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSort(config.key);
        }
      }}
    >
      <div className={`flex items-center ${config.className?.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
        <span className="text-sm">{config.label}</span>
        {config.sortable && (
          <SortIndicator isActive={isActive} direction={direction} />
        )}
      </div>
    </th>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TableHeader: React.FC<TableHeaderProps> = ({
  sortKey,
  sortDirection,
  onSort,
  className = ''
}) => {
  return (
    <thead className={`text-left ${className}`}>
      {/* Grouping Headers Row */}
      <tr className="bg-gradient-to-r from-gray-100 to-gray-200 border-b border-gray-400">
        {GROUP_CONFIGS.map((group, index) => (
          <th
            key={group.name}
            colSpan={group.columns}
            className={`py-2 px-4 font-bold text-blue-800 text-center ${group.className}`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm">{group.icon}</span>
              <span className="text-xs uppercase tracking-wide">{group.name}</span>
            </div>
          </th>
        ))}
      </tr>
      
      {/* Column Headers Row */}
      <tr className="bg-gradient-to-r from-gray-200 to-gray-300 border-b border-gray-400">
        {COLUMN_CONFIGS.map((config) => (
          <HeaderCell
            key={config.key}
            config={config}
            isActive={sortKey === config.key}
            direction={sortDirection}
            onSort={onSort}
          />
        ))}
      </tr>
    </thead>
  );
};

export default TableHeader;
