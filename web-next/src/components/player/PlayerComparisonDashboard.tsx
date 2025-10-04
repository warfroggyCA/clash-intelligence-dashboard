'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Award, Users, Target, Gift } from 'lucide-react';

interface ComparisonMetrics {
  playerValue: number;
  clanAverage: number;
  clanMedian: number;
  percentile: number;
  rank: number;
  totalPlayers: number;
}

interface PlayerComparisonData {
  trophies: ComparisonMetrics;
  donations: ComparisonMetrics;
  donationsReceived: ComparisonMetrics;
  warStars: ComparisonMetrics;
  clanCapitalContributions: ComparisonMetrics;
  donationRatio: ComparisonMetrics;
  thLevelComparison: {
    playerTH: number;
    sameTHCount: number;
    avgTrophiesForTH: number;
    avgDonationsForTH: number;
    avgWarStarsForTH: number;
  };
  roleComparison: {
    playerRole: string;
    sameRoleCount: number;
    avgMetricsForRole: {
      trophies: number;
      donations: number;
      warStars: number;
    };
  };
}

interface PlayerComparisonDashboardProps {
  comparison: PlayerComparisonData;
}

const ComparisonCard = ({ 
  icon: Icon, 
  title, 
  metrics, 
  format = (v: number) => v.toLocaleString(),
  suffix = ''
}: { 
  icon: any; 
  title: string; 
  metrics: ComparisonMetrics;
  format?: (v: number) => string;
  suffix?: string;
}) => {
  const isAboveAverage = metrics.playerValue >= metrics.clanAverage;
  const percentageVsAvg = metrics.clanAverage > 0
    ? (((metrics.playerValue - metrics.clanAverage) / metrics.clanAverage) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-brand-surface border border-brand-border rounded-lg p-4 hover:border-brand-border/80 transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        </div>
        <div className={`text-xs font-semibold px-2 py-1 rounded ${
          isAboveAverage 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-orange-500/20 text-orange-400'
        }`}>
          {isAboveAverage ? '↑ Above Avg' : '↓ Below Avg'}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-2xl font-bold text-gray-100">
            {format(metrics.playerValue)}{suffix}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">Rank #{metrics.rank} of {metrics.totalPlayers}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">Top {100 - metrics.percentile}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-500 mb-1">Clan Average</p>
            <p className="text-sm font-medium text-gray-300">
              {format(metrics.clanAverage)}{suffix}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">vs Average</p>
            <p className={`text-sm font-bold flex items-center gap-1 ${
              isAboveAverage ? 'text-green-400' : 'text-orange-400'
            }`}>
              {isAboveAverage ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isAboveAverage ? '+' : ''}{percentageVsAvg}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PlayerComparisonDashboard: React.FC<PlayerComparisonDashboardProps> = ({ 
  comparison 
}) => {
  return (
    <div className="space-y-6">
      {/* Main Metrics Comparison */}
      <div>
        <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          Performance vs Clan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComparisonCard
            icon={Award}
            title="Trophies"
            metrics={comparison.trophies}
          />
          <ComparisonCard
            icon={Gift}
            title="Donations Given"
            metrics={comparison.donations}
          />
          <ComparisonCard
            icon={Users}
            title="War Stars"
            metrics={comparison.warStars}
          />
          <ComparisonCard
            icon={TrendingUp}
            title="Capital Gold"
            metrics={comparison.clanCapitalContributions}
          />
          <ComparisonCard
            icon={Gift}
            title="Donation Ratio"
            metrics={comparison.donationRatio}
            format={(v) => v.toFixed(2)}
            suffix="x"
          />
          <ComparisonCard
            icon={Users}
            title="Donations Received"
            metrics={comparison.donationsReceived}
          />
        </div>
      </div>

      {/* Town Hall Level Comparison */}
      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
        <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          🏛️ Town Hall {comparison.thLevelComparison.playerTH} Comparison
        </h4>
        <p className="text-sm text-gray-400 mb-4">
          Comparing with {comparison.thLevelComparison.sameTHCount} other TH{comparison.thLevelComparison.playerTH} players in clan
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg Trophies (TH{comparison.thLevelComparison.playerTH})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.thLevelComparison.avgTrophiesForTH.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.trophies.playerValue >= comparison.thLevelComparison.avgTrophiesForTH
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.trophies.playerValue.toLocaleString()} 
              {comparison.trophies.playerValue >= comparison.thLevelComparison.avgTrophiesForTH ? ' ↑' : ' ↓'}
            </p>
          </div>
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg Donations (TH{comparison.thLevelComparison.playerTH})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.thLevelComparison.avgDonationsForTH.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.donations.playerValue >= comparison.thLevelComparison.avgDonationsForTH
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.donations.playerValue.toLocaleString()}
              {comparison.donations.playerValue >= comparison.thLevelComparison.avgDonationsForTH ? ' ↑' : ' ↓'}
            </p>
          </div>
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg War Stars (TH{comparison.thLevelComparison.playerTH})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.thLevelComparison.avgWarStarsForTH.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.warStars.playerValue >= comparison.thLevelComparison.avgWarStarsForTH
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.warStars.playerValue.toLocaleString()}
              {comparison.warStars.playerValue >= comparison.thLevelComparison.avgWarStarsForTH ? ' ↑' : ' ↓'}
            </p>
          </div>
        </div>
      </div>

      {/* Role Comparison */}
      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
        <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          👥 Role Comparison ({comparison.roleComparison.playerRole})
        </h4>
        <p className="text-sm text-gray-400 mb-4">
          Comparing with {comparison.roleComparison.sameRoleCount} other {comparison.roleComparison.playerRole}s in clan
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg Trophies ({comparison.roleComparison.playerRole})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.roleComparison.avgMetricsForRole.trophies.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.trophies.playerValue >= comparison.roleComparison.avgMetricsForRole.trophies
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.trophies.playerValue.toLocaleString()}
              {comparison.trophies.playerValue >= comparison.roleComparison.avgMetricsForRole.trophies ? ' ↑' : ' ↓'}
            </p>
          </div>
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg Donations ({comparison.roleComparison.playerRole})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.roleComparison.avgMetricsForRole.donations.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.donations.playerValue >= comparison.roleComparison.avgMetricsForRole.donations
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.donations.playerValue.toLocaleString()}
              {comparison.donations.playerValue >= comparison.roleComparison.avgMetricsForRole.donations ? ' ↑' : ' ↓'}
            </p>
          </div>
          <div className="bg-brand-surfaceRaised rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Avg War Stars ({comparison.roleComparison.playerRole})</p>
            <p className="text-xl font-bold text-gray-100">
              {comparison.roleComparison.avgMetricsForRole.warStars.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${
              comparison.warStars.playerValue >= comparison.roleComparison.avgMetricsForRole.warStars
                ? 'text-green-400'
                : 'text-orange-400'
            }`}>
              You: {comparison.warStars.playerValue.toLocaleString()}
              {comparison.warStars.playerValue >= comparison.roleComparison.avgMetricsForRole.warStars ? ' ↑' : ' ↓'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerComparisonDashboard;
