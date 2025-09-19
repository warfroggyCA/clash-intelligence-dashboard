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

import React, { useState } from 'react';
import { Member, Roster } from '@/types';
import { safeLocaleDateString } from '@/lib/date';
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
import { HERO_MAX_LEVELS, HERO_MIN_TH, HeroCaps } from '@/types';
import { getHeroDisplayValue, isHeroAvailable } from '@/lib/business/calculations';
import { Button, TownHallBadge, LeagueBadge, ResourceDisplay, HeroLevel } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { showToast } from '@/lib/toast';

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
  const l = level.toLowerCase();
  if (l === 'very active') return 'bg-green-100 text-green-800';
  if (l === 'active') return 'bg-blue-100 text-blue-800';
  if (l === 'moderate') return 'bg-yellow-100 text-yellow-800';
  if (l === 'low') return 'bg-orange-100 text-orange-800';
  if (l === 'inactive') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
};

// Short labels for activity
const getActivityShortLabel = (level: string): string => {
  const l = level.toLowerCase();
  if (l === 'very active') return 'High';
  if (l === 'active') return 'Med';
  if (l === 'moderate') return 'Med';
  if (l === 'low') return 'Low';
  if (l === 'inactive') return 'Inactive';
  return level;
};

// Relative day label for last active
const relativeFrom = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const then = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.floor((start - then) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
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

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

const TableCell: React.FC<TableCellProps> = ({ className = '', children, ...rest }) => (
  <td className={`py-3 px-4 text-sm text-high-contrast ${className}`} {...rest}>
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
  const { setShowPlayerProfile, setSelectedPlayer, setShowDepartureModal, setSelectedMember } = useDashboardStore();
  // Calculate member metrics
  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const overallRush = calculateOverallRush(member);
  const activity = calculateActivityScore(member);
  const isRushedPlayer = isRushed(member);
  const isVeryRushedPlayer = isVeryRushed(member);
  const isNetReceiverPlayer = isNetReceiver(member);
  const isLowDonatorPlayer = isLowDonator(member);

  // Handle member actions
  const handleOpenProfile = () => {
    setSelectedPlayer(member);
    setShowPlayerProfile(true);
  };

  const handleQuickDeparture = () => {
    setSelectedMember(member);
    setShowDepartureModal(true);
  };

  // Row styling with enhanced accessibility
  const rowStyles = `
    border-b border-slate-700/50 last:border-0 transition-colors duration-150 
    hover:bg-clash-gold/5 cursor-pointer focus:bg-clash-gold/10
    ${index % 2 === 1 ? "bg-slate-800/30" : "bg-slate-800/20"}
  `;

  return (
    <tr 
      className={`${rowStyles} ${className}`} 
      onClick={handleOpenProfile}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenProfile();
        }
      }}
      aria-label={`View profile for ${member.name}, ${member.role}, Town Hall ${th}`}
    >
              {/* Name Column */}
              <TableCell className="border-r border-slate-600/50">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <LeagueBadge trophies={member.trophies} size="xl" showText={false} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProfile();
                        }}
                        className="font-heading font-semibold text-clash-gold hover:text-clash-orange transition-colors focus-ring-inset text-left"
                        title="View player profile"
                      >
                        {member.name}
                      </button>
                    </div>
                    <span className="text-xs text-muted-contrast font-mono">
                      {member.tag}
                    </span>
                  </div>
                </div>
              </TableCell>

              {/* Role Column */}
              <TableCell className="text-center border-r border-slate-600/50">
                {(() => {
                  const raw = (member.role || '').toString();
                  const r = raw.toLowerCase();
                  let label = 'Member';
                  let icon = '';
                  let cls = 'bg-slate-700/50 text-slate-300 border-slate-600/50';

                  if (r === 'leader') {
                    label = 'Leader';
                    icon = '👑';
                    cls = 'bg-clash-gold/20 text-clash-gold border-clash-gold/50';
                  } else if (r === 'coleader' || raw === 'coLeader') {
                    label = 'Co-leader';
                    icon = '💎';
                    cls = 'bg-clash-purple/20 text-clash-purple border-clash-purple/50';
                  } else if (r === 'elder' || r === 'admin') {
                    label = 'Elder';
                    icon = '⭐';
                    cls = 'bg-clash-blue/20 text-clash-blue border-clash-blue/50';
                  }

                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold border ${cls}`}>
                      {icon && <span aria-hidden>{icon}</span>}
                      <span>{label}</span>
                    </span>
                  );
                })()}
              </TableCell>

              {/* Town Hall Column */}
              <TableCell className="text-center border-r border-slate-600/50">
                <div className="flex items-center justify-center space-x-2">
                  <TownHallBadge level={th} size="sm" showLevel={false} />
                  <span className="text-2xl font-bold text-clash-gold">
                    {th}
                  </span>
                </div>
              </TableCell>

      {/* Trophies Column */}
      <TableCell className="text-center border-r border-slate-600/50" title="Current trophies">
        <div className="flex items-center justify-center space-x-1">
          <span className="text-clash-gold">🏆</span>
          <span className="font-semibold text-high-contrast">
            {formatNumber(member.trophies)}
          </span>
          {isRushedPlayer && (
            <span className="text-xs text-clash-red" title={`Rushed: ${rushPercent}%`}>
              {isVeryRushedPlayer ? '🔴' : '⚠️'}
            </span>
          )}
        </div>
      </TableCell>


      {/* Hero Columns */}
      <TableCell
        className="bg-slate-800/30 text-center border-r border-slate-600/50"
        title={isHeroAvailable('bk', th)
          ? `Barbarian King at TH${th} (max ${HERO_MAX_LEVELS[th]?.bk ?? 0})`
          : `Barbarian King unlocks at TH${HERO_MIN_TH.bk}`}
      >
        <HeroLevel 
          hero="BK" 
          level={member.bk || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.bk || 0}
          size="sm"
        />
      </TableCell>

      <TableCell
        className="bg-slate-800/30 text-center border-r border-slate-600/50"
        title={isHeroAvailable('aq', th)
          ? `Archer Queen at TH${th} (max ${HERO_MAX_LEVELS[th]?.aq ?? 0})`
          : `Archer Queen unlocks at TH${HERO_MIN_TH.aq}`}
      >
        <HeroLevel 
          hero="AQ" 
          level={member.aq || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.aq || 0}
          size="sm"
        />
      </TableCell>

      <TableCell
        className="bg-slate-800/30 text-center border-r border-slate-600/50"
        title={isHeroAvailable('gw', th)
          ? `Grand Warden at TH${th} (max ${HERO_MAX_LEVELS[th]?.gw ?? 0})`
          : `Grand Warden unlocks at TH${HERO_MIN_TH.gw}`}
      >
        <HeroLevel 
          hero="GW" 
          level={member.gw || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.gw || 0}
          size="sm"
        />
      </TableCell>

      <TableCell
        className="bg-slate-800/30 text-center border-r border-slate-600/50"
        title={isHeroAvailable('rc', th)
          ? `Royal Champion at TH${th} (max ${HERO_MAX_LEVELS[th]?.rc ?? 0})`
          : `Royal Champion unlocks at TH${HERO_MIN_TH.rc}`}
      >
        <HeroLevel 
          hero="RC" 
          level={member.rc || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.rc || 0}
          size="sm"
        />
      </TableCell>

      <TableCell
        className="bg-slate-800/30 text-center border-r border-slate-600/50"
        title={isHeroAvailable('mp', th)
          ? `Mighty Patroller at TH${th} (max ${HERO_MAX_LEVELS[th]?.mp ?? 0})`
          : `Mighty Patroller unlocks at TH${HERO_MIN_TH.mp}`}
      >
        <HeroLevel 
          hero="MP" 
          level={member.mp || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.mp || 0}
          size="sm"
        />
      </TableCell>

      {/* Rush Percentage Column */}
      <TableCell className="text-center border-r border-slate-600/50"
        title={`Rush is how far heroes are from TH caps. BK ${member.bk ?? 0}/${HERO_MAX_LEVELS[th]?.bk ?? 0}, AQ ${member.aq ?? 0}/${HERO_MAX_LEVELS[th]?.aq ?? 0}, GW ${member.gw ?? 0}/${HERO_MAX_LEVELS[th]?.gw ?? 0}, RC ${member.rc ?? 0}/${HERO_MAX_LEVELS[th]?.rc ?? 0}.`}
      >
        <span className={`font-semibold ${rushPercent >= 70 ? 'text-clash-red' : rushPercent >= 40 ? 'text-clash-orange' : 'text-clash-green'}`}>
          {rushPercent.toFixed(1)}%
        </span>
      </TableCell>

      {/* Overall Rush (placeholder) */}
      <TableCell className="text-center border-r border-slate-600/50" title="Overall rush (heroes for now; offense/defense later)">
        <span className={`font-semibold ${overallRush >= 70 ? 'text-clash-red' : overallRush >= 40 ? 'text-clash-orange' : 'text-clash-green'}`}>
          {overallRush.toFixed(1)}%
        </span>
      </TableCell>

      {/* Activity Column (under Analysis group) */}
      <TableCell className="text-center border-r border-slate-600/50">
        <div className="flex flex-col items-center space-y-1">
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold border ${
              activity.level.toLowerCase() === 'very active' ? 'bg-clash-green/20 text-clash-green border-clash-green/50' :
              activity.level.toLowerCase() === 'active' ? 'bg-clash-blue/20 text-clash-blue border-clash-blue/50' :
              activity.level.toLowerCase() === 'moderate' ? 'bg-clash-orange/20 text-clash-orange border-clash-orange/50' :
              activity.level.toLowerCase() === 'low' ? 'bg-clash-orange/20 text-clash-orange border-clash-orange/50' :
              'bg-clash-red/20 text-clash-red border-clash-red/50'
            }`}
            title={
              `Activity rating\n` +
              `High: lots of recent evidence (donations/attacks/etc.)\n` +
              `Med: some recent evidence\n` +
              `Low: little recent evidence\n` +
              `Inactive: no recent evidence`
            }
          >
            {getActivityShortLabel(activity.level)}
          </span>
        </div>
      </TableCell>

      {/* Donations Given Column */}
      <TableCell className="text-center border-r border-slate-600/50" title={`Donations given/received: ${(donationBalance.given).toLocaleString()} / ${(donationBalance.received).toLocaleString()} (balance ${donationBalance.isNegative ? '+' : ''}${donationBalance.balance})`}>
        <div className="flex items-center justify-center space-x-1">
          <span className="text-clash-green">💝</span>
          <span className="font-semibold text-clash-green">{formatNumber(member.donations)}</span>
        </div>
      </TableCell>

      {/* Donations Received Column */}
      <TableCell className="text-center border-r border-slate-600/50" title={`Donations received: ${formatNumber(member.donationsReceived)} (net ${donationBalance.isNegative ? '+' : ''}${donationBalance.balance})`}>
        <div className="flex items-center justify-center space-x-1">
          <span className="text-clash-blue">📥</span>
          <span className="font-semibold text-clash-blue">{formatNumber(member.donationsReceived)}</span>
        </div>
      </TableCell>

      {/* Tenure Column */}
      <TableCell className="text-center border-r border-slate-300">
        <span
          className="font-semibold"
          title={member.tenure_as_of
            ? `Tenure last set: ${safeLocaleDateString(member.tenure_as_of, {
                fallback: 'Unknown Date',
                context: 'RosterTableRow member.tenure_as_of'
              })}`
            : 'Tenure accrues daily from join or last set date'}
        >
          {formatDays(member.tenure_days || member.tenure)}
        </span>
      </TableCell>


      {/* Actions Menu */}
      <TableCell className="text-center">
        <div className="relative inline-block text-left">
          <ActionsMenu 
            onViewProfile={(e) => { e.stopPropagation(); handleOpenProfile(); }}
            onCopyTag={(e) => { e.stopPropagation(); navigator.clipboard.writeText(member.tag).then(() => showToast('Tag copied','success')).catch(() => showToast('Copy failed','error')); }}
            onDeparture={(e) => { e.stopPropagation(); handleQuickDeparture(); }}
            onGrantTenure={async (e) => {
              e.stopPropagation();
              try {
                const res = await fetch('/api/tenure/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clanTag: roster.clanTag || '', memberTag: member.tag, mode: 'grant-existing' })
                });
                if (res.ok) showToast('Granted prior tenure','success'); else showToast('Failed to grant tenure','error');
              } catch {
                showToast('Failed to grant tenure','error');
              }
            }}
          />
        </div>
      </TableCell>
    </tr>
  );
};

// Simple actions dropdown
const ActionsMenu: React.FC<{
  onViewProfile: (e: React.MouseEvent) => void;
  onCopyTag: (e: React.MouseEvent) => void;
  onDeparture: (e: React.MouseEvent) => void;
  onGrantTenure: (e: React.MouseEvent) => void;
}> = ({ onViewProfile, onCopyTag, onDeparture, onGrantTenure }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 focus:outline-none"
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-2 min-w-[12rem] whitespace-nowrap bg-white border border-slate-200 rounded-md shadow-xl ring-1 ring-black/5 z-[1000] overflow-hidden">
          <button onClick={(e) => { onViewProfile(e); setOpen(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">View Profile</button>
          <button onClick={(e) => { onCopyTag(e); setOpen(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Copy Tag</button>
          <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
            <button onClick={(e) => { onDeparture(e); setOpen(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Record Departure</button>
            <button onClick={(e) => { onGrantTenure(e); setOpen(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Grant Tenure</button>
          </LeadershipGuard>
        </div>
      )}
    </div>
  );
};

export default TableRow;
