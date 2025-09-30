"use client";

import { useMemo, type ReactNode } from 'react';
import { GlassCard, TownHallBadge, LeagueBadge } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import {
  calculateRushPercentage,
  getTownHallLevel,
} from '@/lib/business/calculations';

interface HighlightEntry {
  label: string;
  value: string;
  subtitle?: string;
}


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
  <div className="rounded-2xl border border-brand-border/70 bg-brand-surfaceSubtle/70 px-4 py-3">
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

const getFreshnessLabel = (hours: number | undefined) => {
  if (hours == null) return 'Unknown';
  if (hours <= 24) return 'Fresh (≤24h)';
  if (hours <= 48) return 'Stale (24–48h)';
  return 'Outdated (>48h)';
};

export const RosterSummary = () => {
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt);
  const lastLoadInfo = useDashboardStore((state) => state.lastLoadInfo);

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

    return {
      memberCount,
      averageTownHall,
      averageTrophies,
      totalDonations,
      averageDonations,
      averageBuilderTrophies,
    };
  }, [roster?.members]);

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

  const freshnessLabel = getFreshnessLabel(dataAgeHours);

  const snapshotDateLabel = snapshotMetadata?.snapshotDate
    ? safeLocaleDateString(snapshotMetadata.snapshotDate, {
        fallback: snapshotMetadata.snapshotDate,
        context: 'RosterSummary snapshotMetadata.snapshotDate',
      })
    : 'Unknown';

  const fetchedAtSource = snapshotMetadata?.fetchedAt ?? dataFetchedAt;
  const fetchedAtLabel = fetchedAtSource
    ? safeLocaleString(fetchedAtSource, {
        fallback: 'recently',
        context: 'RosterSummary snapshotMetadata.fetchedAt',
      })
    : 'Unknown';

  const currentWar = snapshotDetails?.currentWar;
  const warSummary = currentWar
    ? `${currentWar.state || 'unknown'} vs ${currentWar.opponent?.name ?? 'unknown opponent'} (Team ${
        currentWar.teamSize ?? '?'
      })`
    : null;

  const recentWarRecord = snapshotDetails?.warLog?.length
    ? (() => {
        const wins = snapshotDetails.warLog.filter((war) => war.result === 'WIN').length;
        return `${wins} W / ${snapshotDetails.warLog.length - wins} L`;
      })()
    : null;

  const capitalSummary = snapshotDetails?.capitalRaidSeasons?.[0];

  return (
    <div className="space-y-4">
      <GlassCard className="min-h-[12rem] space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Roster Snapshot</p>
          <h3 className="text-xl font-semibold text-slate-100">Clan Overview</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile icon="👥" label="Members" value={formatNumber(stats.memberCount)} />
          <StatTile
            icon={stats.averageTownHall ? (
              <TownHallBadge
                level={Math.max(1, Math.min(16, stats.averageTownHall))}
                showBox={false}
                showLevel={false}
                size="md"
              />
            ) : '🏰'}
            label="Avg. Town Hall"
            value={stats.averageTownHall ? `TH${stats.averageTownHall}` : '—'}
          />
          <StatTile
            icon={stats.averageTrophies ? (
              <LeagueBadge trophies={stats.averageTrophies} showText={false} size="xl" />
            ) : '🏆'}
            label="Avg. Trophies"
            value={formatNumber(stats.averageTrophies)}
          />
          <StatTile icon="🤝" label="Total Donations" value={formatNumber(stats.totalDonations)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-200">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Snapshot Date</p>
            <p className="font-medium text-slate-100">{snapshotDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Freshness</p>
            <p className="font-medium text-slate-100">{freshnessLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Fetched At</p>
            <p className="font-medium text-slate-100">{fetchedAtLabel}</p>
          </div>
          {lastLoadInfo && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Last Load</p>
              <p className="font-medium text-slate-100">{`${lastLoadInfo.source ?? 'unknown'} • ${lastLoadInfo.ms ?? 0}ms`}</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-200">
          {warSummary && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Current War</p>
              <p className="font-medium text-slate-100">{warSummary}</p>
            </div>
          )}
          {recentWarRecord && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Recent War Record</p>
              <p className="font-medium text-slate-100">{recentWarRecord}</p>
            </div>
          )}
          {capitalSummary && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Latest Capital Raid</p>
              <p className="font-medium text-slate-100">
                Hall {capitalSummary.capitalHallLevel} • Off {formatNumber(capitalSummary.offensiveLoot)} / Def {formatNumber(capitalSummary.defensiveLoot)}
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="min-h-[12rem]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Highlights</p>
          <h3 className="text-xl font-semibold text-slate-100">Leaders at a glance</h3>
        </div>
        <div className="mt-4 space-y-8">
          <div className="grid gap-y-10 gap-x-16 md:grid-cols-2 xl:grid-cols-4">
            {topDonors.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Donors</p>
                <ul className="w-full space-y-1.5 text-sm text-slate-200">
                  {topDonors.map((entry) => (
                    <li key={`${entry.label}-donations`} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none">
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
                    <li key={`${entry.label}-rush`} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none">
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
                    <li key={`${entry.label}-capital`} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none">
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
                    <li key={`${entry.label}-hero`} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-none">
                      <span className="font-medium text-slate-100">{entry.label}</span>
                      <span className="text-right font-semibold tabular-nums text-slate-100">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!topDonors.length && !leastRushed.length && !heroLeaders.length && (
            <p className="text-sm text-slate-300">No roster highlights available yet.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default RosterSummary;
