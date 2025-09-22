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

  const metrics = [
    {
      label: 'Members',
      value: stats.memberCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      icon: '👥',
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      label: 'Avg Town Hall',
      value: stats.averageTownHall.toString(),
      icon: '🏰',
      color: 'purple',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      textColor: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      label: 'Avg Trophies',
      value: stats.averageTrophies.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      icon: '🏆',
      color: 'amber',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    {
      label: 'Total Donations',
      value: stats.totalDonations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      icon: '💝',
      color: 'emerald',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    },
  ];

  if (warWinRate != null) {
    metrics.push({
      label: 'War Win Rate',
      value: `${warWinRate}%`,
      icon: '⚔️',
      color: 'rose',
      bgColor: 'bg-rose-50 dark:bg-rose-950/20',
      textColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-200 dark:border-rose-800',
    });
  }

  return (
    <GlassCard className={panelClassName}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`group relative overflow-hidden rounded-xl border ${metric.borderColor} ${metric.bgColor} p-4 transition-all hover:shadow-lg hover:shadow-${metric.color}-200/25 dark:hover:shadow-${metric.color}-900/25`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-slate-800 shadow-sm`}>
                  <span className="text-lg">{metric.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {metric.label}
                  </p>
                  <p className={`text-lg font-bold ${metric.textColor}`}>
                    {metric.value}
                  </p>
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
        {(currentWar || recentWars.length) && (
          <div className="space-y-4">
            {currentWar && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚔️</span>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Current War</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {currentWar.opponent?.name ?? 'Unknown Opponent'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {currentWar.state ?? 'Unknown'}
                    </span>
                    {currentWar.teamSize && (
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📊</span>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Recent Wars</h3>
                </div>
                <div className="space-y-2">
                  {recentWars.map((war, index) => {
                    const endDate = war.endTime ? new Date(war.endTime) : null;
                    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
                    const endedLabel = hasValidEnd
                      ? `ended ${formatDistanceToNow(endDate, { addSuffix: true })}`
                      : 'end time unavailable';

                    return (
                      <div key={war.endTime || `${war.opponent?.tag || 'war'}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
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
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {war.teamSize}v{war.teamSize} • {endedLabel}
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
