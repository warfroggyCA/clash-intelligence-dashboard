"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { GlassCard, TownHallBadge, LeagueBadge } from '@/components/ui';

interface RosterStatsPanelProps {
  className?: string;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore((state) => state.snapshotDetails);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  const panelClassName = ['xl:min-h-[18rem]', className].filter(Boolean).join(' ');

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
    const averageDonations = Math.round(totalDonations / memberCount);
    const averageBuilderTrophies = Math.round(
      members.reduce((sum, member) => sum + (member.versusTrophies || 0), 0) / memberCount
    );

    return {
      memberCount,
      averageTownHall,
      averageTrophies,
      totalDonations,
      averageDonations,
      averageBuilderTrophies,
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
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <div className="h-6 w-6 animate-pulse rounded bg-slate-300 dark:bg-slate-500"></div>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading roster metrics…</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'No data';
    return value.toLocaleString();
  };

  const averageTownHall = stats.averageTownHall ?? 0;
  const averageTrophies = stats.averageTrophies ?? 0;

  const metrics = [
    {
      label: 'Members',
      value: formatNumber(stats.memberCount),
      icon: <span className="text-3xl">👥</span>,
    },
    {
      label: 'Avg Town Hall',
      value: averageTownHall > 0 ? `${averageTownHall}` : '—',
      icon:
        averageTownHall > 0 ? (
          <TownHallBadge level={averageTownHall} size="lg" showLevel={false} showBox={false} className="h-14 w-14" />
        ) : (
          <span className="text-3xl">🏰</span>
        ),
    },
    {
      label: 'Avg Trophies',
      value: averageTrophies > 0 ? formatNumber(averageTrophies) : '—',
      icon:
        averageTrophies > 0 ? (
          <LeagueBadge trophies={averageTrophies} showText={false} size="xxl" className="h-28 w-28 max-w-[5.5rem]" />
        ) : (
          <span className="text-3xl">🏆</span>
        ),
    },
    {
      label: 'Total Donations',
      value: formatNumber(stats.totalDonations),
      icon: <span className="text-3xl">💝</span>,
    },
    {
      label: 'Avg Donations',
      value: stats.averageDonations != null ? formatNumber(stats.averageDonations) : '—',
      icon: <span className="text-3xl">📊</span>,
    },
    {
      label: 'Avg Builder Base',
      value:
        stats.averageBuilderTrophies != null && stats.averageBuilderTrophies > 0
          ? formatNumber(stats.averageBuilderTrophies)
          : '—',
      icon: <span className="text-3xl">🏗️</span>,
    },
    {
      label: 'War Win Rate',
      value: warWinRate != null && warWinRate >= 0 ? `${warWinRate}%` : '—',
      icon: <span className="text-3xl">⚔️</span>,
    },
  ];

  return (
    <GlassCard className={panelClassName}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-4 text-slate-900 dark:text-white">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center text-3xl">
                {metric.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="metric-value text-2xl font-extrabold leading-tight sm:text-[26px]">
                  {metric.value}
                </div>
                <div className="metric-label mt-1">
                  {metric.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Updated timestamp */}
        {updatedAtLabel && (
          <div className="flex items-center justify-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Updated {updatedAtLabel}</p>
          </div>
        )}

        {/* War Information */}
        {(Boolean(currentWar) || recentWars.length > 0) && (
          <div className="space-y-4" style={{ position: 'relative', overflow: 'hidden' }}>
            {currentWar && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚔️</span>
                  <h3 className="font-semibold text-slate-800 dark:text-white">Current War</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {currentWar.opponent?.name ?? 'Unknown Opponent'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {currentWar.state ?? 'Unknown'}
                    </span>
                    {currentWar.teamSize && currentWar.teamSize > 0 && (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {currentWar.teamSize}v{currentWar.teamSize}
                      </span>
                    )}
                  </div>
                  {currentWar.endTime && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Ends {formatDistanceToNow(new Date(currentWar.endTime), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {recentWars.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📊</span>
                  <h3 className="font-semibold text-slate-800 dark:text-white">Recent Wars</h3>
                </div>
                <div className="space-y-2">
                  {recentWars.map((war, index) => {
                    const endDate = war.endTime ? new Date(war.endTime) : null;
                    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
                    const endedLabel = hasValidEnd
                      ? `ended ${formatDistanceToNow(endDate, { addSuffix: true })}`
                      : 'end time unavailable';

                    return (
                      <div key={war.endTime || `${war.opponent?.tag || 'war'}-${index}`} className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                            {war.opponent?.name ?? 'Unknown Opponent'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            war.result === 'WIN' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' 
                              : war.result === 'LOSE' 
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            {war.result ?? 'N/A'}
                          </span>
                        </div>
                          <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">
                            {war.teamSize && war.teamSize > 0 ? `${war.teamSize}v${war.teamSize}` : 'Unknown size'} • {endedLabel}
                          </p>
                      </div>
                    );
                  })}
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
