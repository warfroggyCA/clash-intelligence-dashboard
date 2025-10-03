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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Member, Roster, SortKey } from '@/types';
import { safeLocaleDateString } from '@/lib/date';
import { 
  calculateRushPercentage, 
  calculateDonationBalance, 
  calculateActivityScore,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
  isNetReceiver,
  isLowDonator,
  getMemberAceScore,
  getMemberAceAvailability
} from '@/lib/business/calculations';
import type { AceScoreResult } from '@/lib/ace-score';
import { HERO_MAX_LEVELS, HERO_MIN_TH, HeroCaps } from '@/types';
import { getHeroDisplayValue, isHeroAvailable } from '@/lib/business/calculations';
import { Button, TownHallBadge, LeagueBadge, ResourceDisplay, HeroLevel, Modal } from '@/components/ui';
import { normalizeTag } from '@/lib/tags';
import { getRoleBadgeVariant } from '@/lib/leadership';
import LeadershipGuard from '@/components/LeadershipGuard';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { showToast } from '@/lib/toast';
import { resolveMemberLeague } from '@/lib/member-league';

// =============================================================================
// TYPES
// =============================================================================

export interface TableRowProps {
  member: Member;
  index: number;
  roster: Roster;
  activeSortKey: SortKey;
  aceScoresByTag: Map<string, AceScoreResult> | null;
  className?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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

const HERO_LABELS: Record<keyof HeroCaps, string> = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
};

const HERO_SHORT_LABELS: Record<keyof HeroCaps, string> = {
  bk: 'BK',
  aq: 'AQ',
  gw: 'GW',
  rc: 'RC',
  mp: 'MP',
};

interface HeroBreakdownRow {
  hero: keyof HeroCaps;
  current: number;
  cap: number;
  deficit: number;
  deficitPct: number;
}

const formatHeroLine = (
  hero: keyof HeroCaps,
  current: number,
  cap: number
): string => {
  const deficit = Math.max(0, cap - current);
  const deficitPct = cap > 0 ? (deficit / cap) * 100 : 0;
  const shortLabel = HERO_SHORT_LABELS[hero];
  const deficitLabel = deficit === 1 ? '1 level' : `${deficit} levels`;
  return `${shortLabel}: ${current}/${cap} (behind ${deficitLabel}, ${deficitPct.toFixed(1)}%)`;
};

// =============================================================================
// CELL COMPONENTS
// =============================================================================

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
  isActiveSort?: boolean;
}

const ACTIVE_SORT_CELL_CLASSES = `relative bg-slate-800/20 transition-colors dark:bg-slate-700/40`;

