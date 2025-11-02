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
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';

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

const formatTenure = (days: number | undefined): { value: string; unit: string } => {
  if (days === undefined || days === null) return { value: '—', unit: '' };
  if (days === 0) return { value: 'New', unit: '' };
  return { value: String(days), unit: days === 1 ? '(day)' : '(days)' };
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
    updateRosterMemberTenure,
  } = useDashboardStore();
  const router = useRouter();

  const clanTagForActions = roster.clanTag || storeClanTag || homeClan || '';

  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = resolveMemberActivity(member);
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
        body: JSON.stringify({
          updates: [
            {
              tag: member.tag,
              tenure_days: days,
              clanTag: clanTagForActions,
              player_name: member.name,
            },
          ],
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to update tenure');
      }
      const result = payload?.data?.updates?.[0];
      const tenureDays = typeof result?.tenureDays === 'number' ? result.tenureDays : days;
      const asOf = result?.asOf ?? new Date().toISOString().slice(0, 10);
      if (typeof updateRosterMemberTenure === 'function') {
        updateRosterMemberTenure(member.tag, tenureDays, asOf);
      }
      showToast(`Tenure updated to ${tenureDays} day${tenureDays === 1 ? '' : 's'}`, 'success');
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

      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 text-xs md:text-sm">
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">TH</div>
          <div className="font-semibold text-white flex items-center gap-1">
            {th}
            {rushWarning && (
              <span className="text-xs" title={`Rushed ${rushPercent.toFixed(1)}%`}>
                {rushSevere ? '🔴' : '🟡'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Trophies</div>
          <div className="font-semibold text-white">{formatNumber((member as any).rankedTrophies ?? member.trophies ?? 0)}</div>
        </div>
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">VIP</div>
          <div className="font-semibold text-amber-300">
            {(member as any).vip?.score?.toFixed(1) ?? '—'}
            {(() => {
              const previousVIP = (member as any).previousVipScore;
              const currentVIP = (member as any).vip?.score;
              if (previousVIP != null && currentVIP != null) {
                return currentVIP > previousVIP ? ' ↑' : currentVIP < previousVIP ? ' ↓' : '';
              }
              return '';
            })()}
          </div>
        </div>
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Donated</div>
          <div className="font-semibold text-emerald-300 flex items-center gap-1">
            {formatNumber(member.donations)}
            {lowDonator && <span className="text-xs text-rose-200" title="Low donator">⚠️</span>}
          </div>
        </div>
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Received</div>
          <div className="font-semibold text-sky-300 flex items-center gap-1">
            {formatNumber(member.donationsReceived)}
            {netReceiver && <span className="text-xs text-amber-200" title="Net receiver">📥</span>}
          </div>
        </div>
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Season</div>
          <div className="font-semibold text-white">{formatNumber((member as any).seasonTotalTrophies ?? undefined)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-white/50">Activity:</span>
        <span className={`border px-3 py-1 rounded-full text-[11px] font-semibold md:text-xs ${activityBadgeClass(activity.level)}`}>
          {activity.level}
        </span>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[10px] uppercase tracking-wide text-white/50 whitespace-nowrap">Heroes:</span>
          <div className="flex flex-wrap items-center gap-1.5 text-white font-medium">
            {[
              member.bk && `BK ${member.bk}`,
              member.aq && `AQ ${member.aq}`,
              member.gw && `GW ${member.gw}`,
              member.rc && `RC ${member.rc}`,
              member.mp && `MP ${member.mp}`,
            ]
              .filter(Boolean)
              .map((hero, idx, arr) => (
                <React.Fragment key={idx}>
                  <span className="whitespace-nowrap">{hero}</span>
                  {idx < arr.length - 1 && <span className="text-white/30">•</span>}
                </React.Fragment>
              ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-white/70 md:text-sm">
          <div>
            <span className="text-white/50 text-[10px] uppercase">Last Active: </span>
            <span className="font-medium text-white/80">{lastActiveDisplay}</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] uppercase">Last Seen: </span>
            <span className="font-medium text-white/80">
              {member.lastSeen
                ? safeLocaleDateString(member.lastSeen, {
                    fallback: 'Unknown',
                    context: 'MobileCard lastSeen',
                  })
                : 'Unknown'}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-white/50 text-[10px] uppercase">Tenure: </span>
          <span className="font-medium text-white/80">
            {(() => {
              const days = member.tenure_days || member.tenure;
              if (!days) return '—';
              return `${days}${days === 1 ? ' (day)' : ' (days)'}`;
            })()}
          </span>
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
