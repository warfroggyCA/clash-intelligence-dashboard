"use client";

// Capital Analytics Dashboard Component
// Displays comprehensive capital raid performance analytics

import React, { useState } from 'react';
import useSWR from 'swr';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import type { CapitalAnalyticsResult, CapitalWeekendSummary } from '@/lib/capital-analytics/engine';
import { generateCapitalCoachingRecommendations, compareCapitalToClanAverage } from '@/lib/capital-analytics/metrics';
import { Loader2, TrendingUp, TrendingDown, Coins, Award, Target, Users, TrendingUp as TrendingUpIcon } from 'lucide-react';

interface CapitalAnalyticsDashboardProps {
  clanTag?: string;
  className?: string;
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
  className = '' 
}: CapitalAnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(12);
  const normalizedClanTag = normalizeTag(clanTag || cfg.homeClanTag || '');
  
  const swrKey = normalizedClanTag 
    ? `/api/capital-analytics?clanTag=${encodeURIComponent(normalizedClanTag)}&weeksBack=${selectedPeriod}`
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

  const { metrics, clanAverages, totalWeekends, periodStart, periodEnd, latestWeekendSummary } = data;
  const hasAnalytics = metrics.length > 0;
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
            Analysis of {totalWeekends} raid weekends from {new Date(periodStart).toLocaleDateString()} to {new Date(periodEnd).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {[4, 8, 12].map((weeks) => (
            <button
              key={weeks}
              onClick={() => setSelectedPeriod(weeks)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === weeks
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {weeks}w
            </button>
          ))}
        </div>
      </div>

      {/* Clan Averages Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          title="Avg Loot/Attack"
          value={clanAverages.averageLootPerAttack}
          max={10000}
          icon={<Coins className="h-5 w-5" />}
          color="amber"
          format="number"
        />
        <MetricCard
          title="Avg Carry Score"
          value={clanAverages.averageCarryScore}
          max={100}
          icon={<Target className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Avg Participation"
          value={Math.round(clanAverages.averageParticipation * 100)}
          max={100}
          icon={<Users className="h-5 w-5" />}
          color="green"
        />
        <MetricCard
          title="Avg ROI Score"
          value={clanAverages.averageROI}
          max={100}
          icon={<TrendingUpIcon className="h-5 w-5" />}
          color="purple"
        />
        <MetricCard
          title="Avg Overall"
          value={clanAverages.averageOverallScore}
          max={100}
          icon={<Award className="h-5 w-5" />}
          color="amber"
        />
      </div>

      {/* Member Performance Table */}
      <div className="rounded-xl border border-brand-border bg-brand-surface shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-surfaceRaised border-b border-brand-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Player
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Weekends
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Loot/Attack
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Carry Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Participation
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  ROI
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Overall
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Tier
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {metrics.map((metric, index) => {
                const comparison = compareCapitalToClanAverage(metric, clanAverages);
                
                return (
                  <tr 
                    key={metric.playerTag} 
                    className={`hover:bg-brand-surfaceRaised transition-colors ${
                      index % 2 === 0 ? 'bg-brand-surface' : 'bg-brand-surfaceSubtle'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{metric.playerName}</span>
                        <span className="text-xs text-slate-400">{metric.playerTag}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-200">
                      {metric.weekendsParticipated}/{metric.totalWeekends}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-semibold ${
                          comparison.lootDelta > 0 ? 'text-green-400' : 
                          comparison.lootDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.averageLootPerAttack.toLocaleString()}
                        </span>
                        {comparison.lootDelta !== 0 && (
                          comparison.lootDelta > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-semibold ${
                          comparison.carryDelta > 0 ? 'text-green-400' : 
                          comparison.carryDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.carryScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-200">
                        {Math.round(metric.participationRate * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${
                        comparison.roiDelta > 0 ? 'text-green-400' : 
                        comparison.roiDelta < 0 ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {metric.roiScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-bold text-lg ${
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
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
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

      {/* Top Performers Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            Top Performers
          </h3>
          <div className="space-y-2">
            {metrics.slice(0, 5).map((metric, index) => (
              <div key={metric.playerTag} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">#{index + 1}</span>
                  <span className="font-medium text-white">{metric.playerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{metric.averageLootPerAttack.toLocaleString()}/attack</span>
                  <span className="font-bold text-amber-400">{metric.overallScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            Needs Improvement
          </h3>
          <div className="space-y-2">
            {metrics
              .filter(m => m.performanceTier === 'needs_improvement' || m.performanceTier === 'poor')
              .slice(0, 5)
              .map((metric) => {
                const recommendations = generateCapitalCoachingRecommendations(metric);
                return (
                  <div key={metric.playerTag} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{metric.playerName}</span>
                      <span className="text-xs text-red-400">Score: {metric.overallScore}</span>
                    </div>
                    {recommendations.length > 0 && (
                      <p className="text-xs text-slate-400">{recommendations[0]}</p>
                    )}
                  </div>
                );
              })}
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
          <span className="rounded-full bg-slate-800/70 px-3 py-1">
            Total Loot <span className="font-semibold">{summary.totalLoot.toLocaleString()}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1">
            Attacks <span className="font-semibold">{summary.totalAttacks}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1">
            Avg Loot/Atk <span className="font-semibold">{summary.averageLootPerAttack.toLocaleString()}</span>
          </span>
          <span className="rounded-full bg-slate-800/70 px-3 py-1">
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
                className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">{contributor.playerName}</div>
                  <div className="text-xs text-slate-400">
                    {contributor.attacks} attacks • {contributor.bonusLoot > 0 ? 'Bonus earned' : 'No bonus'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-amber-300">
                    {contributor.loot.toLocaleString()}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">Loot</div>
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
}

function MetricCard({ title, value, max, icon, color, format = 'percentage' }: MetricCardProps) {
  const percentage = (value / max) * 100;
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    green: 'text-green-400 bg-green-500/20 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    amber: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  };

  const displayValue = format === 'number' 
    ? value.toLocaleString() 
    : value;

  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {title}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{displayValue}</span>
        {format === 'number' && <span className="text-xs text-slate-400">gold</span>}
        {format === 'percentage' && <span className="text-xs text-slate-400">/ {max}</span>}
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
