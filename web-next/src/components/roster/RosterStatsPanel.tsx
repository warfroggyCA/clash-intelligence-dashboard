"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { GlassCard } from '@/components/ui';

interface RosterStatsPanelProps {
  className?: string;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore((state) => state.snapshotDetails);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  const panelClassName = ['min-h-[18rem]', className].filter(Boolean).join(' ');

  const stats = useMemo(() => {
    if (!roster?.members?.length) {
      return null;
    }

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

  const { currentWar, recentWars, warWinRate } = useMemo(() => {
    const warLog = snapshotDetails?.warLog ?? [];
    const recent = warLog.slice(0, 3);
    const wins = recent.filter((war) => war.result === 'WIN').length;
    const winRate = recent.length ? Math.round((wins / recent.length) * 100) : null;

    return {
      currentWar: snapshotDetails?.currentWar,
      recentWars: recent,
      warWinRate: winRate,
    };
  }, [snapshotDetails]);

  const updatedAtLabel = useMemo(() => {
    if (!dataFetchedAt) {
      return null;
    }
    const parsed = new Date(dataFetchedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return formatDistanceToNow(parsed, { addSuffix: true });
  }, [dataFetchedAt]);

  if (!stats) {
    return (
      <GlassCard className={panelClassName}>
        <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center text-sm text-white/80">
          Loading roster metrics…
        </div>
      </GlassCard>
    );
  }

  const metrics = [
    {
      label: 'Members',
      value: stats.memberCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
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
      value: stats.averageTrophies.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      icon: '/assets/icons/trophy.svg',
      gradient: 'from-purple-400/40 via-purple-300/20 to-purple-500/50',
    },
    {
      label: 'Total Donations',
      value: stats.totalDonations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      icon: '/assets/icons/donation.svg',
      gradient: 'from-amber-400/40 via-amber-300/20 to-orange-400/50',
    },
  ];

  if (warWinRate != null) {
    metrics.push({
      label: 'War Win Rate',
      value: `${warWinRate}%`,
      icon: '/assets/icons/trophy.svg',
      gradient: 'from-rose-400/40 via-rose-300/20 to-rose-500/50',
    });
  }

  return (
    <GlassCard className={panelClassName}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${metric.gradient} px-4 py-6 shadow-lg border border-white/40 text-center min-h-[8rem] text-white backdrop-blur-sm`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-lg drop-shadow-md">
                <Image src={metric.icon} alt="" width={22} height={22} className="drop-shadow-sm" />
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] drop-shadow-sm" style={{ color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                {metric.label}
              </span>
              <span className="text-xl font-bold drop-shadow-sm" style={{ color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {updatedAtLabel && (
          <p className="text-xs text-white/75">Updated {updatedAtLabel}</p>
        )}

        {(currentWar || recentWars.length) && (
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/90 space-y-4">
            {currentWar && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Current War</p>
                <p className="text-base font-semibold text-white">
                  {currentWar.opponent?.name ?? 'Unknown Opponent'}
                </p>
                <p className="text-white/80">
                  State: {currentWar.state ?? 'Unknown'}
                </p>
                {currentWar.teamSize && (
                  <p className="text-white/80">Size: {currentWar.teamSize}v{currentWar.teamSize}</p>
                )}
                {currentWar.endTime && (
                  <p className="text-white/70 text-xs">
                    Ends {formatDistanceToNow(new Date(currentWar.endTime), { addSuffix: true })}
                  </p>
                )}
              </div>
            )}

            {recentWars.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-2">Recent Wars</p>
                <div className="space-y-2">
                  {recentWars.map((war) => (
                    <div key={war.endTime} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between text-sm font-semibold text-white">
                        <span className="truncate pr-3">{war.opponent?.name ?? 'Unknown Opponent'}</span>
                        <span className={war.result === 'WIN' ? 'text-emerald-300' : war.result === 'LOSE' ? 'text-rose-300' : 'text-white/70'}>
                          {war.result ?? 'N/A'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/70">
                        {war.teamSize}v{war.teamSize} • ended {formatDistanceToNow(new Date(war.endTime), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RosterStatsPanel;
