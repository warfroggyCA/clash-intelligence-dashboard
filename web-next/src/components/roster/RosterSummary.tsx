"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import React, { useMemo, useRef, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { GlassCard, TownHallBadge, LeagueBadge, Modal } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import {
  calculateRushPercentage,
  getTownHallLevel,
} from '@/lib/business/calculations';
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';
import dynamic from 'next/dynamic';
import { parseUtcDate, formatUtcDateTime, formatUtcDate } from '@/lib/date-format';
const AceLeaderboardCard = dynamic(() => import('./AceLeaderboardCard'), { ssr: false });

interface HighlightEntry {
  label: string;
  value: string;
  subtitle?: string;
  hint?: string;
}

type HeroKey = 'bk' | 'aq' | 'gw' | 'rc' | 'mp';


interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}

const IconWrapper = ({ icon }: { icon: React.ReactNode }) => {
  if (typeof icon === 'string') {
    return <span className="text-xl">{icon}</span>;
  }
  return <>{icon}</>;
};

const StatTile = ({ icon, label, value, hint }: StatTileProps) => (
  <div
    className={`stat-tile rounded-2xl border border-brand-border/70 bg-brand-surfaceSubtle/70 px-4 py-3 ${hint ? 'tooltip-trigger' : ''}`}
    data-tooltip={hint ?? undefined}
    aria-label={hint ? `${label}. ${hint}` : undefined}
  >
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
  return value.toLocaleString('en-US', options);
};

