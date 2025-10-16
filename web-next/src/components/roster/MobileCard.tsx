/**
 * MobileCard Component
 *
 * Responsive roster card optimized for small and medium screens.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Member, Roster } from '@/types';
import { safeLocaleDateString } from '@/lib/date';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  getMemberActivity,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
  isNetReceiver,
  isLowDonator,
} from '@/lib/business/calculations';
import { Button } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { showToast } from '@/lib/toast';

export interface MobileCardProps {
  member: Member;
  index: number;
  roster: Roster;
  className?: string;
}

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '—';
  return num.toLocaleString();
};

const formatDays = (days: number | undefined): string => {
  if (days === undefined || days === null) return '—';
  if (days === 0) return 'New';
  if (days === 1) return '1 day';
  return `${days} days`;
};

const activityBadgeClass = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'very active':
      return 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40';
    case 'active':
      return 'bg-sky-400/20 text-sky-200 border-sky-300/40';
    case 'moderate':
      return 'bg-amber-400/20 text-amber-100 border-amber-300/40';
    case 'low':
      return 'bg-orange-400/25 text-orange-100 border-orange-300/40';
    case 'inactive':
      return 'bg-rose-500/20 text-rose-100 border-rose-300/40';
    default:
      return 'bg-white/10 text-white/70 border-white/20';
  }
};

export const MobileCard: React.FC<MobileCardProps> = ({
  member,
  roster,
  className = '',
}) => {
  const {
    setSelectedMember,
    setShowDepartureModal,
    loadRoster,
    clanTag: storeClanTag,
    homeClan,
    setSelectedPlayer,
    setShowPlayerProfile,
  } = useDashboardStore();
  const router = useRouter();

  const clanTagForActions = roster.clanTag || storeClanTag || homeClan || '';

  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = getMemberActivity(member);
  const rushWarning = isRushed(member);
  const rushSevere = isVeryRushed(member);
  const netReceiver = isNetReceiver(member);
  const lowDonator = isLowDonator(member);
  const lastActiveDisplay = activity.last_active_at
    ? safeLocaleDateString(activity.last_active_at, {
        fallback: 'Unknown',
        context: 'MobileCard activity.last_active_at',
      })
    : 'Unknown';

  const openProfile = () => {
    const normalizedTag = member.tag.startsWith('#') ? member.tag.slice(1) : member.tag;
    router.push(`/player/${normalizedTag}`);
  };

  const openDepartureModal = () => {
    setSelectedMember(member);
    setShowDepartureModal(true);
  };

  const openManageNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlayer(member);
    setShowPlayerProfile(true);
  };

  const handleEditTenure = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = Number(member.tenure_days ?? member.tenure ?? 0) || 0;
    const input = typeof window !== 'undefined'
      ? window.prompt(`Set tenure for ${member.name}`, String(current))
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
        throw new Error(payload?.error || payload?.message || 'Failed to update tenure');
      }
      showToast(`Tenure updated to ${days} day${days === 1 ? '' : 's'}`, 'success');
      if (clanTagForActions) {
        await loadRoster(clanTagForActions);
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to update tenure', 'error');
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/12 bg-slate-900/80 p-4 text-white shadow-lg shadow-black/25 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 md:p-5 ${className}`}
      onClick={openProfile}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProfile();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-semibold leading-tight md:text-lg">
            {member.name}
          </h3>
          <p className="truncate font-mono text-xs text-white/60 md:text-sm">
            {member.tag}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide md:text-xs ${
              member.role === 'leader'
                ? 'bg-amber-300 text-gray-900'
                : member.role === 'coleader'
                ? 'bg-purple-400/90 text-white'
                : member.role === 'elder'
                ? 'bg-sky-400/90 text-white'
                : 'bg-white/15 text-white'
            }`}
          >
            {member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
          </span>
          <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 px-0 border-blue-400/40 text-blue-200 hover:bg-blue-500/10"
                title="Manage notes"
                onClick={openManageNotes}
              >
                📝
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 px-0 border-white/30 text-white hover:bg-white/10"
                title="Edit tenure"
                onClick={handleEditTenure}
              >
                ⏱️
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 px-0 border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                title="Record departure"
                onClick={(e) => {
                  e.stopPropagation();
                  openDepartureModal();
                }}
              >
                📤
              </Button>
            </div>
          </LeadershipGuard>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-white/80 md:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-white/50">Town Hall</span>
          <span className="font-semibold text-white">{th}</span>
          {rushWarning && (
            <span className="text-xs" title={`Rushed ${rushPercent.toFixed(1)}%`}>
              {rushSevere ? '🔴' : '🟡'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Trophies</span>
          <span className="font-semibold text-white">{formatNumber((member as any).rankedTrophies ?? member.trophies ?? 0)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Donated</span>
          <span className="font-semibold text-emerald-300">{formatNumber(member.donations)}</span>
          {lowDonator && <span className="text-xs text-rose-200" title="Low donator">⚠️</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Received</span>
          <span className="font-semibold text-sky-300">{formatNumber(member.donationsReceived)}</span>
          {netReceiver && <span className="text-xs text-amber-200" title="Net receiver">📥</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Season</span>
          <span className="font-semibold text-white">{formatNumber((member as any).seasonTotalTrophies ?? undefined)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Tenure</span>
          <span className="font-semibold text-white">{formatDays(member.tenure_days || member.tenure)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">Activity</span>
          <span className={`border px-2 py-1 text-[11px] font-semibold md:text-xs ${activityBadgeClass(activity.level)}`}>
            {activity.level}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] md:text-xs">
        {rushWarning && (
          <span className={`rounded-full px-3 py-1 font-semibold ${rushSevere ? 'bg-rose-500/20 text-rose-100' : 'bg-amber-400/20 text-amber-100'}`}>
            {rushSevere ? 'Very Rushed' : 'Rushed'} • {rushPercent.toFixed(1)}%
          </span>
        )}
        {netReceiver && (
          <span className="rounded-full bg-orange-400/20 px-3 py-1 font-semibold text-orange-100">
            Net Receiver
          </span>
        )}
        {lowDonator && (
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70">
            Low Donator
          </span>
        )}
        {donationBalance.balance < 0 && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-100">
            Net +{Math.abs(donationBalance.balance).toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.28em] text-white/50">Heroes</span>
          <div className="flex flex-wrap gap-3 text-sm text-white">
            {member.bk && (
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">BK</div>
                <div>{member.bk}</div>
              </div>
            )}
            {member.aq && (
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">AQ</div>
                <div>{member.aq}</div>
              </div>
            )}
            {member.gw && (
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">GW</div>
                <div>{member.gw}</div>
              </div>
            )}
            {member.rc && (
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">RC</div>
                <div>{member.rc}</div>
              </div>
            )}
            {member.mp && (
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">MB</div>
                <div>{member.mp}</div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/70 md:text-sm">
          <div>
            <p className="text-white/50">Last Active</p>
            <p className="font-medium text-white/80">{lastActiveDisplay}</p>
          </div>
          <div>
            <p className="text-white/50">Last Seen</p>
            <p className="font-medium text-white/80">
              {member.lastSeen
                ? safeLocaleDateString(member.lastSeen, {
                    fallback: 'Unknown',
                    context: 'MobileCard lastSeen',
                  })
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            openProfile();
          }}
          variant="primary"
          size="sm"
          className="flex-1 min-w-[7.5rem]"
        >
          View Profile
        </Button>
        <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              openDepartureModal();
            }}
            variant="outline"
            size="sm"
            className="flex-1 min-w-[7.5rem] border-white/30 text-white hover:bg-white/10"
          >
            Departure
          </Button>
        </LeadershipGuard>
      </div>
    </div>
  );
};

export default MobileCard;
