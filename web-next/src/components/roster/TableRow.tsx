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

// Relative day label for last active - hydration-safe version
const relativeFrom = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  
  // For hydration safety, return a simple format instead of relative dates
  // This avoids server/client time differences
  return d.toISOString().slice(0, 10); // Use ISO format for consistency
};

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return 'N/A';
  // Use simple number formatting to avoid locale differences
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  <td className={`py-2 px-4 text-sm ${className}`} {...rest}>
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
  const store = useDashboardStore();
  const {
    setShowPlayerProfile,
    setSelectedPlayer,
    setShowDepartureModal,
    setSelectedMember,
    loadRoster,
    clanTag: storeClanTag,
    homeClan,
  } = store;
  const clanTagForActions = roster.clanTag || storeClanTag || homeClan || '';
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
    border-b border-gray-300 last:border-0 transition-colors duration-150 
    hover:bg-gray-50 cursor-pointer focus:bg-gray-100
    ${index % 2 === 1 ? "bg-gray-50" : "bg-white"}
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
              <TableCell className="border-r border-gray-300">
                <div className="flex items-center space-x-3">
                  <LeagueBadge trophies={member.trophies} size="xxl" showText={false} />
                  <div className="flex flex-col">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProfile();
                      }}
                      className="font-heading font-semibold text-blue-800 dark:!text-white hover:text-blue-600 dark:hover:!text-gray-200 transition-colors focus-ring-inset text-left"
                      style={{
                        color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                      }}
                      title="View player profile"
                    >
                      {member.name}
                    </button>
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
                  let bgCls = 'bg-gray-800';
                  let textCls = '!text-white';
                  let borderCls = 'border-gray-700';

                  if (r === 'leader') {
                    label = 'Leader';
                    icon = '👑';
                    bgCls = 'bg-white';
                    textCls = '!text-black';
                    borderCls = 'border-gray-400';
                  } else if (r === 'coleader' || raw === 'coLeader') {
                    label = 'Co-leader';
                    icon = '💎';
                    bgCls = 'bg-purple-700';
                    textCls = '!text-white';
                    borderCls = 'border-purple-800';
                  } else if (r === 'elder' || r === 'admin') {
                    label = 'Elder';
                    icon = '⭐';
                    bgCls = 'bg-blue-700';
                    textCls = '!text-white';
                    borderCls = 'border-blue-800';
                  }

                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${bgCls} ${borderCls}`}>
                      {icon && <span aria-hidden className="text-xs">{icon}</span>}
                      <span 
                        className={textCls}
                        style={{
                          color: r === 'leader' ? '#000000' : '#ffffff'
                        }}
                      >
                        {label}
                      </span>
                    </span>
                  );
                })()}
              </TableCell>

              {/* Town Hall Column */}
              <TableCell className="text-center border-r border-slate-600/50">
                <div className="flex items-center justify-center space-x-2">
                  <TownHallBadge level={th} size="md" showLevel={false} showBox={false} />
                  <span className="text-sm font-bold text-clash-gold">
                    {th}
                  </span>
                </div>
              </TableCell>

      {/* Trophies Column */}
      <TableCell className="text-center border-r border-slate-600/50" title="Current trophies">
        <div className="flex items-center justify-center space-x-1">
          <span className="text-clash-gold">🏆</span>
          <span className="font-semibold">
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
        className="text-center border-r border-gray-300"
        title={isHeroAvailable('bk', th)
          ? `Barbarian King at TH${th} (max ${HERO_MAX_LEVELS[th]?.bk ?? 0})`
          : `Barbarian King unlocks at TH${HERO_MIN_TH.bk}`}
      >
        <HeroLevel 
          hero="BK" 
          level={member.bk || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.bk || 0}
          size="sm"
          showName={false}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        title={isHeroAvailable('aq', th)
          ? `Archer Queen at TH${th} (max ${HERO_MAX_LEVELS[th]?.aq ?? 0})`
          : `Archer Queen unlocks at TH${HERO_MIN_TH.aq}`}
      >
        <HeroLevel 
          hero="AQ" 
          level={member.aq || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.aq || 0}
          size="sm"
          showName={false}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        title={isHeroAvailable('gw', th)
          ? `Grand Warden at TH${th} (max ${HERO_MAX_LEVELS[th]?.gw ?? 0})`
          : `Grand Warden unlocks at TH${HERO_MIN_TH.gw}`}
      >
        <HeroLevel 
          hero="GW" 
          level={member.gw || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.gw || 0}
          size="sm"
          showName={false}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        title={isHeroAvailable('rc', th)
          ? `Royal Champion at TH${th} (max ${HERO_MAX_LEVELS[th]?.rc ?? 0})`
          : `Royal Champion unlocks at TH${HERO_MIN_TH.rc}`}
      >
        <HeroLevel 
          hero="RC" 
          level={member.rc || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.rc || 0}
          size="sm"
          showName={false}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        title={isHeroAvailable('mp', th)
          ? `Minion Prince at TH${th} (max ${HERO_MAX_LEVELS[th]?.mp ?? 0})`
          : `Minion Prince unlocks at TH${HERO_MIN_TH.mp}`}
      >
        <HeroLevel 
          hero="MP" 
          level={member.mp || 0} 
          maxLevel={HERO_MAX_LEVELS[th]?.mp || 0}
          size="sm"
          showName={false}
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
      <TableCell className="text-center border-r border-slate-600/50" title={`Donations given/received: ${formatNumber(donationBalance.given)} / ${formatNumber(donationBalance.received)} (balance ${donationBalance.isNegative ? '+' : ''}${donationBalance.balance})`}>
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
                  body: JSON.stringify({ clanTag: clanTagForActions, memberTag: member.tag, mode: 'grant-existing' })
                });
                const payload = await res.json().catch(() => null);
                if (!res.ok) {
                  const message = payload?.error || payload?.message || 'Failed to grant tenure';
                  throw new Error(message);
                }
                showToast('Granted prior tenure', 'success');
                if (clanTagForActions) {
                  await loadRoster(clanTagForActions);
                }
              } catch (error: any) {
                const message = error?.message || 'Failed to grant tenure';
                showToast(message, 'error');
              }
            }}
            onEditTenure={async (e) => {
              e.stopPropagation();
              const current = Number(member.tenure_days ?? member.tenure ?? 0) || 0;
              const input = typeof window !== 'undefined'
                ? window.prompt('Set tenure in days (0-20000)', String(current))
                : null;
              if (input === null) return;
              const trimmed = input.trim();
              const match = trimmed.match(/\d+/);
              if (!match) {
                showToast('Please enter a valid number of days', 'error');
                return;
              }
              const days = Math.max(0, Math.min(20000, Number.parseInt(match[0], 10)));
              try {
                const res = await fetch('/api/tenure/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: [{ tag: member.tag, tenure_days: days }] }),
                });
                const payload = await res.json().catch(() => null);
                if (!res.ok) {
                  const message = payload?.error || payload?.message || 'Failed to update tenure';
                  throw new Error(message);
                }
                showToast(`Tenure updated to ${days} day${days === 1 ? '' : 's'}`, 'success');
                if (clanTagForActions) {
                  await loadRoster(clanTagForActions);
                }
              } catch (error: any) {
                const message = error?.message || 'Failed to update tenure';
                showToast(message, 'error');
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
  onEditTenure: (e: React.MouseEvent) => void;
}> = ({ onViewProfile, onCopyTag, onDeparture, onGrantTenure, onEditTenure }) => {
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
        className="actions-menu-trigger px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 focus:outline-none"
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="actions-menu-panel absolute right-0 mt-2 min-w-[12rem] whitespace-nowrap bg-white border border-slate-200 rounded-md shadow-xl ring-1 ring-black/5 z-[1000] overflow-hidden">
          <button onClick={(e) => { onViewProfile(e); setOpen(false); }} className="actions-menu-item block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">View Profile</button>
          <button onClick={(e) => { onCopyTag(e); setOpen(false); }} className="actions-menu-item block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Copy Tag</button>
          <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
            <button onClick={(e) => { onDeparture(e); setOpen(false); }} className="actions-menu-item block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Record Departure</button>
            <button onClick={(e) => { onGrantTenure(e); setOpen(false); }} className="actions-menu-item block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Grant Tenure</button>
            <button onClick={(e) => { onEditTenure(e); setOpen(false); }} className="actions-menu-item block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Edit Tenure</button>
          </LeadershipGuard>
        </div>
      )}
    </div>
  );
};

export default TableRow;
