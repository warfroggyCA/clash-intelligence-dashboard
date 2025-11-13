"use client";

// War Intelligence Dashboard Component
// Displays comprehensive war performance analytics

import React, { useState } from 'react';
import useSWR from 'swr';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import type { WarIntelligenceResult } from '@/lib/war-intelligence/engine';
import { generateCoachingRecommendations, compareToClanAverage } from '@/lib/war-intelligence/metrics';
import { getRoleHeaders } from '@/lib/api/role-header';
import { Loader2, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, Award } from 'lucide-react';

interface WarIntelligenceDashboardProps {
  clanTag?: string;
  className?: string;
}

const fetcher = async (url: string): Promise<WarIntelligenceResult> => {
  const roleHeaders = getRoleHeaders();
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
    ...(roleHeaders instanceof Headers
      ? Object.fromEntries(Array.from(roleHeaders.entries()))
      : (roleHeaders as Record<string, string>)),
  };

  const response = await fetch(url, { headers });
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

  if (!data || data.metrics.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 text-center ${className}`}>
        <p className="text-slate-400">
          {data?.totalWars === 0 
            ? 'No war data available for the selected period. War ingestion may need to run first.'
            : 'Insufficient war data to calculate metrics. Need at least 3 wars with participation.'}
        </p>
      </div>
    );
  }

  const { metrics, clanAverages, totalWars, periodStart, periodEnd } = data;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
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
        />
        <MetricCard
          title="Avg Consistency"
          value={clanAverages.averageConsistency}
          max={100}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <MetricCard
          title="Avg Defensive Hold"
          value={Math.round(clanAverages.averageHoldRate * 100)}
          max={100}
          icon={<Shield className="h-5 w-5" />}
          color="purple"
        />
        <MetricCard
          title="Avg Overall Score"
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
                  Wars
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  AEI
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Consistency
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Hold Rate
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
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  max: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

function MetricCard({ title, value, max, icon, color }: MetricCardProps) {
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
          {title}
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

