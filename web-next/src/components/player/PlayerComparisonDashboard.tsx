'use client';

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
  townHallComparison?: {
    level: number;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersAtLevel: number;
  };
  roleComparison?: {
    role: string;
    averageTrophies: number;
    averageDonations: number;
    averageWarStars: number;
    playersWithRole: number;
  };
}

interface PlayerComparisonDashboardProps {
  data: PlayerComparisonData;
  playerName: string;
}

const ComparisonCard = ({ 
  title, 
  icon: Icon, 
  metrics, 
  unit = '',
  color = 'blue' 
}: {
  title: string;
  icon: any;
  metrics: ComparisonMetrics;
  unit?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) => {
  const percentageVsAverage = metrics.clanAverage > 0 
    ? ((metrics.playerValue - metrics.clanAverage) / metrics.clanAverage) * 100 
    : 0;

  const isAboveAverage = percentageVsAverage > 0;

  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100',
    red: 'text-red-600 bg-red-100'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {metrics.playerValue.toLocaleString()}{unit}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isAboveAverage 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {isAboveAverage ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {Math.abs(percentageVsAverage).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Your value
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Clan Average</p>
            <p className="text-lg font-semibold text-gray-900">
              {metrics.clanAverage.toLocaleString()}{unit}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Your Rank</p>
            <p className="text-lg font-semibold text-gray-900">
              #{metrics.rank} of {metrics.totalPlayers}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Percentile</p>
            <p className="text-lg font-semibold text-gray-900">
              {metrics.percentile.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Clan Median</p>
            <p className="text-lg font-semibold text-gray-900">
              {metrics.clanMedian.toLocaleString()}{unit}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PlayerComparisonDashboard({ 
  data, 
  playerName 
}: PlayerComparisonDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Player vs Clan Comparison
        </h2>
        <p className="text-gray-600">
          See how {playerName} stacks up against clan averages and rankings
        </p>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ComparisonCard
          title="Trophies"
          icon={Award}
          metrics={data.trophies}
          color="orange"
        />
        <ComparisonCard
          title="Donations Given"
          icon={Gift}
          metrics={data.donations}
          color="green"
        />
        <ComparisonCard
          title="War Stars"
          icon={Target}
          metrics={data.warStars}
          color="red"
        />
        <ComparisonCard
          title="Capital Contributions"
          icon={Users}
          metrics={data.clanCapitalContributions}
          color="purple"
        />
        <ComparisonCard
          title="Donations Received"
          icon={TrendingDown}
          metrics={data.donationsReceived}
          color="blue"
        />
        <ComparisonCard
          title="Donation Ratio"
          icon={TrendingUp}
          metrics={data.donationRatio}
          unit="x"
          color="green"
        />
      </div>

      {/* Town Hall Comparison */}
      {data.townHallComparison && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Town Hall {data.townHallComparison.level} Comparison
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700">Players at TH{data.townHallComparison.level}</p>
              <p className="text-xl font-bold text-blue-900">{data.townHallComparison.playersAtLevel}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Avg Trophies</p>
              <p className="text-xl font-bold text-blue-900">{data.townHallComparison.averageTrophies.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Avg Donations</p>
              <p className="text-xl font-bold text-blue-900">{data.townHallComparison.averageDonations.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Avg War Stars</p>
              <p className="text-xl font-bold text-blue-900">{data.townHallComparison.averageWarStars.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Role Comparison */}
      {data.roleComparison && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            {data.roleComparison.role.charAt(0).toUpperCase() + data.roleComparison.role.slice(1)} Role Comparison
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-green-700">Players with Role</p>
              <p className="text-xl font-bold text-green-900">{data.roleComparison.playersWithRole}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Avg Trophies</p>
              <p className="text-xl font-bold text-green-900">{data.roleComparison.averageTrophies.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Avg Donations</p>
              <p className="text-xl font-bold text-green-900">{data.roleComparison.averageDonations.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Avg War Stars</p>
              <p className="text-xl font-bold text-green-900">{data.roleComparison.averageWarStars.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}