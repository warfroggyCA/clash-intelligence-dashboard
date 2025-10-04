'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

interface HistoricalDataPoint {
  date: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  warStars: number;
  clanCapitalContributions: number;
  deltas?: {
    trophies?: number;
    donations?: number;
    warStars?: number;
    clanCapitalContributions?: number;
  };
}

interface PlayerActivityAnalyticsProps {
  historicalData: HistoricalDataPoint[];
  playerName: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const activityScore = payload[0].value;
  const level = activityScore >= 80 ? 'Very Active' : activityScore >= 60 ? 'Active' : activityScore >= 40 ? 'Moderate' : activityScore >= 20 ? 'Low' : 'Inactive';
  const color = activityScore >= 80 ? 'text-green-400' : activityScore >= 60 ? 'text-blue-400' : activityScore >= 40 ? 'text-yellow-400' : activityScore >= 20 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-300 text-sm font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>
        {activityScore}/100
      </p>
      <p className="text-xs text-gray-400 mt-1">{level}</p>
    </div>
  );
};

export const PlayerActivityAnalytics = ({
  historicalData,
  playerName,
}: PlayerActivityAnalyticsProps) => {
  // Calculate activity scores based on daily changes
  const activityData = useMemo(() => {
    return historicalData.map((point, index) => {
      if (index === 0) {
        return {
          date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          activityScore: 50, // Default for first day
        };
      }

      const deltas = point.deltas || {};
      
      // Activity scoring algorithm
      let score = 0;
      
      // Donations activity (max 30 points)
      const donationActivity = Math.min((deltas.donations || 0) / 2, 30);
      score += donationActivity;
      
      // Trophy activity (max 20 points)
      const trophyChange = Math.abs(deltas.trophies || 0);
      const trophyActivity = Math.min(trophyChange / 5, 20);
      score += trophyActivity;
      
      // War activity (max 30 points)
      const warActivity = Math.min((deltas.warStars || 0) * 15, 30);
      score += warActivity;
      
      // Capital activity (max 20 points)
      const capitalActivity = Math.min((deltas.clanCapitalContributions || 0) / 50, 20);
      score += capitalActivity;

      return {
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        activityScore: Math.min(Math.round(score), 100),
      };
    });
  }, [historicalData]);

  // Calculate statistics
  const stats = useMemo(() => {
    const scores = activityData.map(d => d.activityScore);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // Activity consistency (lower standard deviation = more consistent)
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - stdDev);

    // Detect trend
    const recentAvg = scores.slice(-7).reduce((sum, s) => sum + s, 0) / Math.min(7, scores.length);
    const olderAvg = scores.slice(0, 7).reduce((sum, s) => sum + s, 0) / Math.min(7, scores.length);
    const trend = recentAvg - olderAvg;

    // Inactivity risk
    const recentScores = scores.slice(-7);
    const inactivityRisk = recentScores.filter(s => s < 30).length / recentScores.length;

    return {
      avgScore: Math.round(avgScore),
      maxScore,
      minScore,
      consistencyScore: Math.round(consistencyScore),
      trend: Math.round(trend),
      inactivityRisk: Math.round(inactivityRisk * 100),
    };
  }, [activityData]);

  const getBarColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#3b82f6'; // blue
    if (score >= 40) return '#eab308'; // yellow
    if (score >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="space-y-6">
      {/* Activity Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-gray-500">Avg Activity</p>
          </div>
          <p className="text-2xl font-bold text-gray-100">{stats.avgScore}/100</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.avgScore >= 80 ? 'Very Active' : stats.avgScore >= 60 ? 'Active' : stats.avgScore >= 40 ? 'Moderate' : 'Low'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-gray-500">Consistency</p>
          </div>
          <p className="text-2xl font-bold text-gray-100">{stats.consistencyScore}/100</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.consistencyScore >= 80 ? 'Very Consistent' : stats.consistencyScore >= 60 ? 'Consistent' : 'Variable'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-500">7-Day Trend</p>
          </div>
          <p className={`text-2xl font-bold ${stats.trend > 0 ? 'text-green-400' : stats.trend < 0 ? 'text-orange-400' : 'text-gray-100'}`}>
            {stats.trend > 0 ? '+' : ''}{stats.trend}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.trend > 0 ? 'Improving' : stats.trend < 0 ? 'Declining' : 'Stable'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${stats.inactivityRisk > 50 ? 'text-red-400' : 'text-green-400'}`} />
            <p className="text-xs text-gray-500">Inactivity Risk</p>
          </div>
          <p className={`text-2xl font-bold ${stats.inactivityRisk > 50 ? 'text-red-400' : 'text-green-400'}`}>
            {stats.inactivityRisk}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.inactivityRisk > 50 ? 'High Risk' : stats.inactivityRisk > 25 ? 'Moderate' : 'Low Risk'}
          </p>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Daily Activity Score
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={activityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <YAxis 
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#4b5563' }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="activityScore" radius={[4, 4, 0, 0]}>
              {activityData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.activityScore)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-400">Very Active (80+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-gray-400">Active (60-79)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-gray-400">Moderate (40-59)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span className="text-gray-400">Low (20-39)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-gray-400">Inactive (&lt;20)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerActivityAnalytics;