const TableCell: React.FC<TableCellProps> = ({ className = '', children, isActiveSort = false, title, ...rest }) => {
  const tooltipClass = title ? 'tooltip-trigger' : '';
  const mergedClassName = `py-2 px-4 text-sm ${className} ${isActiveSort ? ACTIVE_SORT_CELL_CLASSES : ''} ${tooltipClass}`.trim();

  return (
    <td
      className={mergedClassName}
      data-active-sort={isActiveSort ? 'true' : undefined}
      data-tooltip={title ?? undefined}
      {...rest}
    >
      {children}
    </td>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TableRow: React.FC<TableRowProps> = ({
  member,
  index,
  roster,
  activeSortKey,
  aceScoresByTag,
  className = ''
}) => {
  const store = useDashboardStore();
  const {
    setShowDepartureModal,
    setSelectedMember,
    loadRoster,
    clanTag: storeClanTag,
    homeClan,
  } = store;
  const router = useRouter();
  const clanTagForActions = roster.clanTag || storeClanTag || homeClan || '';
  // Calculate member metrics
  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const isRushedPlayer = isRushed(member);
  const isVeryRushedPlayer = isVeryRushed(member);
  const isNetReceiverPlayer = isNetReceiver(member);
  const isLowDonatorPlayer = isLowDonator(member);
  const currentTenureDays = useMemo(() => Number(member.tenure_days ?? member.tenure ?? 0) || 0, [member.tenure_days, member.tenure]);
  const [isTenureEditorOpen, setTenureEditorOpen] = useState(false);
  const [tenureEditorValue, setTenureEditorValue] = useState(() => String(currentTenureDays));
  const [isUpdatingTenure, setIsUpdatingTenure] = useState(false);
  const updateLocalTenure = useCallback((days: number, asOf?: string) => {
    useDashboardStore.setState((state) => {
      if (!state.roster) return {};
      const members = state.roster.members.map((m) =>
        normalizeTag(m.tag) === normalizeTag(member.tag)
          ? { ...m, tenure_days: days, tenure_as_of: asOf ?? m.tenure_as_of }
          : m
      );
      return { roster: { ...state.roster, members } } as Partial<typeof state>;
    });
  }, [member.tag]);

  useEffect(() => {
    if (isTenureEditorOpen) {
      setTenureEditorValue(String(currentTenureDays));
    }
  }, [isTenureEditorOpen, currentTenureDays]);

  const heroCaps = HERO_MAX_LEVELS[th] || {};
  const isActiveColumn = (key: SortKey) => activeSortKey === key;
  const getDisplayMax = (hero: keyof HeroCaps) => {
    const baseCap = heroCaps?.[hero] ?? 0;
    const raw = member[hero];
    const value = typeof raw === 'number' ? Math.max(raw, 0) : 0;
    return Math.max(baseCap || 0, value);
  };
  const getHeroTooltipMessage = (hero: keyof HeroCaps) => {
    const heroName = HERO_LABELS[hero];
    if (!isHeroAvailable(hero, th)) {
      return `${heroName} unlocks at TH${HERO_MIN_TH[hero]}`;
    }
    const raw = member[hero];
    const current = typeof raw === 'number' ? Math.max(raw, 0) : 0;
    const displayedCap = Math.max(heroCaps?.[hero] ?? 0, current);
    return `${heroName} level ${current} of ${displayedCap} (TH${th})`;
  };
  const leagueInfo = resolveMemberLeague(member);

  const aceExtras = (member as any)?.extras?.ace ?? null;
  const aceEntry = useMemo(() => {
    if (!aceScoresByTag) return null;
    const rawTag = member.tag ?? '';
    if (!rawTag) return null;
    const normalized = rawTag.replace(/^#/, '');
    return (
      aceScoresByTag.get(rawTag) ||
      aceScoresByTag.get(rawTag.toUpperCase()) ||
      aceScoresByTag.get(normalized) ||
      aceScoresByTag.get(normalized.toUpperCase()) ||
      null
    );
  }, [aceScoresByTag, member.tag]);

  const aceScoreFromEntry = typeof aceEntry?.ace === 'number' ? aceEntry.ace : null;
  const aceScore = aceScoreFromEntry ?? getMemberAceScore(member);

  const aceAvailabilityFromEntry = typeof aceEntry?.availability === 'number' ? aceEntry.availability : null;
  const aceAvailability = aceAvailabilityFromEntry ?? getMemberAceAvailability(member);
  const aceAvailabilityPercent = typeof aceAvailability === 'number'
    ? Math.round(Math.max(0, Math.min(aceAvailability, 1)) * 100)
    : null;

  const logisticFromEntry = (() => {
    if (aceScoreFromEntry == null) return null;
    const availability = aceAvailability ?? 1;
    if (!Number.isFinite(availability) || availability <= 0) return null;
    const ratio = aceScoreFromEntry / (100 * availability);
    if (!Number.isFinite(ratio)) return null;
    return Math.max(0, Math.min(1, ratio));
  })();

  const aceCore = typeof aceExtras?.core === 'number' ? aceExtras.core : null;
  const aceLogistic = typeof aceExtras?.logistic === 'number'
    ? aceExtras.logistic
    : logisticFromEntry;

  const aceTooltip = useMemo(() => {
    const lines = [
      'ACE blends war offense, defense, participation, capital value, and donations into one score.'
    ];

    if (aceScore != null) {
      lines.push(`Score: ${aceScore.toFixed(1)}`);
    } else {
      lines.push('Score unavailable — run the latest snapshot ingestion to populate ACE extras.');
    }

    if (aceAvailabilityPercent != null) {
      lines.push(`Availability: ${aceAvailabilityPercent}%`);
    }

    if (aceLogistic != null) {
      lines.push(`Logistic: ${(aceLogistic * 100).toFixed(1)}`);
    }

    if (aceCore != null) {
      lines.push(`Core: ${aceCore.toFixed(2)}`);
    }

    if (aceEntry) {
      const componentLines = [
        ['OAE', aceEntry.breakdown.ova.shrunk],
        ['DAE', aceEntry.breakdown.dva.shrunk],
        ['PR', aceEntry.breakdown.par.shrunk],
        ['CAP', aceEntry.breakdown.cap.shrunk],
        ['DON', aceEntry.breakdown.don.shrunk],
      ] as Array<[string, number]>;

      lines.push('');
      lines.push('Component z-scores:');
      componentLines.forEach(([label, value]) => {
        if (Number.isFinite(value)) {
          lines.push(`• ${label}: ${value.toFixed(2)}`);
        }
      });
    }

    return lines.join('\n');
  }, [aceScore, aceAvailabilityPercent, aceLogistic, aceCore, aceEntry]);

  const heroOrder: Array<keyof HeroCaps> = ['bk', 'aq', 'mp', 'gw', 'rc'];
  const heroBreakdown: HeroBreakdownRow[] = heroOrder
    .map((hero) => {
      const rawLevel = member[hero] ?? 0;
      const current = typeof rawLevel === 'number' ? Math.max(rawLevel, 0) : 0;
      const cap = Math.max(heroCaps?.[hero] ?? 0, current);
      if (!cap && !current) return null;
      const deficit = Math.max(0, cap - current);
      const deficitPct = cap > 0 ? (deficit / cap) * 100 : 0;
      return { hero, current, cap, deficit, deficitPct };
    })
    .filter((value): value is HeroBreakdownRow => value !== null);

  const heroRushTooltip = (() => {
    const lines = [
      'Hero Rush % = average hero shortfall vs Town Hall caps across unlocked heroes.',
    ];

    if (heroBreakdown.length) {
      lines.push(`Included: ${heroBreakdown.map((row) => HERO_SHORT_LABELS[row.hero]).join(', ')}`);
    } else {
      lines.push('No heroes unlocked yet for this Town Hall.');
    }

    if (Number.isFinite(rushPercent)) {
      lines.push(`Current score: ${rushPercent.toFixed(1)}%`);
    }

    if (heroBreakdown.length) {
      lines.push('');
      heroBreakdown.forEach((row) => {
        lines.push(formatHeroLine(row.hero, row.current, row.cap));
      });
    }

    return lines.join('\n');
  })();


  // Handle member actions
  const handleOpenProfile = () => {
    const normalizedTag = member.tag.startsWith('#') ? member.tag.slice(1) : member.tag;
    router.push(`/player/${normalizedTag}`);
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

  const handleOpenTenureEditor = () => {
    setTenureEditorValue(String(currentTenureDays));
    setTenureEditorOpen(true);
  };

  const handleCloseTenureEditor = () => {
    if (!isUpdatingTenure) {
      setTenureEditorOpen(false);
    }
  };

  const handleTenureSave = async () => {
    const trimmed = tenureEditorValue.trim();
    if (!trimmed) {
      showToast('Enter tenure in days', 'error');
      return;
    }
    const match = trimmed.match(/\d+/);
    if (!match) {
      showToast('Tenure must be a number of days', 'error');
      return;
    }
    const days = Math.max(0, Math.min(20000, Number.parseInt(match[0], 10)));
    try {
      setIsUpdatingTenure(true);
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
      updateLocalTenure(days, new Date().toISOString().slice(0, 10));
      setTenureEditorOpen(false);
      if (clanTagForActions) {
        await loadRoster(clanTagForActions, { mode: 'live', force: true });
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to update tenure';
      showToast(message, 'error');
    } finally {
      setIsUpdatingTenure(false);
    }
  };

  return (
    <>
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
      <TableCell className="border-r border-gray-300" isActiveSort={isActiveColumn('name')}>
        <div className="flex items-center space-x-3">
          <LeagueBadge league={leagueInfo.name} trophies={leagueInfo.trophies} size="lg" showText={false} />
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenProfile();
              }}
              className="player-name-link font-heading font-semibold text-left transition-colors focus-ring-inset tooltip-trigger"
              style={{ color: 'var(--player-name-color, #1e40af)' }}
              data-tooltip="View player profile"
            >
              {member.name}
            </button>
          </div>
        </div>
      </TableCell>

      {/* Role Column */}
      <TableCell className="text-center border-r border-slate-600/50" isActiveSort={isActiveColumn('role')}>
        {(() => {
          const variant = getRoleBadgeVariant(member.role);
          return (
            <span
              className={`role-badge role-badge--${variant.tone} inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold tooltip-trigger`}
              data-tooltip={variant.label}
            >
              {variant.icon && <span aria-hidden className="text-xs">{variant.icon}</span>}
              <span className="role-badge__label">{variant.label}</span>
            </span>
          );
        })()}
      </TableCell>

      {/* Town Hall Column */}
      <TableCell className="text-center border-r border-slate-700/40" isActiveSort={isActiveColumn('th')}>
        <div className="flex items-center justify-center">
          <TownHallBadge
            level={th}
            size="sm"
            showLevel={true}
            showBox={false}
            className="drop-shadow-md"
          />
        </div>
      </TableCell>

      {/* Trophies Column */}
      <TableCell
        className="text-center border-r border-slate-700/40"
        title="Current trophies"
        isActiveSort={isActiveColumn('trophies')}
      >
        <div className="flex items-center justify-center">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatNumber(member.trophies)}
          </span>
          {isRushedPlayer && (
            <span
              className="text-xs text-clash-red tooltip-trigger"
              data-tooltip={`Rushed: ${rushPercent}%`}
            >
              {isVeryRushedPlayer ? '🔴' : '⚠️'}
            </span>
          )}
        </div>
      </TableCell>


      {/* Hero Columns */}
      <TableCell
        className="text-center border-r border-gray-300"
        isActiveSort={isActiveColumn('bk')}
      >
        <HeroLevel 
          hero="BK" 
          level={member.bk || 0} 
          maxLevel={getDisplayMax('bk')}
          size="sm"
          showName={false}
          tooltip={getHeroTooltipMessage('bk')}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        isActiveSort={isActiveColumn('aq')}
      >
        <HeroLevel 
          hero="AQ" 
          level={member.aq || 0} 
          maxLevel={getDisplayMax('aq')}
          size="sm"
          showName={false}
          tooltip={getHeroTooltipMessage('aq')}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        isActiveSort={isActiveColumn('mp')}
      >
        <HeroLevel 
          hero="MP" 
          level={member.mp || 0} 
          maxLevel={getDisplayMax('mp')}
          size="sm"
          showName={false}
          tooltip={getHeroTooltipMessage('mp')}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        isActiveSort={isActiveColumn('gw')}
      >
        <HeroLevel 
          hero="GW" 
          level={member.gw || 0} 
          maxLevel={getDisplayMax('gw')}
          size="sm"
          showName={false}
          tooltip={getHeroTooltipMessage('gw')}
        />
      </TableCell>

      <TableCell
        className="text-center border-r border-gray-300"
        isActiveSort={isActiveColumn('rc')}
      >
        <HeroLevel 
          hero="RC" 
          level={member.rc || 0} 
          maxLevel={getDisplayMax('rc')}
          size="sm"
          showName={false}
          tooltip={getHeroTooltipMessage('rc')}
        />
      </TableCell>

      {/* Rush Percentage Column */}
      <TableCell
        className="text-center border-r border-slate-600/50"
        title={heroRushTooltip}
        isActiveSort={isActiveColumn('rush')}
      >
        <span className={`font-semibold ${rushPercent >= 70 ? 'text-clash-red' : rushPercent >= 40 ? 'text-clash-orange' : 'text-clash-green'}`}>
          {rushPercent.toFixed(1)}%
        </span>
      </TableCell>
      {/* ACE Score Column */}
      <TableCell
        className="text-center border-r border-slate-600/50 text-slate-900 dark:text-slate-100"
        title={aceTooltip}
        isActiveSort={isActiveColumn('ace')}
      >
        {aceScore != null ? (
          <span className="font-semibold">
            {aceScore.toFixed(1)}
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-300">—</span>
        )}
      </TableCell>
      {/* Activity Column (under Analysis group) */}
      <TableCell className="text-center border-r border-slate-600/50" isActiveSort={isActiveColumn('activity')}>
        <div className="flex flex-col items-center space-y-1">
          <span
            className={`tooltip-trigger px-2 py-1 rounded-full text-xs font-semibold border ${
              activity.level.toLowerCase() === 'very active' ? 'bg-clash-green/20 text-clash-green border-clash-green/50' :
              activity.level.toLowerCase() === 'active' ? 'bg-clash-blue/20 text-clash-blue border-clash-blue/50' :
              activity.level.toLowerCase() === 'moderate' ? 'bg-clash-orange/20 text-clash-orange border-clash-orange/50' :
              activity.level.toLowerCase() === 'low' ? 'bg-clash-orange/20 text-clash-orange border-clash-orange/50' :
              'bg-clash-red/20 text-clash-red border-clash-red/50'
            }`}
            data-tooltip={`Activity rating\nHigh: lots of recent evidence (donations/attacks/etc.)\nMed: some recent evidence\nLow: little recent evidence\nInactive: no recent evidence`}
          >
            {getActivityShortLabel(activity.level)}
          </span>
        </div>
      </TableCell>

      {/* Donations Given Column */}
      <TableCell
        className="text-center border-r border-slate-600/50"
        title={`Donations given/received: ${formatNumber(donationBalance.given)} / ${formatNumber(donationBalance.received)} (balance ${donationBalance.isNegative ? '+' : ''}${donationBalance.balance})`}
        isActiveSort={isActiveColumn('donations')}
      >
        <span className="font-semibold text-clash-green">{formatNumber(member.donations)}</span>
      </TableCell>

      {/* Donations Received Column */}
      <TableCell
        className="text-center border-r border-slate-600/50"
        title={`Donations received: ${formatNumber(member.donationsReceived)} (net ${donationBalance.isNegative ? '+' : ''}${donationBalance.balance})`}
        isActiveSort={isActiveColumn('donationsReceived')}
      >
        <span className="font-semibold text-clash-blue">{formatNumber(member.donationsReceived)}</span>
      </TableCell>

      {/* Tenure Column */}
      <TableCell className="text-center border-r border-slate-300" isActiveSort={isActiveColumn('tenure')}>
        <span
          className="tooltip-trigger font-semibold"
          data-tooltip={member.tenure_as_of
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
      <TableCell className="text-center" isActiveSort={isActiveColumn('actions')}>
        <div className="relative inline-block text-left tooltip-trigger" data-tooltip="Actions">
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
                const baseDays = payload?.data?.base ?? currentTenureDays;
                const asOf = payload?.data?.asOf ?? new Date().toISOString().slice(0, 10);
                updateLocalTenure(baseDays, asOf);
                if (clanTagForActions) {
                  await loadRoster(clanTagForActions, { mode: 'live', force: true });
                }
              } catch (error: any) {
                const message = error?.message || 'Failed to grant tenure';
                showToast(message, 'error');
              }
            }}
            onEditTenure={(e) => {
              e.stopPropagation();
              handleOpenTenureEditor();
            }}
          />
        </div>
      </TableCell>
    </tr>
    <Modal
      isOpen={isTenureEditorOpen}
      onClose={handleCloseTenureEditor}
      title={`Edit tenure for ${member.name}`}
      size="sm"
    >
      <div className="space-y-4 text-slate-100">
        <label className="flex flex-col text-sm font-semibold text-slate-200">
          Tenure in days
          <input
            type="number"
            min={0}
            max={20000}
            value={tenureEditorValue}
            onChange={(event) => setTenureEditorValue(event.target.value)}
            className="mt-2 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="0"
          />
        </label>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Current: {formatDays(currentTenureDays)}</span>
          <span>Range: 0 – 20,000</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCloseTenureEditor} disabled={isUpdatingTenure}>
            Cancel
          </Button>
          <Button onClick={handleTenureSave} disabled={isUpdatingTenure}>
            {isUpdatingTenure ? 'Saving…' : 'Save tenure'}
          </Button>
        </div>
      </div>
    </Modal>
    </>
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
