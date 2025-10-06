"use client";

import { useMemo, useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { GlassCard, TownHallBadge, LeagueBadge, Modal } from '@/components/ui';
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';
import type { AceScoreResult } from '@/lib/ace-score';
import AceLeaderboardCard from './AceLeaderboardCard';

interface RosterStatsPanelProps {
  className?: string;
}

interface HighlightMetric {
  label: string;
  value: string;
  subtitle?: string;
  badge?: ReactNode;
  townHallLevel?: number | null;
  trophies?: number;
  onClick?: () => void;
  fullWidth?: boolean;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const [mounted, setMounted] = useState(false);
  const [showAceModal, setShowAceModal] = useState(false);
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore((state) => state.snapshotDetails);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  const panelClassName = ['xl:min-h-[18rem]', className].filter(Boolean).join(' ');

  const aceScores = useMemo<AceScoreResult[]>(() => {
    if (!roster?.members?.length) {
      return [];
    }
    const inputs = createAceInputsFromRoster(roster);
    return calculateAceScores(inputs);
  }, [roster]);

  const aceLeader = aceScores[0];

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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !stats) {
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

  const highlightMetrics: HighlightMetric[] = [
    {
      label: 'Avg Town Hall',
      value: averageTownHall > 0 ? `TH${averageTownHall}` : 'No data',
      townHallLevel: averageTownHall > 0 ? averageTownHall : null,
    },
    {
      label: 'Avg Trophies',
      value: averageTrophies > 0 ? formatNumber(averageTrophies) : 'No data',
      trophies: averageTrophies > 0 ? averageTrophies : null,
    },
  ];

  if (aceLeader) {
    const availabilityPercent = Math.round((aceLeader.availability ?? 0) * 100);
    highlightMetrics.push({
      label: 'Current top player (ACE)',
      value: aceLeader.name,
      badge: (
        <div style={{ width: '72px', height: '72px' }}>
          <Image
            src="/King_champ.WEBP"
            alt="ACE champion badge"
            width={72}
            height={72}
            className="object-contain"
            style={{ width: '72px', height: '72px' }}
            priority
          />
        </div>
      ),
      onClick: () => setShowAceModal(true),
      fullWidth: true,
    });
  }

  const secondaryMetrics = [
    {
      label: 'Members',
      value: formatNumber(stats.memberCount),
    },
    {
      label: 'Total Donations',
      value: formatNumber(stats.totalDonations),
    },
    {
      label: 'Avg Donations',
      value: stats.averageDonations != null ? formatNumber(stats.averageDonations) : '—',
    },
    {
      label: 'Avg Builder Base',
      value:
        stats.averageBuilderTrophies != null && stats.averageBuilderTrophies > 0
          ? formatNumber(stats.averageBuilderTrophies)
          : '—',
    },
    {
      label: 'War Win Rate',
      value: warWinRate != null && warWinRate >= 0 ? `${warWinRate}%` : '—',
    },
  ];

  return (
    <GlassCard className={panelClassName}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {highlightMetrics.map((metric) => {
            const containerBase = "overflow-hidden rounded-3xl bg-brand-surfaceSubtle/70 px-5 py-5 text-slate-100 shadow-[0_18px_32px_-28px_rgba(8,15,31,0.7)] transition hover:shadow-[0_18px_32px_-24px_rgba(8,15,31,0.7)]";
            const containerClass = metric.fullWidth
              ? `${containerBase} sm:col-span-2`
              : containerBase;
            const valueStyle: CSSProperties | undefined = metric.fullWidth
              ? { fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }
              : undefined;
            const badgeWrapper = metric.fullWidth
              ? 'flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-surfaceRaised/70 sm:h-20 sm:w-20'
              : 'flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-surfaceRaised/70 sm:h-16 sm:w-16';

            const content = (
              <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
                  {metric.subtitle && (
                    <p className="text-xs font-medium text-slate-300">{metric.subtitle}</p>
                  )}
                  <p
                    className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl"
                    style={valueStyle}
                  >
                    {metric.value}
                  </p>
                </div>
                <div className={badgeWrapper}>
                  {metric.badge ? (
                    metric.badge
                  ) : metric.townHallLevel && metric.townHallLevel > 0 ? (
                    <TownHallBadge
                      level={metric.townHallLevel}
                      size="lg"
                      showLevel={false}
                      showBox={false}
                    />
                  ) : metric.trophies && metric.trophies > 0 ? (
                    <LeagueBadge
                      trophies={metric.trophies}
                      size="xl"
                      showText={false}
                    />
                  ) : (
                    <span className="text-3xl">🏆</span>
                  )}
                </div>
              </div>
            );

            if (metric.onClick) {
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={metric.onClick}
                  className={`${containerClass} text-left hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70`}
                >
                  {content}
                </button>
              );
            }

            return (
              <div key={metric.label} className={containerClass}>
                {content}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {secondaryMetrics.map((metric) => (
            <div key={metric.label} className="flex flex-col rounded-2xl bg-brand-surfaceSubtle/40 px-4 py-3 text-slate-100 shadow-[0_12px_28px_-26px_rgba(8,15,31,0.65)]">
              <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{metric.label}</span>
              <span className="mt-1 text-2xl font-semibold leading-tight sm:text-[26px]">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {/* Updated timestamp */}
        {updatedAtLabel && (
          <div className="flex items-center justify-center">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Updated {updatedAtLabel}</p>
          </div>
        )}

        {/* War Information */}
        {(Boolean(currentWar) || recentWars.length > 0) && (
          <div className="space-y-4" style={{ position: 'relative', overflow: 'hidden' }}>
            {currentWar && (
              <div className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">⚔️</span>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Current War</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-100">
                    {currentWar.opponent?.name ?? 'Unknown Opponent'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                    <span className="rounded-full bg-brand-surfaceRaised/70 px-2 py-1">
                      {currentWar.state ?? 'Unknown'}
                    </span>
                    {currentWar.teamSize && currentWar.teamSize > 0 && (
                      <span className="rounded-full bg-brand-surfaceRaised/70 px-2 py-1">
                        {currentWar.teamSize}v{currentWar.teamSize}
                      </span>
                    )}
                  </div>
                  {currentWar.endTime && (
                    <p className="text-xs text-slate-400">
                      Ends {formatDistanceToNow(new Date(currentWar.endTime), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {recentWars.length > 0 && (
              <div className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">📊</span>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Recent Wars</h3>
                </div>
                <div className="space-y-2">
                  {recentWars.map((war, index) => {
                    const endDate = war.endTime ? new Date(war.endTime) : null;
                    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
                    const endedLabel = hasValidEnd
                      ? `ended ${formatDistanceToNow(endDate, { addSuffix: true })}`
                      : 'end time unavailable';

                    return (
                      <div
                        key={war.endTime || `${war.opponent?.tag || 'war'}-${index}`}
                        className="rounded-xl bg-brand-surfaceRaised/70 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium text-slate-100">
                            {war.opponent?.name ?? 'Unknown Opponent'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            war.result === 'WIN'
                              ? 'bg-emerald-300/20 text-emerald-200'
                              : war.result === 'LOSE'
                                ? 'bg-rose-300/20 text-rose-200'
                                : 'bg-brand-surfaceSubtle text-slate-300'
                          }`}>
                            {war.result ?? 'N/A'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
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

      <Modal
        isOpen={showAceModal}
        onClose={() => setShowAceModal(false)}
        title="ACE Leaderboard"
        size="xl"
      >
        <AceLeaderboardCard className="shadow-none hover:translate-y-0" />
      </Modal>
    </GlassCard>
  );
};

export default RosterStatsPanel;
