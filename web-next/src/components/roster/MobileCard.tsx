/**
 * MobileCard Component
 * 
 * Mobile-optimized card layout for displaying member data on small screens.
 * Provides a compact, touch-friendly interface with all essential information.
 * 
 * Features:
 * - Compact card layout for mobile devices
 * - Touch-friendly interactions
 * - Essential member information display
 * - Status indicators and badges
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

export interface MobileCardProps {
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
// MAIN COMPONENT
// =============================================================================

export const MobileCard: React.FC<MobileCardProps> = ({
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
    console.log('Open profile for:', member.name);
  };

  const handleQuickDeparture = () => {
    console.log('Quick departure for:', member.name);
  };

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}
      onClick={handleOpenProfile}
    >
      {/* Header with Name and Role */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">
            {member.name}
          </h3>
          <p className="text-sm text-gray-500 font-mono">
            {member.tag}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            member.role === 'leader' ? 'bg-purple-100 text-purple-800' :
            member.role === 'coleader' ? 'bg-blue-100 text-blue-800' :
            member.role === 'elder' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
          </span>
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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Town Hall */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">TH:</span>
          <span className="font-semibold">TH{th}</span>
          {isRushedPlayer && (
            <span className="text-xs" title={`Rushed: ${rushPercent}%`}>
              {isVeryRushedPlayer ? '🔴' : '🟡'}
            </span>
          )}
        </div>

        {/* Trophies */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">Trophies:</span>
          <span className="font-semibold">{formatNumber(member.trophies)}</span>
        </div>

        {/* Donations Given */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">Given:</span>
          <span className="font-semibold text-green-700">
            {formatNumber(member.donations)}
          </span>
          {isLowDonatorPlayer && (
            <span className="text-xs text-red-600" title="Low donator">
              ⚠️
            </span>
          )}
        </div>

        {/* Donations Received */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">Received:</span>
          <span className="font-semibold text-blue-700">
            {formatNumber(member.donationsReceived)}
          </span>
          {isNetReceiverPlayer && (
            <span className="text-xs text-orange-600" title="Net receiver">
              📥
            </span>
          )}
        </div>

        {/* Tenure */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">Tenure:</span>
          <span className="font-semibold">
            {formatDays(member.tenure_days || member.tenure)}
          </span>
        </div>

        {/* Activity */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">Activity:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActivityClass(activity.level)}`}>
            {activity.level}
          </span>
        </div>
      </div>

      {/* Hero Levels */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Heroes:</span>
          <div className="flex items-center space-x-3 text-sm">
            {member.bk && (
              <div className="text-center">
                <div className="font-semibold">BK</div>
                <div>{member.bk}</div>
              </div>
            )}
            {member.aq && (
              <div className="text-center">
                <div className="font-semibold">AQ</div>
                <div>{member.aq}</div>
              </div>
            )}
            {member.gw && (
              <div className="text-center">
                <div className="font-semibold">GW</div>
                <div>{member.gw}</div>
              </div>
            )}
            {member.rc && (
              <div className="text-center">
                <div className="font-semibold">RC</div>
                <div>{member.rc}</div>
              </div>
            )}
            {member.mp && (
              <div className="text-center">
                <div className="font-semibold">MP</div>
                <div>{member.mp}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          {isRushedPlayer && (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              isVeryRushedPlayer 
                ? 'bg-red-100 text-red-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isVeryRushedPlayer ? 'Very Rushed' : 'Rushed'} ({rushPercent.toFixed(1)}%)
            </span>
          )}
          {isNetReceiverPlayer && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
              Net Receiver
            </span>
          )}
          {isLowDonatorPlayer && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              Low Donator
            </span>
          )}
          {activity.last_active_at && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Last: {activity.last_active_at ? new Date(activity.last_active_at).toLocaleDateString() : 'Unknown'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileCard;