const formatDurationMs = (ms: number | null | undefined) => {
  if (!ms || !Number.isFinite(ms)) return '—';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

// REMOVED: Moved to bottom with React.memo wrapper

const RosterSummaryInner = () => {
  // Diagnostics toggles (compile-time)
  const RS_DISABLE_STATS = process.env.NEXT_PUBLIC_RS_DISABLE_STATS === 'true';
  const RS_DISABLE_WAR = process.env.NEXT_PUBLIC_RS_DISABLE_WAR === 'true';
  const RS_DISABLE_HIGHLIGHTS = process.env.NEXT_PUBLIC_RS_DISABLE_HIGHLIGHTS === 'true';
  const RS_DISABLE_MODAL = process.env.NEXT_PUBLIC_RS_DISABLE_MODAL === 'true';
  const RS_DEBUG_LOG = process.env.NEXT_PUBLIC_RS_DEBUG_LOG === 'true';

  // Render counter for debugging re-renders
  const renderCountRef = useRef(0);
  if (RS_DEBUG_LOG) {
    renderCountRef.current += 1;
  }

  const [showAceModal, setShowAceModal] = useState(false);
  
  // CRITICAL FIX: Use a single stable subscription that only updates when roster data actually changes
  // DO NOT subscribe to individual fields that might trigger on unrelated state changes
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const lastLoadInfo = useDashboardStore((state) => state.lastLoadInfo);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;
  const ingestionHealth = useDashboardStore((state) => state.ingestionHealth);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const refreshData = useDashboardStore((state) => state.refreshData);
  const triggerIngestion = useDashboardStore((state) => state.triggerIngestion);
  const currentClanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  
  // CRITICAL: Use latestSnapshotId as the ONLY dependency - this only changes when roster data changes
  // Do NOT subscribe to memberCount or any other derived values
  const latestSnapshotId = useDashboardStore((state) => state.latestSnapshotId);
  
  // Get roster once based on latestSnapshotId only - this breaks the infinite loop
  const roster = useMemo(() => {
    const currentRoster = useDashboardStore.getState().roster;
    if (RS_DEBUG_LOG) {
      console.log('[RosterSummary] roster useMemo triggered', {
        snapshotId: latestSnapshotId,
        memberCount: currentRoster?.members?.length ?? 0
      });
    }
    return currentRoster;
  }, [latestSnapshotId, RS_DEBUG_LOG]);
  
  // Use latestSnapshotId as the ONLY stable key - this is the only thing that changes when data actually updates
  const stableRosterKey = latestSnapshotId || roster?.date || 'no-snapshot';
  
  // Add canRunIngestion logic similar to CommandRail
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const userRoles = useDashboardStore((state) => state.userRoles);
  const canRunIngestion = useMemo(() => {
    const normalized = currentClanTag ? currentClanTag.replace('#', '') : '';
    if (impersonatedRole) {
      return impersonatedRole === 'leader' || impersonatedRole === 'coleader';
    }
    return userRoles?.some(role => role.role === 'leader' || role.role === 'coleader') || false;
  }, [impersonatedRole, userRoles, currentClanTag]);
  const seasonId = snapshotMetadata?.seasonId ?? roster?.snapshotMetadata?.seasonId ?? roster?.meta?.seasonId ?? null;
  const seasonStartIso = snapshotMetadata?.seasonStart ?? roster?.snapshotMetadata?.seasonStart ?? roster?.meta?.seasonStart ?? null;
  const seasonEndIso = snapshotMetadata?.seasonEnd ?? roster?.snapshotMetadata?.seasonEnd ?? roster?.meta?.seasonEnd ?? null;

  const seasonBounds = useMemo(() => {
    if (!seasonStartIso || !seasonEndIso) return null;
    const start = new Date(seasonStartIso);
    const end = new Date(seasonEndIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const now = new Date();
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = Math.max(0, Math.min(totalMs, now.getTime() - start.getTime()));
    const progress = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : null;
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, progress, daysLeft };
  }, [seasonStartIso, seasonEndIso]);

  const stats = useMemo(() => {
    if (RS_DISABLE_STATS) {
      return {
        memberCount: 0,
        averageTownHall: null,
        averageTrophies: null,
        totalDonations: null,
        averageDonations: null,
        averageBuilderTrophies: null,
        averageHeroLevels: null,
        mostCommonLeague: null,
      } as const;
    }
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
        mostCommonLeague: null,
      };
    }

    const averageTownHall = Math.round(
      members.reduce((sum, member) => sum + (member.townHallLevel || member.th || 0), 0) /
        memberCount
    );

    const averageTrophies = Math.round(
      members.reduce((sum, member) => sum + (((member as any).rankedTrophies ?? member.trophies) || 0), 0) /
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

    // Calculate most common league (mode) from ranked leagues
    // Strip tier numbers to get base league name (e.g., "Wizard League 12" -> "Wizard League")
    const leagueCounts = new Map<string, number>();
    members.forEach((member) => {
      const rankedName = (member as any).rankedLeagueName;
      if (rankedName && rankedName !== 'Unranked') {
        // Extract base league name by removing trailing numbers
        const baseLeague = rankedName.replace(/\s+\d+$/, '');
        leagueCounts.set(baseLeague, (leagueCounts.get(baseLeague) || 0) + 1);
      }
    });
    
    let mostCommonLeague: string | null = null;
    let maxCount = 0;
    leagueCounts.forEach((count, league) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLeague = league;
      }
    });

    return {
      memberCount,
      averageTownHall,
      averageTrophies,
      totalDonations,
      averageDonations,
      averageBuilderTrophies,
      averageHeroLevels,
      mostCommonLeague,
    };
  }, [stableRosterKey, RS_DISABLE_STATS]);

  const aceScores = useMemo(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_ACE_IN_SUMMARY === 'true') return [];
    if (!roster?.members?.length) {
      return [];
    }
    const inputs = createAceInputsFromRoster(roster);
    return calculateAceScores(inputs);
  }, [stableRosterKey]);

  const aceLeader = aceScores[0];
  const aceLeaderScoreLabel = typeof aceLeader?.ace === 'number' ? aceLeader.ace.toFixed(1) : null;
  const aceAvailabilityPercent = typeof aceLeader?.availability === 'number'
    ? Math.round(Math.max(0, Math.min(1, aceLeader.availability)) * 100)
    : null;

  const { currentWar, recentWars, warWinRate } = useMemo(() => {
    if (RS_DISABLE_WAR) {
      return { currentWar: null, recentWars: [], warWinRate: null } as const;
    }
    const warLog = snapshotDetails?.warLog ?? [];
    const recent = warLog.slice(0, 3);
    const wins = recent.filter((war) => war.result === 'WIN').length;
    const winRate = recent.length ? Math.round((wins / recent.length) * 100) : null;

    return {
      currentWar: snapshotDetails?.currentWar ?? null,
      recentWars: recent,
      warWinRate: winRate,
    };
  }, [snapshotDetails, RS_DISABLE_WAR]);

  const capitalSummary = snapshotDetails?.capitalRaidSeasons?.[0] ?? null;

  const fetchedAtDate = useMemo(() => parseUtcDate(dataFetchedAt), [dataFetchedAt]);
  const updatedAtRelative = useMemo(() => {
    if (!fetchedAtDate) return null;
    return formatDistanceToNow(fetchedAtDate, { addSuffix: true });
  }, [fetchedAtDate]);
  const updatedAtUtc = useMemo(() => {
    if (!fetchedAtDate) return null;
    return formatUtcDateTime(fetchedAtDate);
  }, [fetchedAtDate]);
  const snapshotDateLabel = useMemo(() => {
    const raw = snapshotMetadata?.snapshotDate ?? null;
    if (!raw) return null;
    const parsed = parseUtcDate(raw);
    return parsed ? formatUtcDate(parsed) : raw;
  }, [snapshotMetadata?.snapshotDate]);

  const statTiles = useMemo<StatTileProps[]>(() => {
    if (RS_DISABLE_STATS) return [];
    const tiles: StatTileProps[] = [
      { icon: '👥', label: 'Members', value: formatNumber(stats.memberCount), hint: 'Active members currently on the roster snapshot.' },
      {
        icon: <TownHallBadge level={stats.averageTownHall || 0} size="md" />,
        label: 'Avg. Town Hall',
        value: stats.averageTownHall ? `TH${stats.averageTownHall}` : '—',
        hint: 'Average Town Hall level across members with a recorded TH value.',
      },
    ];

    // Add league tile if we have a most common league
    if (stats.mostCommonLeague) {
      tiles.push({
        icon: <LeagueBadge 
          league={stats.mostCommonLeague} 
          size="xl" 
          showText={false} 
        />,
        label: 'Common League',
        value: stats.mostCommonLeague,
        hint: 'Most common ranked league among clan members (excludes Unranked).',
      });
    }

    tiles.push(
      { icon: '🤝', label: 'Total Donations', value: formatNumber(stats.totalDonations), hint: 'Season-to-date donations collectively delivered by the roster.' }
    );

    if (stats.averageDonations != null) {
      tiles.push({
        icon: '🎁',
        label: 'Avg. Donations',
        value: formatNumber(stats.averageDonations),
        hint: 'Average donations per member for the current season.',
      });
    }

    if (stats.averageBuilderTrophies != null && stats.averageBuilderTrophies > 0) {
      tiles.push({
        icon: '⚒️',
        label: 'Avg. Builder Trophies',
        value: formatNumber(stats.averageBuilderTrophies),
        hint: 'Average Builder Base trophy count across members with recorded versus trophies.',
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
          hint: 'Average unlocked hero levels (BK/AQ/GW/RC plus MP where present).',
        });
      }
    }

    if (warWinRate != null) {
      tiles.push({
        icon: '⚔️',
        label: 'Recent War Win Rate',
        value: `${warWinRate}%`,
        hint: 'Win rate across the last 3 wars in the log.',
      });
    }

    return tiles;
  }, [stats, warWinRate, RS_DISABLE_STATS]);

  const recentWarRecord = useMemo(() => {
    if (RS_DISABLE_WAR) return null;
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
  }, [recentWars, RS_DISABLE_WAR]);

  const warEndsLabel = useMemo(() => {
    if (RS_DISABLE_WAR) return null;
    if (!currentWar?.endTime) {
      return null;
    }
    const endDate = new Date(currentWar.endTime);
    if (Number.isNaN(endDate.getTime())) {
      return null;
    }
    return formatDistanceToNow(endDate, { addSuffix: true });
  }, [currentWar?.endTime, RS_DISABLE_WAR]);

  const warSectionNodes = useMemo(() => {
    if (RS_DISABLE_WAR) return [];
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
              <p className="text-xs text-slate-400" suppressHydrationWarning>Ends {warEndsLabel}</p>
            )}
          </div>
        </div>
      );
    }

    if (recentWars.length > 0) {
      sections.push(
        <div key="recent-wars" className="rounded-2xl bg-brand-surfaceSubtle/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">🏆</span>
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
                  <p className="mt-2 text-xs text-slate-400" suppressHydrationWarning>
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
  }, [currentWar, recentWars, warEndsLabel, RS_DISABLE_WAR]);

  const capitalSectionNodes = useMemo(() => {
    if (RS_DISABLE_WAR) return [];
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
  }, [capitalSummary, recentWarRecord, warWinRate, RS_DISABLE_WAR]);

  const hasActivityContent = warSectionNodes.length > 0 || capitalSectionNodes.length > 0;
  const activityColumnsClass = warSectionNodes.length && capitalSectionNodes.length ? 'lg:grid-cols-2' : '';

  const topDonors = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => ({
        name: member.name,
        donations:
          (typeof member.metrics?.donations_given?.value === 'number'
            ? member.metrics?.donations_given?.value
            : member.donations) || 0,
        tag: member.tag,
      }))
      .filter((entry) => entry.donations > 0)
      .sort((a, b) => b.donations - a.donations)
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: formatNumber(entry.donations),
        subtitle: entry.tag,
        hint: 'Total troops donated this season. High numbers indicate members fueling clan attacks.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const leastRushed = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => ({
        name: member.name,
        tag: member.tag,
        rushPercent:
          typeof member.metrics?.rush_percent?.value === 'number'
            ? member.metrics.rush_percent.value
            : calculateRushPercentage(member),
      }))
      .filter((entry) => Number.isFinite(entry.rushPercent))
      .sort((a, b) => (a.rushPercent ?? 0) - (b.rushPercent ?? 0))
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: `${entry.rushPercent?.toFixed(0)}%`,
        subtitle: entry.tag,
        hint: 'Hero rush percentage – lower is healthier. Tracks average gap vs. Town Hall caps.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const topCapitalContributors = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
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
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const donationBalanceLeaders = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => {
        const balanceMetric = member.metrics?.donation_balance?.value;
        const balance =
          typeof balanceMetric === 'number'
            ? balanceMetric
            : (member.donations || 0) - (member.donationsReceived || 0);

        return {
          name: member.name,
          tag: member.tag,
          balance,
        };
      })
      .filter((entry) => Number.isFinite(entry.balance))
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
      .slice(0, 3)
      .map((entry, index) => ({
        label: `${index + 1}. ${entry.name}`,
        value: `${formatNumber(Math.round(entry.balance ?? 0))}`,
        subtitle: entry.tag,
        hint: 'Donations given minus received. Positive balance shows who props up clan request volume.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const donationDeficitAlerts = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => {
        const balanceMetric = member.metrics?.donation_balance?.value;
        const balance =
          typeof balanceMetric === 'number'
            ? balanceMetric
            : (member.donations || 0) - (member.donationsReceived || 0);
        return {
          name: member.name,
          tag: member.tag,
          balance,
        };
      })
      .filter((entry) => typeof entry.balance === 'number' && entry.balance < 0)
      .sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0))
      .slice(0, 3)
      .map((entry) => ({
        label: entry.name,
        value: formatNumber(Math.round(entry.balance ?? 0)),
        subtitle: entry.tag,
        hint: 'Members receiving more troops than they donate. Monitor and coach to keep clan supply balanced.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const rushAlerts = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
    if (!roster?.members?.length) return [];

    return roster.members
      .map((member) => {
        const rushMetric = member.metrics?.rush_percent?.value;
        const rush =
          typeof rushMetric === 'number'
            ? rushMetric
            : calculateRushPercentage(member);
        return {
          name: member.name,
          tag: member.tag,
          rush,
        };
      })
      .filter((entry) => typeof entry.rush === 'number' && entry.rush >= 60)
      .sort((a, b) => (b.rush ?? 0) - (a.rush ?? 0))
      .slice(0, 3)
      .map((entry) => ({
        label: entry.name,
        value: `${Math.round(entry.rush ?? 0)}%`,
        subtitle: entry.tag,
        hint: 'Hero rush is 60%+ below cap. Prioritize upgrades before next war season.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const heroLeaders = useMemo<HighlightEntry[]>(() => {
    if (RS_DISABLE_HIGHLIGHTS) return [];
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
        hint: 'Total hero levels summed across BK, AQ, GW, RC, MP. Highlights raw hero power.',
      }));
  }, [stableRosterKey, RS_DISABLE_HIGHLIGHTS]);

  const hasHighlightLists = !RS_DISABLE_HIGHLIGHTS && Boolean(
    topDonors.length ||
      leastRushed.length ||
      donationBalanceLeaders.length ||
      donationDeficitAlerts.length ||
      rushAlerts.length ||
      topCapitalContributors.length ||
      heroLeaders.length
  );

  // Log after commit, once per render, for diagnostics
  useEffect(() => {
    if (!RS_DEBUG_LOG) return;
    // Summaries of section sizes for quick diffing
    const summary = {
      renders: renderCountRef.current,
      statsTiles: statTiles.length,
      warSections: warSectionNodes.length + capitalSectionNodes.length,
      highlights: topDonors.length + leastRushed.length + donationBalanceLeaders.length + donationDeficitAlerts.length + rushAlerts.length + topCapitalContributors.length + heroLeaders.length,
    };
    // eslint-disable-next-line no-console
    console.log('[RosterSummary] render', summary);
  });

  return (
    <div className="space-y-4">
      {/* Stale snapshot banner (prompt threshold: 48h) */}
      {typeof dataAgeHours === 'number' && dataAgeHours >= 48 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Snapshot is {Math.floor(dataAgeHours / 24)} day{Math.floor(dataAgeHours / 24) === 1 ? '' : 's'} old</p>
              <p className="text-sm text-amber-200/90">Data may be outdated. Refresh to pull the latest snapshot; leaders can run ingestion if needed.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refreshData()}
                className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-2 text-sm hover:bg-amber-500/30"
              >
                Refresh Snapshot
              </button>
              {canRunIngestion && (
                <button
                  onClick={() => triggerIngestion(currentClanTag)}
                  className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-2 text-sm hover:bg-amber-500/30"
                >
                  Run Ingestion
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <GlassCard className="space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Roster Snapshot</p>
            <h3 className="text-xl font-semibold text-slate-100">Clan Overview</h3>
            {(seasonId || seasonBounds) && (
              <div
                className="mt-3 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-sm text-slate-200"
                title="Season runs on monthly Clash resets (05:00 UTC). Track progress to time promotions and reviews."
              >
                {seasonId && <div className="font-semibold">Season {seasonId}</div>}
                {seasonBounds && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>
                      {seasonBounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {seasonBounds.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {typeof seasonBounds.progress === 'number' && (
                      <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-slate-300" suppressHydrationWarning>
                        {seasonBounds.progress}% complete
                      </span>
                    )}
                    {typeof seasonBounds.daysLeft === 'number' && (
                      <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-slate-300" suppressHydrationWarning>
                        {seasonBounds.daysLeft} day{seasonBounds.daysLeft === 1 ? '' : 's'} remaining
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {statTiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>

          {(updatedAtUtc || lastLoadInfo) && (
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-200">
              {updatedAtUtc && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Data Freshness</p>
                  <p className="font-medium text-slate-100" suppressHydrationWarning>
                    Updated {updatedAtUtc} UTC
                    {updatedAtRelative ? ` • ${updatedAtRelative}` : ''}
                  </p>
                  {snapshotDateLabel && (
                    <p className="text-xs text-slate-400" suppressHydrationWarning>
                      Clash Snapshot Date {snapshotDateLabel} (UTC)
                    </p>
                  )}
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
          {ingestionHealth && (
            <div className="rounded-2xl border border-slate-700/40 bg-brand-surfaceSubtle/50 px-4 py-3 text-sm text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Ingestion Health</p>
                  <p className="font-medium text-slate-100" suppressHydrationWarning>
                    {ingestionHealth.finishedAt
                      ? `Last run ${formatDistanceToNow(new Date(ingestionHealth.finishedAt), { addSuffix: true })}`
                      : `Started ${formatDistanceToNow(new Date(ingestionHealth.startedAt), { addSuffix: true })}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    Duration {formatDurationMs(ingestionHealth.totalDurationMs)} • {ingestionHealth.status}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    ingestionHealth.anomalies.length || ingestionHealth.stale
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-emerald-400/15 text-emerald-200'
                  }`}
                >
                  {ingestionHealth.anomalies.length
                    ? `${ingestionHealth.anomalies.length} issue${ingestionHealth.anomalies.length === 1 ? '' : 's'}`
                    : ingestionHealth.stale
                      ? 'Needs refresh'
                      : 'Healthy'}
                </span>
              </div>
              {ingestionHealth.anomalies.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-200">
                  {ingestionHealth.anomalies.map((issue, index) => (
                    <li
                      key={`${issue.phase}-${index}`}
                      className="tooltip-trigger"
                      data-tooltip={issue.message}
                    >
                      ⚠️ {issue.phase}: {issue.message}
                    </li>
                  ))}
                </ul>
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
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
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
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-slate-100">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {donationBalanceLeaders.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Donation Balance</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {donationBalanceLeaders.map((entry) => (
                    <li
                      key={`${entry.label}-balance`}
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-emerald-200">
                        {entry.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {donationDeficitAlerts.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Donation Deficit Watch</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {donationDeficitAlerts.map((entry) => (
                    <li
                      key={`${entry.label}-deficit`}
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-rose-300">
                        {entry.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rushAlerts.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">High Rush Priority</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {rushAlerts.map((entry) => (
                    <li
                      key={`${entry.label}-rush-alert`}
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
                    >
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-amber-200">
                        {entry.value}
                      </span>
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
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none tooltip-trigger"
                      data-tooltip="Season total capital gold donated. Shows who fuels raid weekend upgrades."
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
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Hero Power</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {heroLeaders.map((entry) => (
                    <li
                      key={`${entry.label}-hero`}
                      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none ${entry.hint ? 'tooltip-trigger' : ''}`}
                      data-tooltip={entry.hint ?? undefined}
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

      {!RS_DISABLE_MODAL && (
        <Modal
          isOpen={showAceModal}
          onClose={() => setShowAceModal(false)}
          title="ACE Leaderboard"
          size="xl"
        >
          <AceLeaderboardCard className="shadow-none hover:translate-y-0" />
        </Modal>
      )}
    </div>
  );
};

// CRITICAL FIX: Wrap in React.memo to prevent unnecessary re-renders
// This prevents the component from re-rendering when unrelated store values change
const MemoizedRosterSummaryInner = React.memo(RosterSummaryInner);

// Shell component with SSR hydration guard
const RosterSummaryShell = () => {
  // EMERGENCY FIX: Completely disable RosterSummary until infinite loop is resolved
  return (
    <div className="rounded-2xl border border-yellow-500/70 bg-yellow-900/20 p-6 text-yellow-200">
      <h3 className="text-lg font-semibold mb-2">⚠️ Roster Summary Temporarily Disabled</h3>
      <p className="text-sm">
        This component is being rebuilt to fix the React 185 infinite loop error.
        Roster table below is fully functional.
      </p>
    </div>
  );
};

// CRITICAL: Wrap the shell too to prevent parent re-renders from cascading
export const RosterSummary = React.memo(RosterSummaryShell);

export default RosterSummary;

/* eslint-enable react-hooks/exhaustive-deps */
