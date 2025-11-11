"use client";

import { useEffect, useState } from "react";
import useSWR from 'swr';
import { normalizeTag } from "@/lib/tags";
import { BarChart3, TrendingUp, TrendingDown, Users, Award, Trophy, Coins, Target } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { LeagueBadge } from "@/components/ui";
// Format number with commas
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString('en-US');
};

interface ComparisonMetrics {
  playerValue: number;
  clanAverage: number;
  clanMedian: number;
  percentile: number;
  rank: number;
  totalPlayers: number;
}

interface ComparisonData {
  trophies: ComparisonMetrics;
  donations: ComparisonMetrics;
  donationsReceived: ComparisonMetrics;
  warStars: ComparisonMetrics;
  clanCapitalContributions: ComparisonMetrics;
  donationRatio: ComparisonMetrics;
  townHallComparison?: {
    level: number;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersAtLevel: number;
  };
  leagueTierComparison?: {
    leagueName: string;
    leagueBaseName: string;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersInLeague: number;
  };
  roleComparison?: {
    role: string;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersWithRole: number;
  };
}

interface PlayerComparisonViewProps {
  playerTag: string;
  playerName?: string;
  playerTrophies?: number;
  playerTownHall?: number;
  playerLeagueName?: string;
  clanTag?: string | null;
}

function ComparisonCard({ 
  title, 
  icon: Icon, 
  playerValue, 
  averageValue, 
  percentile, 
  rank, 
  totalPlayers,
  formatValue = (v) => formatNumber(v),
  tooltip
}: {
  title: string;
  icon: React.ElementType;
  playerValue: number;
  averageValue: number;
  percentile: number;
  rank: number;
  totalPlayers: number;
  formatValue?: (v: number) => string;
  tooltip?: string;
}) {
  const diff = averageValue > 0 ? ((playerValue - averageValue) / averageValue) * 100 : 0;
  const isAboveAverage = diff >= 0;
  const percentileColor = percentile >= 75 ? 'text-emerald-400' : percentile >= 50 ? 'text-blue-400' : percentile >= 25 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <div 
      className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm hover:bg-slate-800/60 transition-colors"
      title={tooltip}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        </div>
        <div className={`text-xs font-semibold ${percentileColor}`}>
          {percentile.toFixed(0)}th percentile
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Your Value</span>
          <span className="text-lg font-bold text-blue-300">{formatValue(playerValue)}</span>
        </div>
        
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Average</span>
          <span className="text-sm text-slate-300">{formatValue(averageValue)}</span>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div className="flex items-center gap-1">
            {isAboveAverage ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-orange-400" />
            )}
            <span className={`text-xs font-semibold ${isAboveAverage ? 'text-emerald-400' : 'text-orange-400'}`}>
              {isAboveAverage ? '+' : ''}{diff.toFixed(1)}%
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Rank #{rank} of {totalPlayers}
          </span>
        </div>
      </div>
    </div>
  );
}

function ComparisonGroup({
  title,
  subtitle,
  icon: Icon,
  children
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <GlassCard
      icon={<Icon className="h-5 w-5" aria-hidden />}
      title={title}
      subtitle={subtitle}
      className="space-y-4"
    >
      {children}
    </GlassCard>
  );
}

