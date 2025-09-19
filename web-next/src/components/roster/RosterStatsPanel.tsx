"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleTimeString } from '@/lib/date';
import { GlassCard } from '@/components/ui';

interface RosterStatsPanelProps {
  className?: string;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const mergedClassName = ['min-h-[18rem]', className].filter(Boolean).join(' ');
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  console.log('[RosterStatsPanel] Rendering with roster:', roster);
  console.log('[RosterStatsPanel] Roster members:', roster?.members?.length);

  const stats = useMemo(() => {
    if (!roster?.members?.length) return null;

    const members = roster.members;
    const memberCount = members.length;
    const averageTownHall = Math.round(
      members.reduce((sum, member) => sum + (member.townHallLevel || member.th || 0), 0) /
        memberCount
    );
    const averageTrophies = Math.round(
      members.reduce((sum, member) => sum + (member.trophies || 0), 0) /
        memberCount
    );
    const totalDonations = members.reduce((sum, member) => sum + (member.donations || 0), 0);

    return {
      memberCount,
      averageTownHall,
      averageTrophies,
      totalDonations,
    };
  }, [roster]);

  return (
    <GlassCard className={mergedClassName}>
      {!stats ? (
        <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center text-sm text-white/80">
          Loading roster metrics…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-base">
          {[
            {
              label: 'Members',
              value: stats.memberCount.toLocaleString(),
              icon: '/assets/icons/trophy.svg',
            },
            {
              label: 'Avg Town Hall',
              value: stats.averageTownHall.toString(),
              icon: '/assets/icons/hero.svg',
            },
            {
              label: 'Avg Trophies',
              value: stats.averageTrophies.toLocaleString(),
              icon: '/assets/icons/trophy.svg',
            },
            {
              label: 'Total Donations',
              value: stats.totalDonations.toLocaleString(),
              icon: '/assets/icons/donation.svg',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col items-center justify-center rounded-2xl bg-white/12 px-3 py-4 text-center"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/75 shadow-sm">
                <Image src={metric.icon} alt="" width={20} height={20} className="drop-shadow" />
              </div>
              <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                {metric.label}
              </span>
              <span className="text-lg font-bold text-white">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {dataFetchedAt && (
        <div className="mt-4 text-[11px] font-medium text-white/60">
          Last fetched {safeLocaleTimeString(dataFetchedAt, { fallback: dataFetchedAt, context: 'RosterStatsPanel fetchedAt' })}
        </div>
      )}
    </GlassCard>
  );
};

export default RosterStatsPanel;
