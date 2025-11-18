"use client";

// War Intelligence Dashboard Component
// Displays comprehensive war performance analytics

import React, { useState } from 'react';
import useSWR from 'swr';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import type { WarIntelligenceResult, WarSummary } from '@/lib/war-intelligence/engine';
import { generateCoachingRecommendations, compareToClanAverage } from '@/lib/war-intelligence/metrics';
import { Loader2, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, Award } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { TOOLTIP_CONTENT } from '@/lib/tooltips/tooltip-content';

interface WarIntelligenceDashboardProps {
  clanTag?: string;
  className?: string;
}

const fetcher = async (url: string): Promise<WarIntelligenceResult> => {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch war intelligence: ${errorText}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch war intelligence');
  }
  return data.data;
};

export default function WarIntelligenceDashboard({ 
  clanTag, 
  className = '' 
}: WarIntelligenceDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(90);
  const normalizedClanTag = normalizeTag(clanTag || cfg.homeClanTag || '');
  
  const swrKey = normalizedClanTag 
    ? `/api/war-intelligence?clanTag=${encodeURIComponent(normalizedClanTag)}&daysBack=${selectedPeriod}`
    : null;

  const { data, error, isLoading } = useSWR<WarIntelligenceResult>(
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
        <span className="ml-3 text-slate-400">Loading war intelligence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-500/50 bg-red-900/20 p-6 ${className}`}>
        <p className="text-red-400">Failed to load war intelligence: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 text-center ${className}`}>
        <p className="text-slate-400">No war history captured yet.</p>
      </div>
    );
  }

  const { metrics, clanAverages, totalWars, periodStart, periodEnd, latestWarSummary } = data;
  const hasAnalytics = metrics.length > 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Latest War Overview */}
      <LatestWarOverview summary={latestWarSummary} />

      {!hasAnalytics && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-300">
          {data.totalWars === 0
            ? 'No wars recorded in this period yet. Once a war completes, the overview above will populate automatically.'
            : 'Need at least three wars with participation to unlock the trend analytics below. Latest war details remain available above.'}
        </div>
      )}

      {hasAnalytics && (
        <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">War Performance Intelligence</h2>
          <p className="text-sm text-slate-400 mt-1">
            Analysis of {totalWars} wars from {new Date(periodStart).toLocaleDateString()} to {new Date(periodEnd).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => setSelectedPeriod(days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === days
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Clan Averages Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Attack Efficiency"
          value={clanAverages.averageAEI}
          max={100}
          icon={<Target className="h-5 w-5" />}
          color="blue"
          tooltipKey="War Efficiency"
        />
        <MetricCard
          title="Avg Consistency"
          value={clanAverages.averageConsistency}
          max={100}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
          tooltipKey="War Consistency"
        />
        <MetricCard
          title="Avg Defensive Hold"
          value={Math.round(clanAverages.averageHoldRate * 100)}
          max={100}
          icon={<Shield className="h-5 w-5" />}
          color="purple"
          tooltipKey="Defensive Hold Rate"
        />
        <MetricCard
          title="Avg Overall Score"
          value={clanAverages.averageOverallScore}
          max={100}
          icon={<Award className="h-5 w-5" />}
          color="amber"
          tooltipKey="Overall War Score"
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
                  Wars
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <TooltipLabel text="AEI" tooltipKey="War Efficiency" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <TooltipLabel text="Consistency" tooltipKey="War Consistency" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <TooltipLabel text="Hold Rate" tooltipKey="Defensive Hold Rate" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <TooltipLabel text="Overall" tooltipKey="Overall War Score" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <TooltipLabel text="Tier" tooltipKey="Performance Tier" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {metrics.map((metric, index) => {
                const comparison = compareToClanAverage(metric, clanAverages);
                const recommendations = generateCoachingRecommendations(metric);
                
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
                      {metric.totalWars}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-semibold ${
                          comparison.aeiDelta > 0 ? 'text-green-400' : 
                          comparison.aeiDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.attackEfficiencyIndex}
                        </span>
                        {comparison.aeiDelta !== 0 && (
                          comparison.aeiDelta > 0 ? (
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
                          comparison.consistencyDelta > 0 ? 'text-green-400' : 
                          comparison.consistencyDelta < 0 ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {metric.consistencyScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-200">
                        {Math.round(metric.defensiveHoldRate * 100)}%
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
                <span className="font-bold text-amber-400">{metric.overallScore}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            Needs Coaching
          </h3>
          <div className="space-y-2">
            {metrics
              .filter(m => m.performanceTier === 'needs_coaching' || m.performanceTier === 'poor')
              .slice(0, 5)
              .map((metric) => {
                const recommendations = generateCoachingRecommendations(metric);
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

function LatestWarOverview({ summary }: { summary?: WarSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 text-slate-300">
        <h3 className="text-lg font-semibold text-white mb-1">Latest War Overview</h3>
        <p className="text-sm text-slate-400">No recent war data available.</p>
      </div>
    );
  }

  const warDate = summary.startTime ? new Date(summary.startTime).toLocaleDateString() : 'Unknown date';
  const resultBadge =
    summary.clanStars > summary.opponentStars
      ? 'bg-emerald-500/20 text-emerald-200'
      : summary.clanStars < summary.opponentStars
        ? 'bg-rose-500/20 text-rose-200'
        : 'bg-slate-600/30 text-slate-200';

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface shadow-lg p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Latest War</h3>
          <p className="text-sm text-slate-400">Started {warDate}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${resultBadge}`}>
          {summary.result || 'Result pending'}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4 text-white">
        <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            <TooltipLabel text="Stars" tooltipKey="War Stars" />
          </div>
          <div className="text-2xl font-semibold">{summary.clanStars} - {summary.opponentStars}</div>
        </div>
        <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            <TooltipLabel text="Attacks Used" tooltipKey="Attacks Used" />
          </div>
          <div className="text-2xl font-semibold">{summary.attacksUsed}/{summary.attacksAvailable}</div>
        </div>
        <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            <TooltipLabel text="Average Stars" tooltipKey="Average Stars" />
          </div>
          <div className="text-2xl font-semibold">{summary.averageStars.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            <TooltipLabel text="Missed Attacks" tooltipKey="Missed Attacks" />
          </div>
          <div className="text-2xl font-semibold">{summary.missedAttacks}</div>
        </div>
      </div>
      {summary.topAttackers.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Top performers</p>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.topAttackers.slice(0, 4).map((attacker) => (
              <div
                key={attacker.playerTag}
                className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">{attacker.playerName}</div>
                  <div className="text-xs text-slate-400">{attacker.attacks} attacks • Avg {attacker.averageDestruction}%</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-amber-300">{attacker.totalStars}⭐</div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">Stars</div>
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
  tooltipKey?: string;
}

function MetricCard({ title, value, max, icon, color, tooltipKey }: MetricCardProps) {
  const percentage = (value / max) * 100;
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    green: 'text-green-400 bg-green-500/20 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    amber: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {tooltipKey && TOOLTIP_CONTENT[tooltipKey] ? (
            <Tooltip content={TOOLTIP_CONTENT[tooltipKey]!.content}>
              <span className="inline-flex items-center gap-1">
                {title}
                <span className="text-[10px]">ⓘ</span>
              </span>
            </Tooltip>
          ) : (
            title
          )}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-slate-400">/ {max}</span>
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

const TooltipLabel: React.FC<{ text: string; tooltipKey?: string }> = ({ text, tooltipKey }) => {
  if (!tooltipKey || !TOOLTIP_CONTENT[tooltipKey]) {
    return <span>{text}</span>;
  }
  return (
    <Tooltip content={TOOLTIP_CONTENT[tooltipKey]!.content}>
      <span className="inline-flex items-center gap-1">
        {text}
        <span className="text-[10px]">ⓘ</span>
      </span>
    </Tooltip>
  );
};
