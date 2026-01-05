"use client";

// Capital Analytics Dashboard Component
// Displays comprehensive capital raid performance analytics

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { useRosterData } from '@/app/new/roster/useRosterData';
import type { CapitalAnalyticsResult, CapitalWeekendSummary } from '@/lib/capital-analytics/engine';
import { compareCapitalToClanAverage } from '@/lib/capital-analytics/metrics';
import { Loader2, TrendingUp, TrendingDown, Coins, Award, Target, Users, TrendingUp as TrendingUpIcon, Info } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

interface CapitalAnalyticsDashboardProps {
  clanTag?: string;
  className?: string;
  publicAccess?: boolean;
  showRosterToggle?: boolean;
  rosterOnlyDefault?: boolean;
}

const fetcher = async (url: string): Promise<CapitalAnalyticsResult> => {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch capital analytics: ${errorText}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch capital analytics');
  }
  return data.data;
};

export default function CapitalAnalyticsDashboard({ 
  clanTag, 
  className = '',
  publicAccess = false,
  showRosterToggle = false,
  rosterOnlyDefault = false,
}: CapitalAnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(12);
  const [rosterOnly, setRosterOnly] = useState<boolean>(rosterOnlyDefault);
  const normalizedClanTag = normalizeTag(clanTag || cfg.homeClanTag || '');
  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  const minWeekends = selectedPeriod === 1 ? 1 : 3;
  const weeksBackParam = selectedPeriod === 0 ? '' : `&weeksBack=${selectedPeriod}`;
  
  const swrKey = normalizedClanTag 
    ? `/api/capital-analytics?clanTag=${encodeURIComponent(normalizedClanTag)}${weeksBackParam}&minWeekends=${minWeekends}${publicAccess ? '&public=true' : ''}`
    : null;

  const { data, error, isLoading } = useSWR<CapitalAnalyticsResult>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    }
  );

  // All hooks must be called before any conditional returns
  const rosterTagSet = useMemo(
    () => new Set(rosterMembers.map((member) => normalizeTag(member.tag || '')).filter(Boolean)),
    [rosterMembers],
  );

  const { metrics = [], clanAverages, totalWeekends = 0, periodStart, periodEnd, latestWeekendSummary } = data || {};
  const shouldFilterRoster = rosterOnly && rosterTagSet.size > 0 && data;
  const displayMetrics = useMemo(() => {
    if (!data) return [];
    return shouldFilterRoster
      ? metrics.filter((metric) => rosterTagSet.has(normalizeTag(metric.playerTag)))
      : metrics;
  }, [data, shouldFilterRoster, metrics, rosterTagSet]);

  const participantTagSet = useMemo(() => {
    return new Set(metrics.map((metric) => normalizeTag(metric.playerTag)).filter(Boolean));
  }, [metrics]);

  const missingRosterMembers = useMemo(() => {
    if (!data || rosterMembers.length === 0) return [];
    return rosterMembers
      .filter((member) => {
        const tag = normalizeTag(member.tag || '');
        return tag && !participantTagSet.has(tag);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [data, rosterMembers, participantTagSet]);
  
  const displayAverages = useMemo(() => {
    if (!data || !clanAverages) return clanAverages || {};
    if (!shouldFilterRoster || displayMetrics.length === 0) return clanAverages;
    const avg = (value: (m: typeof displayMetrics[number]) => number) =>
      displayMetrics.reduce((sum, metric) => sum + value(metric), 0) / displayMetrics.length;
    return {
      averageLootPerAttack: avg((m) => m.averageLootPerAttack),
      averageCarryScore: avg((m) => m.carryScore),
      averageParticipation: avg((m) => m.participationRate),
      averageROI: avg((m) => m.roiScore),
      averageOverallScore: avg((m) => m.overallScore),
    };
  }, [data, clanAverages, displayMetrics, shouldFilterRoster]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <span className="ml-3 text-slate-400">Loading capital analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-500/50 bg-red-900/20 p-6 ${className}`}>
        <p className="text-red-400">Failed to load capital analytics: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 text-center ${className}`}>
        <p className="text-slate-400">No capital raid data available yet.</p>
      </div>
    );
  }
  const hasAnalytics = displayMetrics.length > 0;
  const totalWeekendsCount = data.totalWeekends ?? 0;
  const weekendsWithParticipantsCount = data.weekendsWithParticipants ?? 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Latest Event Overview */}
      <LatestRaidOverview summary={latestWeekendSummary} />

      {!hasAnalytics && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-300">
          {totalWeekendsCount === 0
            ? 'No raid weekends recorded yet. Once a raid completes, the overview above will populate automatically.'
            : weekendsWithParticipantsCount < 3
              ? `Only ${weekendsWithParticipantsCount || 0} weekend(s) include participant data. Trending analytics unlock after three weekends, but the latest raid summary remains available above.`
              : 'Collecting more raid weekends to unlock the full analytics suite…'}
        </div>
      )}

      {hasAnalytics && (
        <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Capital Raid Analytics</h2>
          <p className="text-sm text-slate-400 mt-1">
            Analysis of {totalWeekends} raid weekends from {periodStart ? new Date(periodStart).toLocaleDateString() : '—'} to {periodEnd ? new Date(periodEnd).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 4, 8, 12, 0].map((weeks) => (
            <button
              key={weeks}
              onClick={() => setSelectedPeriod(weeks)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === weeks
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={weeks === 1 ? 'Last weekend only' : weeks === 0 ? 'All recorded weekends' : undefined}
            >
              {weeks === 0 ? 'All time' : `${weeks}w`}
            </button>
          ))}
          {showRosterToggle ? (
            <button
              onClick={() => setRosterOnly((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                rosterOnly
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {rosterOnly ? 'Current roster' : 'All players'}
            </button>
          ) : null}
        </div>
      </div>
      {showRosterToggle && rosterOnly && rosterLoading ? (
        <div className="text-xs text-slate-400">Loading current roster…</div>
      ) : null}

      {missingRosterMembers.length > 0 ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-rose-100">
              No raid participation in {selectedPeriod === 0 ? 'all time' : `the last ${selectedPeriod}w`}
            </div>
            <div className="text-xs text-rose-200/80">
              {missingRosterMembers.length} player{missingRosterMembers.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-rose-100">
            {missingRosterMembers.slice(0, 12).map((member) => (
              <span key={member.tag} className="rounded-full border border-rose-200/20 bg-rose-500/10 px-2 py-1">
                {member.name || member.tag}
              </span>
            ))}
            {missingRosterMembers.length > 12 ? (
              <span className="text-rose-200/80">
                +{missingRosterMembers.length - 12} more
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Clan Averages Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          title="Avg Loot/Attack"
          value={displayAverages.averageLootPerAttack}
          max={10000}
          icon={<Coins className="h-5 w-5" />}
          color="amber"
          format="number"
          tooltip="Average capital loot earned per attack in the selected window."
        />
        <MetricCard
          title="Avg Carry Score"
          value={displayAverages.averageCarryScore}
          max={100}
          icon={<Target className="h-5 w-5" />}
          color="blue"
          tooltip="Score (0-100) based on bonus attacks earned and share of total loot."
        />
        <MetricCard
          title="Avg Participation"
          value={Math.round(displayAverages.averageParticipation * 100)}
          max={100}
          icon={<Users className="h-5 w-5" />}
          color="green"
          tooltip="Average weekend participation rate across the roster."
        />
        <MetricCard
          title="Avg ROI Score"
          value={displayAverages.averageROI}
          max={100}
          icon={<TrendingUpIcon className="h-5 w-5" />}
          color="purple"
          tooltip="Efficiency score (0-100) comparing loot gained to capital gold contributed."
        />
        <MetricCard
          title="Avg Overall"
          value={displayAverages.averageOverallScore}
          max={100}
          icon={<Award className="h-5 w-5" />}
          color="amber"
          tooltip="Composite performance score (0-100) across participation and loot metrics."
        />
      </div>

      {/* Member Performance Table */}
      <div className="rounded-xl border border-brand-border bg-brand-surface shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-brand-surfaceRaised border-b border-brand-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 w-[20%]">
                  Player
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[10%]">
                  Weekends
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[12%]">
                  Loot/Attack
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[10%]">
                  Carry Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[10%]">
                  Participation
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[10%]">
                  ROI
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[10%]">
                  Overall
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300 w-[18%]">
                  Tier
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {displayMetrics.map((metric, index) => {
                const comparison = compareCapitalToClanAverage(metric, displayAverages);
                
                return (
                  <tr 
                    key={metric.playerTag} 
                    className={`hover:bg-brand-surfaceRaised transition-colors ${
                      index % 2 === 0 ? 'bg-brand-surface' : 'bg-brand-surfaceSubtle'
                    }`}
                  >
                    <td className="px-4 py-3 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-white truncate">{metric.playerName}</span>
                        <span className="text-xs text-slate-400 truncate">{metric.playerTag}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-200 whitespace-nowrap">
                      <span className="inline-block min-w-0">{metric.weekendsParticipated}/{metric.totalWeekends}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 min-w-0">
                        <span className={`font-semibold truncate ${
                          comparison.lootDelta > 0 ? 'text-green-400' : 
                          comparison.lootDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.averageLootPerAttack.toLocaleString()}
                        </span>
                        {comparison.lootDelta !== 0 && (
                          <div className="flex-shrink-0">
                            {comparison.lootDelta > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-400" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 min-w-0">
                        <span className={`font-semibold truncate ${
                          comparison.carryDelta > 0 ? 'text-green-400' : 
                          comparison.carryDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.carryScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-semibold text-slate-200">
                        {Math.round(metric.participationRate * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`font-semibold truncate ${
                        comparison.roiDelta > 0 ? 'text-green-400' : 
                        comparison.roiDelta < 0 ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {metric.roiScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 min-w-0">
                        <span className={`font-bold text-lg truncate ${
                          metric.overallScore >= 80 ? 'text-green-400' :
                          metric.overallScore >= 65 ? 'text-blue-400' :
                          metric.overallScore >= 50 ? 'text-yellow-400' :
                          metric.overallScore >= 35 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {metric.overallScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center min-w-0">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold truncate max-w-full ${
                        metric.performanceTier === 'excellent' ? 'bg-green-500/20 text-green-400' :
                        metric.performanceTier === 'good' ? 'bg-blue-500/20 text-blue-400' :
                        metric.performanceTier === 'average' ? 'bg-yellow-500/20 text-yellow-400' :
                        metric.performanceTier === 'poor' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {metric.performanceTier.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers + Contributors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            Top Performers
          </h3>
          <div className="space-y-2">
            {displayMetrics.slice(0, 5).map((metric, index) => (
              <div key={metric.playerTag} className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-slate-400 flex-shrink-0">#{index + 1}</span>
                  <span className="font-medium text-white truncate min-w-0">{metric.playerName}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-400 whitespace-nowrap">{metric.averageLootPerAttack.toLocaleString()}/attack</span>
                  <span className="font-bold text-amber-400 whitespace-nowrap">{metric.overallScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-400" />
            Capital Contributors
          </h3>
          <div className="space-y-2">
            {displayMetrics
              .slice()
              .sort((a, b) => b.totalLoot - a.totalLoot)
              .slice(0, 5)
              .map((metric, index) => (
                <div key={metric.playerTag} className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-slate-400 flex-shrink-0">#{index + 1}</span>
                    <span className="font-medium text-white truncate min-w-0">{metric.playerName}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-amber-300 whitespace-nowrap">{metric.totalLoot.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 whitespace-nowrap">{metric.contributionToTotalLoot.toFixed(1)}% of loot</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function LatestRaidOverview({ summary }: { summary?: CapitalWeekendSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 text-slate-300">
        <h3 className="text-lg font-semibold text-white mb-1">Latest Raid Overview</h3>
        <p className="text-sm text-slate-400">No raid weekend data captured yet.</p>
      </div>
    );
  }

  const eventDate = summary.startTime ? new Date(summary.startTime).toLocaleDateString() : 'Unknown date';

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface shadow-lg p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Latest Raid Weekend</h3>
          <p className="text-sm text-slate-400">Started {eventDate}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-white">
          <span className="rounded-full bg-slate-800/70 px-3 py-1 min-w-0">
            Total Loot <span className="font-semibold whitespace-nowrap">{summary.totalLoot.toLocaleString()}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1 whitespace-nowrap">
            Attacks <span className="font-semibold">{summary.totalAttacks}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1 min-w-0">
            Avg Loot/Atk <span className="font-semibold whitespace-nowrap">{summary.averageLootPerAttack.toLocaleString()}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1 whitespace-nowrap">
            Participants <span className="font-semibold">{summary.participationCount}</span>
          </span>
        </div>
      </div>
      {summary.topContributors.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Top contributors</p>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.topContributors.slice(0, 4).map((contributor) => (
              <div
                key={contributor.playerTag}
                className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 flex items-center justify-between gap-2 min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white truncate">{contributor.playerName}</div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {contributor.attacks} attacks • {contributor.bonusLoot > 0 ? 'Bonus earned' : 'No bonus'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-semibold text-amber-300 whitespace-nowrap">
                    {contributor.loot.toLocaleString()}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 whitespace-nowrap">Loot</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  max: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber';
  format?: 'number' | 'percentage';
  tooltip?: string;
}

function MetricCard({ title, value, max, icon, color, format = 'percentage', tooltip }: MetricCardProps) {
  const percentage = (value / max) * 100;
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    green: 'text-green-400 bg-green-500/20 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    amber: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  };

  const displayValue = format === 'number' 
    ? value.toLocaleString() 
    : Math.round(value * 10) / 10; // Round to 1 decimal place for percentages

  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-4 min-w-0`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 truncate min-w-0">
            {title}
          </span>
          {tooltip ? (
            <Tooltip content={tooltip} position="top">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/10 text-[10px] text-slate-300">
                <Info className="h-3 w-3" />
              </span>
            </Tooltip>
          ) : null}
        </div>
        <div className="flex-shrink-0">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-2xl font-bold truncate min-w-0">{displayValue}</span>
        {format === 'number' && <span className="text-xs text-slate-400 flex-shrink-0">gold</span>}
        {format === 'percentage' && <span className="text-xs text-slate-400 flex-shrink-0">/ {max}</span>}
      </div>
      <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-current transition-all`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
