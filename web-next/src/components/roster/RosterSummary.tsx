"use client";

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { GlassCard, TownHallBadge, LeagueBadge, Modal } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import {
  calculateRushPercentage,
  getTownHallLevel,
} from '@/lib/business/calculations';
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';
import AceLeaderboardCard from './AceLeaderboardCard';

interface HighlightEntry {
  label: string;
  value: string;
  subtitle?: string;
}

type HeroKey = 'bk' | 'aq' | 'gw' | 'rc' | 'mp';


interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
}

const IconWrapper = ({ icon }: { icon: React.ReactNode }) => {
  if (typeof icon === 'string') {
    return <span className="text-xl">{icon}</span>;
  }
  return <>{icon}</>;
};

const StatTile = ({ icon, label, value }: StatTileProps) => (
  <div className="stat-tile rounded-2xl border border-brand-border/70 bg-brand-surfaceSubtle/70 px-4 py-3">
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center">
        <IconWrapper icon={icon} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-slate-100">{value}</p>
      </div>
    </div>
  </div>
);

const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, options);
};

export const RosterSummary = () => {
  const [showAceModal, setShowAceModal] = useState(false);
  const roster = useDashboardStore((state) => state.roster);
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const lastLoadInfo = useDashboardStore((state) => state.lastLoadInfo);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  const stats = useMemo(() => {
    const members = roster?.members ?? [];
    const memberCount = members.length;

    if (!memberCount) {
      return {
        memberCount: 0,
        averageTownHall: null,
        averageTrophies: null,
        totalDonations: null,
        averageDonations: null,
        averageBuilderTrophies: null,
        averageHeroLevels: null,
      };
    }

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
      members.reduce((sum, member) => sum + (member.versusTrophies || 0), 0) /
        memberCount
    );

    const heroSums: Record<HeroKey, number> = { bk: 0, aq: 0, gw: 0, rc: 0, mp: 0 };
    const heroCounts: Record<HeroKey, number> = { bk: 0, aq: 0, gw: 0, rc: 0, mp: 0 };

    members.forEach((member) => {
      const entries: Array<[HeroKey, number | null | undefined]> = [
        ['bk', member.bk],
        ['aq', member.aq],
        ['gw', member.gw],
        ['rc', member.rc],
        ['mp', member.mp],
      ];

      entries.forEach(([key, level]) => {
        if (typeof level === 'number' && level > 0) {
          heroSums[key] += level;
          heroCounts[key] += 1;
        }
      });
    });

    const averageHeroLevels = {
      bk: heroCounts.bk ? Math.round(heroSums.bk / heroCounts.bk) : null,
      aq: heroCounts.aq ? Math.round(heroSums.aq / heroCounts.aq) : null,
      gw: heroCounts.gw ? Math.round(heroSums.gw / heroCounts.gw) : null,
      rc: heroCounts.rc ? Math.round(heroSums.rc / heroCounts.rc) : null,
      mp: heroCounts.mp ? Math.round(heroSums.mp / heroCounts.mp) : null,
    };

    return {
      memberCount,
      averageTownHall,
      averageTrophies,
      totalDonations,
      averageDonations,
      averageBuilderTrophies,
      averageHeroLevels,
    };
  }, [roster?.members]);

  const aceScores = useMemo(() => {
    if (!roster?.members?.length) {
      return [];
    }
    const inputs = createAceInputsFromRoster(roster);
    return calculateAceScores(inputs);
  }, [roster]);

  const aceLeader = aceScores[0];
  const aceLeaderScoreLabel = typeof aceLeader?.ace === 'number' ? aceLeader.ace.toFixed(1) : null;
  const aceAvailabilityPercent = typeof aceLeader?.availability === 'number'
    ? Math.round(Math.max(0, Math.min(1, aceLeader.availability)) * 100)
    : null;

  const { currentWar, recentWars, warWinRate } = useMemo(() => {
    const warLog = snapshotDetails?.warLog ?? [];
    const recent = warLog.slice(0, 3);
    const wins = recent.filter((war) => war.result === 'WIN').length;
    const winRate = recent.length ? Math.round((wins / recent.length) * 100) : null;

    return {
      currentWar: snapshotDetails?.currentWar ?? null,
      recentWars: recent,
      warWinRate: winRate,
    };
  }, [snapshotDetails]);

  const capitalSummary = snapshotDetails?.capitalRaidSeasons?.[0] ?? null;

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

  const statTiles = useMemo<StatTileProps[]>(() => {
    const tiles: StatTileProps[] = [
      { icon: '👥', label: 'Members', value: formatNumber(stats.memberCount) },
      {
        icon: stats.averageTownHall ? (
          <TownHallBadge
            level={Math.max(1, Math.min(16, stats.averageTownHall))}
            showBox={false}
            showLevel={false}
            size="md"
          />
        ) : '🏰',
        label: 'Avg. Town Hall',
        value: stats.averageTownHall ? `TH${stats.averageTownHall}` : '—',
      },
      {
        icon: stats.averageTrophies ? (
          <LeagueBadge trophies={stats.averageTrophies} showText={false} size="xl" />
        ) : '🏆',
        label: 'Avg. Trophies',
        value: formatNumber(stats.averageTrophies),
      },
      { icon: '🤝', label: 'Total Donations', value: formatNumber(stats.totalDonations) },
    ];

    if (stats.averageDonations != null) {
      tiles.push({
        icon: '🎁',
        label: 'Avg. Donations',
        value: formatNumber(stats.averageDonations),
      });
    }

    if (stats.averageBuilderTrophies != null && stats.averageBuilderTrophies > 0) {
      tiles.push({
        icon: '⚒️',
        label: 'Avg. Builder Trophies',
        value: formatNumber(stats.averageBuilderTrophies),
      });
    }

    if (stats.averageHeroLevels) {
      const heroPieces = [
        stats.averageHeroLevels.bk ? `BK ${stats.averageHeroLevels.bk}` : null,
        stats.averageHeroLevels.aq ? `AQ ${stats.averageHeroLevels.aq}` : null,
        stats.averageHeroLevels.gw ? `GW ${stats.averageHeroLevels.gw}` : null,
        stats.averageHeroLevels.rc ? `RC ${stats.averageHeroLevels.rc}` : null,
        stats.averageHeroLevels.mp ? `MP ${stats.averageHeroLevels.mp}` : null,
      ].filter(Boolean) as string[];

      if (heroPieces.length) {
        tiles.push({
          icon: '🦸',
          label: 'Avg. Hero Levels',
          value: heroPieces.join(' • '),
        });
      }
    }

    if (warWinRate != null) {
      tiles.push({
        icon: '⚔️',
        label: 'Recent War Win Rate',
        value: `${warWinRate}%`,
      });
    }

    return tiles;
  }, [stats, warWinRate]);

  const recentWarRecord = useMemo(() => {
    if (!recentWars.length) {
      return null;
    }
    const wins = recentWars.filter((war) => war.result === 'WIN').length;
    const losses = recentWars.filter((war) => war.result === 'LOSE').length;
    const draws = recentWars.length - wins - losses;
    const parts = [`${wins} W`, `${losses} L`];
    if (draws > 0) {
      parts.push(`${draws} D`);
    }
    return parts.join(' / ');
  }, [recentWars]);

  const warEndsLabel = useMemo(() => {
    if (!currentWar?.endTime) {
      return null;
    }
    const endDate = new Date(currentWar.endTime);
    if (Number.isNaN(endDate.getTime())) {
      return null;
    }
    return formatDistanceToNow(endDate, { addSuffix: true });
  }, [currentWar?.endTime]);

  const warSectionNodes = useMemo(() => {
    const sections: React.ReactNode[] = [];
    if (currentWar) {
      sections.push(
        <div key="current-war" className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
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
            {warEndsLabel && (
              <p className="text-xs text-slate-400">Ends {warEndsLabel}</p>
            )}
          </div>
        </div>
      );
    }

    if (recentWars.length > 0) {
      sections.push(
        <div key="recent-wars" className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Recent Wars</h3>
          </div>
          <div className="space-y-2">
            {recentWars.map((war, index) => {
              const endDate = war.endTime ? new Date(war.endTime) : null;
              const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
              const endedLabel = hasValidEnd
                ? `ended ${formatDistanceToNow(endDate!, { addSuffix: true })}`
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
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        war.result === 'WIN'
                          ? 'bg-emerald-300/20 text-emerald-200'
                          : war.result === 'LOSE'
                            ? 'bg-rose-300/20 text-rose-200'
                            : 'bg-brand-surfaceSubtle text-slate-300'
                      }`}
                    >
                      {war.result ?? 'N/A'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {war.teamSize && war.teamSize > 0
                      ? `${war.teamSize}v${war.teamSize}`
                      : 'Unknown size'}{' '}
                    • {endedLabel}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return sections;
  }, [currentWar, recentWars, warEndsLabel]);

  const capitalSectionNodes = useMemo(() => {
    const sections: React.ReactNode[] = [];
    if (capitalSummary) {
      sections.push(
        <div key="capital" className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">🏰</span>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Latest Capital Raid</h3>
          </div>
          <p className="text-sm font-medium text-slate-100">
            Capital Hall {capitalSummary.capitalHallLevel ?? '—'}
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            <p>
              Offensive loot: <span className="text-slate-100">{formatNumber(capitalSummary.offensiveLoot)}</span>
            </p>
            <p>
              Defensive loot: <span className="text-slate-100">{formatNumber(capitalSummary.defensiveLoot)}</span>
            </p>
          </div>
        </div>
      );
    }

    if (recentWarRecord || warWinRate != null) {
      sections.push(
        <div key="recent-form" className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">📈</span>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Recent Form</h3>
          </div>
          <div className="space-y-2 text-sm text-slate-200">
            {recentWarRecord && (
              <div className="flex items-center justify-between">
                <span>Last 3 wars</span>
                <span className="font-semibold tabular-nums">{recentWarRecord}</span>
              </div>
            )}
            {warWinRate != null && (
              <div className="flex items-center justify-between">
                <span>Win rate</span>
                <span className="font-semibold">{warWinRate}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return sections;
  }, [capitalSummary, recentWarRecord, warWinRate]);

  const hasActivityContent = warSectionNodes.length > 0 || capitalSectionNodes.length > 0;
  const activityColumnsClass = warSectionNodes.length && capitalSectionNodes.length ? 'lg:grid-cols-2' : '';

  const topDonors = useMemo<HighlightEntry[]>(() => {
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => ({
        name: member.name,
        donations: member.donations || 0,
        tag: member.tag,
      }))
      .filter((entry) => entry.donations > 0)
      .sort((a, b) => b.donations - a.donations)
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: formatNumber(entry.donations),
        subtitle: entry.tag,
      }));
  }, [roster?.members]);

  const leastRushed = useMemo<HighlightEntry[]>(() => {
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => ({
        name: member.name,
        tag: member.tag,
        rushPercent: calculateRushPercentage(member),
      }))
      .filter((entry) => Number.isFinite(entry.rushPercent))
      .sort((a, b) => (a.rushPercent ?? 0) - (b.rushPercent ?? 0))
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: `${entry.rushPercent?.toFixed(0)}%`,
        subtitle: entry.tag,
      }));
  }, [roster?.members]);

  const topCapitalContributors = useMemo<HighlightEntry[]>(() => {
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => ({
        name: member.name,
        contributions: (member as any).clanCapitalContributions ?? 0,
      }))
      .filter((entry) => entry.contributions > 0)
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: formatNumber(entry.contributions),
      }));
  }, [roster?.members]);

  const heroLeaders = useMemo<HighlightEntry[]>(() => {
    if (!roster?.members?.length) return [];

    const withTotals = roster.members
      .map((member) => ({
        name: member.name,
        tag: member.tag,
        total: (member.bk || 0) + (member.aq || 0) + (member.gw || 0) + (member.rc || 0) + (member.mp || 0),
        th: getTownHallLevel(member),
      }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return withTotals.map((entry, index) => ({
      label: `${index + 1}. ${entry.name}`,
      value: formatNumber(entry.total),
      subtitle: `${entry.tag} • TH${entry.th}`,
    }));
  }, [roster?.members]);

  const hasHighlightLists = Boolean(
    topDonors.length ||
      leastRushed.length ||
      topCapitalContributors.length ||
      heroLeaders.length
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <GlassCard className="space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Roster Snapshot</p>
            <h3 className="text-xl font-semibold text-slate-100">Clan Overview</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {statTiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>

          {(updatedAtLabel || lastLoadInfo) && (
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-200">
              {updatedAtLabel && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Data Freshness</p>
                  <p className="font-medium text-slate-100">Updated {updatedAtLabel}</p>
                </div>
              )}
              {lastLoadInfo && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Last Load</p>
                  <p className="font-medium text-slate-100">{`${lastLoadInfo.source ?? 'unknown'} • ${lastLoadInfo.ms ?? 0}ms`}</p>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Activity Pulse</p>
            <h3 className="text-xl font-semibold text-slate-100">War &amp; Capital Status</h3>
          </div>

          {hasActivityContent ? (
            <div className={`grid gap-4 ${activityColumnsClass}`}>
              {warSectionNodes.length > 0 && <div className="space-y-4">{warSectionNodes}</div>}
              {capitalSectionNodes.length > 0 && <div className="space-y-4">{capitalSectionNodes}</div>}
            </div>
          ) : (
            <p className="rounded-2xl bg-brand-surfaceSubtle/40 p-4 text-sm text-slate-300">
              No active war or capital data right now.
            </p>
          )}
        </GlassCard>
      </div>

      <GlassCard className="space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Highlights</p>
          <h3 className="text-xl font-semibold text-slate-100">Leaders at a glance</h3>
        </div>

        {aceLeader && (
          <div className="flex flex-col gap-4 rounded-2xl bg-brand-surfaceSubtle/60 px-4 py-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-2xl bg-brand-surfaceRaised/70"
                style={{ width: '64px', height: '64px' }}
              >
                <Image
                  src="/King_champ.WEBP"
                  alt="ACE champion badge"
                  width={64}
                  height={64}
                  className="object-contain"
                  style={{ width: '64px', height: '64px' }}
                  priority={false}
                />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">ACE Leader</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{aceLeader.name}</p>
                    <p className="text-xs text-slate-300">
                      {aceLeaderScoreLabel && <span>Score {aceLeaderScoreLabel}</span>}
                      {aceLeaderScoreLabel && aceAvailabilityPercent != null && <span> • </span>}
                      {aceAvailabilityPercent != null && <span>Availability {aceAvailabilityPercent}%</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAceModal(true)}
                    className="inline-flex items-center justify-center rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70"
                  >
                    View ACE Leaderboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasHighlightLists ? (
          <div className="grid gap-y-10 gap-x-16 md:grid-cols-2 xl:grid-cols-4">
            {topDonors.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Donors</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {topDonors.map((entry) => (
                    <li
                      key={`${entry.label}-donations`}
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none"
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-slate-100">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {leastRushed.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Best Hero Rush %</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {leastRushed.map((entry) => (
                    <li
                      key={`${entry.label}-rush`}
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none"
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-slate-100">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topCapitalContributors.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Capital Contributors</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {topCapitalContributors.map((entry) => (
                    <li
                      key={`${entry.label}-capital`}
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none"
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-amber-200">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {heroLeaders.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Hero Power</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {heroLeaders.map((entry) => (
                    <li
                      key={`${entry.label}-hero`}
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none"
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-slate-100">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-300">No roster highlights available yet.</p>
        )}
      </GlassCard>

      <Modal
        isOpen={showAceModal}
        onClose={() => setShowAceModal(false)}
        title="ACE Leaderboard"
        size="xl"
      >
        <AceLeaderboardCard className="shadow-none hover:translate-y-0" />
      </Modal>
    </div>
  );
};

export default RosterSummary;
