'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface PlayerActivityAnalyticsProps {
  data: Array<{
    date: string;
    deltas?: {
      trophies?: number;
      donations?: number;
      warStars?: number;
      clanCapitalContributions?: number;
    };
  }>;
  playerName: string;
}

interface ActivityScore {
  date: string;
  score: number;
  breakdown: {
    donations: number;
    trophies: number;
    warStars: number;
    capital: number;
  };
}

function calculateActivityScore(deltas: any): ActivityScore['breakdown'] {
  const donations = deltas?.donations || 0;
  const trophies = Math.abs(deltas?.trophies || 0);
  const warStars = deltas?.warStars || 0;
  const capital = deltas?.clanCapitalContributions || 0;

  return {
    donations: Math.min(Math.max(donations / 2, 0), 30), // Max 30 points
    trophies: Math.min(trophies / 5, 20), // Max 20 points  
    warStars: Math.min(warStars * 15, 30), // Max 30 points
    capital: Math.min(capital / 50, 20), // Max 20 points
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'; // green-500
  if (score >= 60) return '#3B82F6'; // blue-500
  if (score >= 40) return '#F59E0B'; // amber-500
  if (score >= 20) return '#F97316'; // orange-500
  return '#EF4444'; // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Very Active';
  if (score >= 60) return 'Active';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low Activity';
  return 'Inactive';
}

export default function PlayerActivityAnalytics({ 
  data, 
  playerName 
}: PlayerActivityAnalyticsProps) {
  const activityScores = useMemo(() => {
    return data.map(point => {
      const breakdown = calculateActivityScore(point.deltas);
      const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
      
      return {
        date: format(new Date(point.date), 'MMM dd'),
        score: Math.round(totalScore),
        breakdown,
        color: getScoreColor(totalScore)
      };
    });
  }, [data]);

  const analytics = useMemo(() => {
    if (activityScores.length === 0) {
      return {
        averageScore: 0,
        consistencyScore: 0,
        trend: 0,
        inactivityRisk: 'Unknown'
      };
    }

    const scores = activityScores.map(s => s.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation for consistency
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length;
    const stdDeviation = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - stdDeviation);

    // Calculate 7-day trend
    const recentScores = scores.slice(-7);
    const trend = recentScores.length >= 2 
      ? recentScores[recentScores.length - 1] - recentScores[0]
      : 0;

    // Assess inactivity risk
    const lowActivityDays = scores.filter(score => score < 20).length;
    const riskPercentage = (lowActivityDays / scores.length) * 100;
    
    let inactivityRisk = 'Low';
    if (riskPercentage > 50) inactivityRisk = 'High';
    else if (riskPercentage > 25) inactivityRisk = 'Medium';

    return {
      averageScore: Math.round(averageScore),
      consistencyScore: Math.round(consistencyScore),
      trend: Math.round(trend),
      inactivityRisk
    };
  }, [activityScores]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const breakdown = data.breakdown;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <p className="text-lg font-bold mb-2" style={{ color: data.color }}>
          Score: {data.score}/100 ({getScoreLabel(data.score)})
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Donations:</span>
            <span className="font-medium">{breakdown.donations.toFixed(1)}/30</span>
          </div>
          <div className="flex justify-between">
            <span>Trophies:</span>
            <span className="font-medium">{breakdown.trophies.toFixed(1)}/20</span>
          </div>
          <div className="flex justify-between">
            <span>War Stars:</span>
            <span className="font-medium">{breakdown.warStars.toFixed(1)}/30</span>
          </div>
          <div className="flex justify-between">
            <span>Capital:</span>
            <span className="font-medium">{breakdown.capital.toFixed(1)}/20</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Daily Activity Analysis
        </h2>
        <p className="text-gray-600">
          {playerName}'s activity scored based on daily contributions across key metrics
        </p>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-gray-900">Avg Score</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{analytics.averageScore}</p>
          <p className="text-sm text-gray-500">{getScoreLabel(analytics.averageScore)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-medium text-gray-900">Consistency</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{analytics.consistencyScore}</p>
          <p className="text-sm text-gray-500">
            {analytics.consistencyScore >= 80 ? 'Very Consistent' :
             analytics.consistencyScore >= 60 ? 'Consistent' :
             analytics.consistencyScore >= 40 ? 'Moderate' : 'Inconsistent'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {analytics.trend >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <h3 className="font-medium text-gray-900">7-Day Trend</h3>
          </div>
          <p className={`text-2xl font-bold ${analytics.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analytics.trend >= 0 ? '+' : ''}{analytics.trend}
          </p>
          <p className="text-sm text-gray-500">
            {Math.abs(analytics.trend) < 5 ? 'Stable' :
             analytics.trend > 0 ? 'Improving' : 'Declining'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-5 h-5 ${
              analytics.inactivityRisk === 'High' ? 'text-red-600' :
              analytics.inactivityRisk === 'Medium' ? 'text-orange-600' : 'text-green-600'
            }`} />
            <h3 className="font-medium text-gray-900">Risk Level</h3>
          </div>
          <p className={`text-2xl font-bold ${
            analytics.inactivityRisk === 'High' ? 'text-red-600' :
            analytics.inactivityRisk === 'Medium' ? 'text-orange-600' : 'text-green-600'
          }`}>
            {analytics.inactivityRisk}
          </p>
          <p className="text-sm text-gray-500">Inactivity Risk</p>
        </div>
      </div>

      {/* Activity Score Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Daily Activity Scores</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={activityScores} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="score" 
              radius={[4, 4, 0, 0]}
            >
              {activityScores.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Very Active (80-100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Active (60-79)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span>Moderate (40-59)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>Low (20-39)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Inactive (&lt;20)</span>
          </div>
        </div>
      </div>
    </div>
  );
}