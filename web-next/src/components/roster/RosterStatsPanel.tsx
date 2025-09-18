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
    return null;
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
      icon={<Users className="h-5 w-5" />}
      title="Roster Snapshot"
      subtitle={subtitle + (dataFetchedAt ? ` • Updated ${safeLocaleTimeString(dataFetchedAt, { fallback: dataFetchedAt, context: 'RosterStatsPanel fetchedAt' })}` : '')}
      actions={freshnessBadge}
    >
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/72 via-slate-900/48 to-slate-800/52 px-4 py-5 shadow-inner text-slate-100">
        {metricCards.length ? (
          <div className="space-y-4 text-base">
            {metricCards.map((metric) => (
              <div
                key={metric.label}
                className={`flex items-center justify-between rounded-2xl bg-gradient-to-r ${metric.gradient} px-4 py-3 shadow-[0_18px_32px_-22px_rgba(0,0,0,0.55)]`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
                    <Image src={metric.icon} alt="" width={24} height={24} className="drop-shadow" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.24em] text-slate-100/80">{metric.label}</span>
                </div>
                <span className={`text-2xl font-semibold drop-shadow-md ${metric.textClass}`}>{metric.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white/5 px-3 py-4 text-center text-sm text-slate-200/80">
            No roster metrics available yet.
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RosterStatsPanel;
