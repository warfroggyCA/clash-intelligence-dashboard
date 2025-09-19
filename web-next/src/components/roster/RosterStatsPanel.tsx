"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { Users } from 'lucide-react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString, safeLocaleTimeString } from '@/lib/date';
import { GlassCard } from '@/components/ui';

interface RosterStatsPanelProps {
  className?: string;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const mergedClassName = ['min-h-[18rem]', className].filter(Boolean).join(' ');
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  console.log('[RosterStatsPanel] Rendering with roster:', roster);

  const stats = useMemo(() => {
    if (!roster || !roster.members?.length) {
      return null;
    }

    const memberCount = roster.members.length;
    const averageTownHall = Math.round(
      roster.members.reduce((sum, member) => sum + (member.townHallLevel || member.th || 0), 0) /
        memberCount
    );
    const totalDonations = roster.members.reduce((sum, member) => sum + (member.donations || 0), 0);
    const averageTrophies = Math.round(
      roster.members.reduce((sum, member) => sum + (member.trophies || 0), 0) /
        memberCount
    );

    return {
      memberCount,
      averageTownHall,
      totalDonations,
      averageTrophies,
    };
  }, [roster]);

  if (!roster) {
    return (
      <GlassCard className={mergedClassName}>
        <div className="rounded-xl bg-white/20 px-3 py-4 text-center text-sm text-white font-medium border border-white/30">
          Loading roster data...
        </div>
      </GlassCard>
    );
  }

  const subtitle = snapshotMetadata?.snapshotDate
    ? `Snapshot ${safeLocaleDateString(snapshotMetadata.snapshotDate, {
        fallback: snapshotMetadata.snapshotDate,
        context: 'RosterStatsPanel snapshotDate',
      })}`
    : roster.source === 'live'
      ? 'Live data'
      : 'Snapshot data';

  const freshnessBadge = typeof dataAgeHours === 'number'
    ? (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            dataAgeHours <= 24
              ? 'bg-emerald-500/20 text-emerald-200'
              : dataAgeHours <= 48
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-rose-500/25 text-rose-200'
          }`}
        >
          {dataAgeHours <= 24
            ? 'Fresh data'
            : dataAgeHours <= 48
              ? 'Stale data'
              : 'Outdated data'}
        </span>
      )
    : null;

  const metricCards = stats
    ? [
        {
          label: 'Members',
          value: stats.memberCount.toLocaleString(),
          icon: '/assets/icons/trophy.svg',
          gradient: 'from-blue-500/30 via-blue-500/10 to-blue-700/35',
          textClass: 'text-blue-50',
        },
        {
          label: 'Avg Town Hall',
          value: stats.averageTownHall.toString(),
          icon: '/assets/icons/hero.svg',
          gradient: 'from-indigo-500/30 via-indigo-500/10 to-indigo-700/35',
          textClass: 'text-indigo-50',
        },
        {
          label: 'Avg Trophies',
          value: stats.averageTrophies.toLocaleString(),
          icon: '/assets/icons/trophy.svg',
          gradient: 'from-purple-500/30 via-purple-500/10 to-purple-700/35',
          textClass: 'text-purple-50',
        },
        {
          label: 'Total Donations',
          value: stats.totalDonations.toLocaleString(),
          icon: '/assets/icons/donation.svg',
          gradient: 'from-amber-500/30 via-amber-500/10 to-orange-600/35',
          textClass: 'text-amber-50',
        },
      ]
    : [];

  return (
    <GlassCard
      className={mergedClassName}
      actions={freshnessBadge}
    >
      {metricCards.length ? (
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 gap-3 text-base max-h-[20rem] overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]">
            {metricCards.map((metric) => (
              <div
                key={metric.label}
                className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-r ${metric.gradient} px-3 py-4 shadow-sm border border-white/30 text-center min-h-[7rem] text-white`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm mb-2">
                  <Image src={metric.icon} alt="" width={20} height={20} className="drop-shadow" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.24em] text-white font-bold mb-1 whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                  {metric.label}
                </span>
                <span className="text-lg font-extrabold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white/20 px-3 py-4 text-center text-sm text-white font-medium border border-white/30">
          No roster metrics available yet.
        </div>
      )}
      {dataFetchedAt && (
        <div className="mt-4 text-[11px] text-white/80 font-medium">
          Last fetched {safeLocaleTimeString(dataFetchedAt, { fallback: dataFetchedAt, context: 'RosterStatsPanel fetchedAt' })}
        </div>
      )}
    </GlassCard>
  );
};

export default RosterStatsPanel;
