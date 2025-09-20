"use client";

import { useMemo, useEffect } from 'react';
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

    // Debug: Check DOM after mount
    useEffect(() => {
        console.log('[RosterStatsPanel] Component mounted');
        const panelElement = document.querySelector('[data-panel="roster-stats"]');
        if (panelElement) {
            console.log('[RosterStatsPanel] DOM after mount:', panelElement.outerHTML);
        } else {
            console.log('[RosterStatsPanel] Panel element not found in DOM');
        }
    }, []);

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
      <GlassCard 
        className={`${mergedClassName} !block !visible`} 
        data-panel="roster-stats"
        style={{ display: 'block', visibility: 'visible', position: 'relative', zIndex: 10 }}
      >
        <div data-debug>{Date.now()}</div>
        {!stats ? (
          <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center text-sm text-white/80">
            Loading roster metrics…
          </div>
        ) : (
          <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: 'Members',
                value: stats.memberCount.toLocaleString(),
                icon: '/assets/icons/trophy.svg',
                gradient: 'from-blue-400/40 via-blue-300/20 to-blue-500/50',
              },
              {
                label: 'Avg Town Hall',
                value: stats.averageTownHall.toString(),
                icon: '/assets/icons/hero.svg',
                gradient: 'from-indigo-400/40 via-indigo-300/20 to-indigo-500/50',
              },
              {
                label: 'Avg Trophies',
                value: stats.averageTrophies.toLocaleString(),
                icon: '/assets/icons/trophy.svg',
                gradient: 'from-purple-400/40 via-purple-300/20 to-purple-500/50',
              },
              {
                label: 'Total Donations',
                value: stats.totalDonations.toLocaleString(),
                icon: '/assets/icons/donation.svg',
                gradient: 'from-amber-400/40 via-amber-300/20 to-orange-400/50',
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${metric.gradient} px-4 py-6 shadow-lg border border-white/40 text-center min-h-[8rem] text-white backdrop-blur-sm`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-lg drop-shadow-md">
                  <Image src={metric.icon} alt="" width={22} height={22} className="drop-shadow-sm" />
                </div>
                <span className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white drop-shadow-sm">
                  {metric.label}
                </span>
                <span className="text-xl font-bold text-white drop-shadow-sm">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
          {dataFetchedAt && (
            <div className="pt-3 border-t border-white/20">
              <div className="text-xs text-white/70 font-medium text-center">
                Last fetched {safeLocaleTimeString(dataFetchedAt, { fallback: dataFetchedAt, context: 'RosterStatsPanel fetchedAt' })}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default RosterStatsPanel;