export default function PlayerComparisonView({
  playerTag,
  playerName,
  playerTrophies,
  playerTownHall,
  playerLeagueName,
  clanTag
}: PlayerComparisonViewProps) {
  const normalizedTag = normalizeTag(playerTag);
  const normalizedClanTag = clanTag ? normalizeTag(clanTag) : null;
  const comparisonKey = normalizedTag 
    ? `/api/player/${encodeURIComponent(normalizedTag)}/comparison${normalizedClanTag ? `?clanTag=${encodeURIComponent(normalizedClanTag)}` : ''}`
    : null;
  
  const { data: comparisonResponse, error, isLoading } = useSWR<{
    success: boolean;
    data?: ComparisonData;
    meta?: {
      playerTag: string;
      playerName: string;
      clanSize: number;
    };
  }>(comparisonKey, async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch comparison: ${response.statusText}`);
    return response.json();
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-slate-800/40 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !comparisonResponse?.success || !comparisonResponse.data) {
    return (
      <GlassCard
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        title="Comparison Data"
        subtitle="Unable to load comparison data"
      >
        <p className="text-sm text-slate-400">
          {error ? `Error: ${error.message}` : 'Comparison data not available'}
        </p>
      </GlassCard>
    );
  }

  const comparison = comparisonResponse.data;
  const meta = comparisonResponse.meta;

  return (
    <div className="space-y-6">
      {/* Clan Average Comparison */}
      <ComparisonGroup
        title="vs Clan Average"
        subtitle={`Compared to ${meta?.clanSize || 'all'} clan members`}
        icon={Users}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComparisonCard
            title="Season Total Trophies"
            icon={Trophy}
            playerValue={comparison.trophies.playerValue}
            averageValue={comparison.trophies.clanAverage}
            percentile={comparison.trophies.percentile}
            rank={comparison.trophies.rank}
            totalPlayers={comparison.trophies.totalPlayers}
            tooltip="Running total of ranked trophies earned across all weeks this season compared to clan average"
          />
          <ComparisonCard
            title="Donations"
            icon={Coins}
            playerValue={comparison.donations.playerValue}
            averageValue={comparison.donations.clanAverage}
            percentile={comparison.donations.percentile}
            rank={comparison.donations.rank}
            totalPlayers={comparison.donations.totalPlayers}
            tooltip="Total troops donated compared to clan average"
          />
          <ComparisonCard
            title="War Stars"
            icon={Target}
            playerValue={comparison.warStars.playerValue}
            averageValue={comparison.warStars.clanAverage}
            percentile={comparison.warStars.percentile}
            rank={comparison.warStars.rank}
            totalPlayers={comparison.warStars.totalPlayers}
            tooltip="Total war stars earned compared to clan average"
          />
          <ComparisonCard
            title="Capital Contributions"
            icon={Award}
            playerValue={comparison.clanCapitalContributions.playerValue}
            averageValue={comparison.clanCapitalContributions.clanAverage}
            percentile={comparison.clanCapitalContributions.percentile}
            rank={comparison.clanCapitalContributions.rank}
            totalPlayers={comparison.clanCapitalContributions.totalPlayers}
            tooltip="Clan Capital gold contributed compared to clan average"
          />
          <ComparisonCard
            title="Donation Ratio"
            icon={BarChart3}
            playerValue={comparison.donationRatio.playerValue}
            averageValue={comparison.donationRatio.clanAverage}
            percentile={comparison.donationRatio.percentile}
            rank={comparison.donationRatio.rank}
            totalPlayers={comparison.donationRatio.totalPlayers}
            formatValue={(v) => v.toFixed(2)}
            tooltip="Donations given vs received ratio compared to clan average"
          />
        </div>
      </ComparisonGroup>

      {/* Town Hall Level Comparison */}
      {comparison.townHallComparison && (
        <ComparisonGroup
          title={`vs Same Town Hall Level (TH${comparison.townHallComparison.level})`}
          subtitle={`Compared to ${comparison.townHallComparison.playersAtLevel} players at TH${comparison.townHallComparison.level}`}
          icon={Award}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">Season Total Trophies</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(playerTrophies || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">TH{comparison.townHallComparison.level} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.townHallComparison.averageTrophies)}</span>
                </div>
                {playerTrophies && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <span className={`text-xs font-semibold ${
                      (playerTrophies || 0) >= comparison.townHallComparison.averageTrophies ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {((playerTrophies || 0) >= comparison.townHallComparison.averageTrophies ? '+' : '')}
                      {(((playerTrophies || 0) - comparison.townHallComparison.averageTrophies) / comparison.townHallComparison.averageTrophies * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">Donations</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(comparison.donations.playerValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">TH{comparison.townHallComparison.level} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.townHallComparison.averageDonations)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <span className={`text-xs font-semibold ${
                    comparison.donations.playerValue >= comparison.townHallComparison.averageDonations ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    {comparison.donations.playerValue >= comparison.townHallComparison.averageDonations ? '+' : ''}
                    {((comparison.donations.playerValue - comparison.townHallComparison.averageDonations) / comparison.townHallComparison.averageDonations * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">War Stars</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(comparison.warStars.playerValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">TH{comparison.townHallComparison.level} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.townHallComparison.averageWarStars)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <span className={`text-xs font-semibold ${
                    comparison.warStars.playerValue >= comparison.townHallComparison.averageWarStars ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    {comparison.warStars.playerValue >= comparison.townHallComparison.averageWarStars ? '+' : ''}
                    {((comparison.warStars.playerValue - comparison.townHallComparison.averageWarStars) / comparison.townHallComparison.averageWarStars * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ComparisonGroup>
      )}

      {/* League Tier Comparison */}
      {comparison.leagueTierComparison && (
        <ComparisonGroup
          title={`vs Same League Tier (${comparison.leagueTierComparison.leagueBaseName})`}
          subtitle={`Compared to ${comparison.leagueTierComparison.playersInLeague} players in ${comparison.leagueTierComparison.leagueBaseName}`}
          icon={Award}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">Season Total Trophies</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(playerTrophies || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">{comparison.leagueTierComparison.leagueBaseName} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.leagueTierComparison.averageTrophies)}</span>
                </div>
                {playerTrophies && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <span className={`text-xs font-semibold ${
                      (playerTrophies || 0) >= comparison.leagueTierComparison.averageTrophies ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {((playerTrophies || 0) >= comparison.leagueTierComparison.averageTrophies ? '+' : '')}
                      {(((playerTrophies || 0) - comparison.leagueTierComparison.averageTrophies) / comparison.leagueTierComparison.averageTrophies * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">Donations</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(comparison.donations.playerValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">{comparison.leagueTierComparison.leagueBaseName} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.leagueTierComparison.averageDonations)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <span className={`text-xs font-semibold ${
                    comparison.donations.playerValue >= comparison.leagueTierComparison.averageDonations ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    {comparison.donations.playerValue >= comparison.leagueTierComparison.averageDonations ? '+' : ''}
                    {((comparison.donations.playerValue - comparison.leagueTierComparison.averageDonations) / comparison.leagueTierComparison.averageDonations * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">War Stars</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">You</span>
                  <span className="text-base font-bold text-blue-300">{formatNumber(comparison.warStars.playerValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">{comparison.leagueTierComparison.leagueBaseName} Avg</span>
                  <span className="text-sm text-slate-300">{formatNumber(comparison.leagueTierComparison.averageWarStars)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <span className={`text-xs font-semibold ${
                    comparison.warStars.playerValue >= comparison.leagueTierComparison.averageWarStars ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    {comparison.warStars.playerValue >= comparison.leagueTierComparison.averageWarStars ? '+' : ''}
                    {((comparison.warStars.playerValue - comparison.leagueTierComparison.averageWarStars) / comparison.leagueTierComparison.averageWarStars * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ComparisonGroup>
      )}
    </div>
  );
}

