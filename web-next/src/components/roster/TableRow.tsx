/**
 * TableRow Component
 * 
 * Individual table row component for displaying member data.
 * Handles member statistics, hero levels, and interactive actions.
 * 
 * Features:
 * - Comprehensive member data display
 * - Hero level visualization
 * - Rush percentage calculation
 * - Activity level indicators
 * - Interactive actions (profile, departure)
 * - Responsive design
 * - Accessibility features
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { Member, Roster } from '@/types';
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
import { Button } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';

// =============================================================================
// TYPES
// =============================================================================

export interface TableRowProps {
  member: Member;
  index: number;
  roster: Roster;
  className?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const getRushClass = (rushPercent: number): string => {
  if (rushPercent >= 70) return "text-red-700 font-semibold";
  if (rushPercent >= 40) return "text-amber-600";
  return "text-green-700";
};

const getActivityClass = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'very active':
      return 'bg-green-100 text-green-800';
    case 'active':
      return 'bg-blue-100 text-blue-800';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-orange-100 text-orange-800';
    case 'inactive':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return 'N/A';
  return num.toLocaleString();
};

const formatDays = (days: number | undefined): string => {
  if (days === undefined || days === null) return 'N/A';
  if (days === 0) return 'New';
  if (days === 1) return '1 day';
  return `${days} days`;
};

// =============================================================================
// CELL COMPONENTS
// =============================================================================

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

const TableCell: React.FC<TableCellProps> = ({ className = '', children }) => (
  <td className={`py-3 px-4 ${className}`}>
    {children}
  </td>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TableRow: React.FC<TableRowProps> = ({
  member,
  index,
  roster,
  className = ''
}) => {
  // Calculate member metrics
  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const isRushedPlayer = isRushed(member);
  const isVeryRushedPlayer = isVeryRushed(member);
  const isNetReceiverPlayer = isNetReceiver(member);
  const isLowDonatorPlayer = isLowDonator(member);

  // Handle member actions
  const handleOpenProfile = () => {
    // This would be handled by the parent component
    console.log('Open profile for:', member.name);
  };

  const handleQuickDeparture = () => {
    // This would be handled by the parent component
    console.log('Quick departure for:', member.name);
  };

  // Row styling
  const rowStyles = `
    border-b border-slate-100 last:border-0 transition-all duration-200 
    hover:bg-blue-50/50 hover:scale-[1.01] hover:shadow-md cursor-pointer
    ${index % 2 === 1 ? "bg-slate-50/50" : "bg-white/50"}
  `;

  return (
    <tr className={`${rowStyles} ${className}`} onClick={handleOpenProfile}>
      {/* Name Column */}
      <TableCell className="border-r border-slate-300">
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenProfile();
            }}
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
            title="View player profile"
          >
            {member.name}
          </button>
          <span className="text-xs text-gray-500 font-mono">
            {member.tag}
          </span>
        </div>
      </TableCell>

      {/* Role Column */}
      <TableCell className="text-center border-r border-slate-300">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
          member.role === 'leader' ? 'bg-purple-100 text-purple-800' :
          member.role === 'coleader' ? 'bg-blue-100 text-blue-800' :
          member.role === 'elder' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
        </span>
      </TableCell>

      {/* Town Hall Column */}
      <TableCell className="border-r border-slate-400">
        <div className="flex items-center space-x-1">
          <span className="font-semibold">TH{th}</span>
          {isRushedPlayer && (
            <span className="text-xs text-red-600" title={`Rushed: ${rushPercent}%`}>
              {isVeryRushedPlayer ? '🔴' : '🟡'}
            </span>
          )}
        </div>
      </TableCell>

      {/* Hero Columns */}
      <TableCell className="bg-slate-100 text-center border-r border-slate-300">
        <span className="font-semibold">
          {member.bk || 'N/A'}
        </span>
      </TableCell>

      <TableCell className="bg-slate-100 text-center border-r border-slate-300">
        <span className="font-semibold">
          {member.aq || 'N/A'}
        </span>
      </TableCell>

      <TableCell className="bg-slate-100 text-center border-r border-slate-300">
        <span className="font-semibold">
          {member.gw || 'N/A'}
        </span>
      </TableCell>

      <TableCell className="bg-slate-100 text-center border-r border-slate-300">
        <span className="font-semibold">
          {member.rc || 'N/A'}
        </span>
      </TableCell>

      <TableCell className="bg-slate-100 text-center border-r border-slate-400">
        <span className="font-semibold">
          {member.mp || 'N/A'}
        </span>
      </TableCell>

      {/* Rush Percentage Column */}
      <TableCell className="text-center border-r border-slate-300">
        <span className={`font-semibold ${getRushClass(rushPercent)}`}>
          {rushPercent.toFixed(1)}%
        </span>
      </TableCell>

      {/* Trophies Column */}
      <TableCell className="text-center border-r border-slate-300">
        <span className="font-semibold">
          {formatNumber(member.trophies)}
        </span>
      </TableCell>

      {/* Donations Given Column */}
      <TableCell className="text-center border-r border-slate-300">
        <div className="flex flex-col items-center">
          <span className="font-semibold text-green-700">
            {formatNumber(member.donations)}
          </span>
          {isLowDonatorPlayer && (
            <span className="text-xs text-red-600" title="Low donator">
              ⚠️
            </span>
          )}
        </div>
      </TableCell>

      {/* Donations Received Column */}
      <TableCell className="text-center border-r border-slate-300">
        <div className="flex flex-col items-center">
          <span className="font-semibold text-blue-700">
            {formatNumber(member.donationsReceived)}
          </span>
          {isNetReceiverPlayer && (
            <span className="text-xs text-orange-600" title="Net receiver">
              📥
            </span>
          )}
        </div>
      </TableCell>

      {/* Tenure Column */}
      <TableCell className="text-center border-r border-slate-300">
        <span className="font-semibold">
          {formatDays(member.tenure_days || member.tenure)}
        </span>
      </TableCell>

      {/* Activity Column */}
      <TableCell className="text-center">
        <div className="flex flex-col items-center space-y-1">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActivityClass(activity.level)}`}>
            {activity.level}
          </span>
          {activity.last_active_at && (
            <span className="text-xs text-gray-500">
              {new Date(activity.last_active_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </TableCell>

      {/* Action Buttons */}
      <TableCell className="text-center">
        <div className="flex items-center justify-center space-x-2">
          <LeadershipGuard
            requiredPermission="canModifyClanData"
            fallback={null}
          >
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickDeparture();
              }}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-300 hover:bg-red-50"
              title="Record departure"
            >
              📤
            </Button>
          </LeadershipGuard>
        </div>
      </TableCell>
    </tr>
  );
};

export default TableRow;
