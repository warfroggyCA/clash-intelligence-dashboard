'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { calculateActivityScore } from '@/lib/business/calculations';
import type { ActivityBreakdown, Member, PlayerActivityTimelineEvent, HeroCaps } from '@/types';

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
  const createEmptyBreakdown = (): ActivityBreakdown => ({
    realtime: 0,
    war: 0,
    donations: 0,
    capital: 0,
    builder: 0,
    upgrades: 0,
    lab: 0,
    achievements: 0,
    trophies: 0,
    heroProgress: 0,
    role: 0,
    superTroops: 0,
    other: 0,
  });

  const stubMember: Member = useMemo(
    () =>
      ({
        tag: `analytics-${playerName}`,
        name: playerName,
      } as Member),
    [playerName],
  );

  const toActivityEvent = (point: PlayerActivityAnalyticsProps['data'][number]): PlayerActivityTimelineEvent => {
    const deltas = point.deltas ?? {};

    const extractDelta = (...keys: string[]): number => {
      for (const key of keys) {
        const value = deltas[key as keyof typeof deltas];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
      return 0;
    };

    const heroUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('hero_') && typeof value === 'number' && value > 0)
      .map(([key, value]) => ({
        hero: key.replace('hero_', '') as keyof HeroCaps,
        from: null,
        to: value as number,
      }));

    const petUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('pet_') && typeof value === 'number' && value > 0)
      .map(([key, value]) => ({
        pet: key.replace('pet_', ''),
        from: null,
        to: value as number,
      }));

    const equipmentUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('equipment_') && typeof value === 'number' && value > 0)
      .map(([key, value]) => ({
        equipment: key.replace('equipment_', ''),
        from: null,
        to: value as number,
      }));

    return {
      date: point.date,
      trophies: 0,
      rankedTrophies: null,
      donations: 0,
      donationsReceived: 0,
      activityScore: null,
      trophyDelta: extractDelta('trophies'),
      rankedTrophyDelta: extractDelta('ranked_trophies'),
      donationsDelta: extractDelta('donations'),
      donationsReceivedDelta: extractDelta('donations_rcv', 'donations_received'),
      heroUpgrades,
      petUpgrades,
      equipmentUpgrades,
      superTroopsActivated: [],
      superTroopsDeactivated: [],
      warStars: 0,
      warStarsDelta: extractDelta('war_stars'),
      attackWins: 0,
      attackWinsDelta: extractDelta('attack_wins'),
      defenseWins: 0,
      defenseWinsDelta: extractDelta('defense_wins'),
      capitalContributions: 0,
      capitalContributionDelta: extractDelta('capital_contrib', 'capital_contribution'),
      builderHallLevel: null,
      builderHallDelta: extractDelta('builder_hall', 'builder_hall_level', 'bh'),
      versusBattleWins: 0,
      versusBattleWinsDelta: extractDelta('builder_battle_wins', 'versus_battle_wins'),
      maxTroopCount: null,
      maxTroopDelta: extractDelta('max_troop_count'),
      maxSpellCount: null,
      maxSpellDelta: extractDelta('max_spell_count'),
      achievementCount: null,
      achievementDelta: extractDelta('achievement_count'),
      expLevel: null,
      expLevelDelta: extractDelta('exp_level'),
      summary: '',
    };
  };

  const activityScores = useMemo(() => {
    return data.map(point => {
      const event = toActivityEvent(point);
      const evidence = calculateActivityScore(stubMember, { timeline: [event], lookbackDays: 1 });
      const breakdownTotals = evidence.breakdown ?? createEmptyBreakdown();
      const chartBreakdown = {
        donations: breakdownTotals.donations,
        trophies: breakdownTotals.trophies,
        war: breakdownTotals.war,
        capital: breakdownTotals.capital,
      };
      const totalScore = Object.values(breakdownTotals).reduce((sum, val) => sum + val, 0);
      const roundedScore = Math.round(totalScore);

      return {
        date: format(new Date(point.date), 'MMM dd'),
        score: roundedScore,
        breakdown: chartBreakdown,
        color: getScoreColor(roundedScore)
      };
    });
  }, [data, stubMember]);

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
            <span className="font-medium">{breakdown.donations.toFixed(1)} pts</span>
          </div>
          <div className="flex justify-between">
            <span>Trophies:</span>
            <span className="font-medium">{breakdown.trophies.toFixed(1)} pts</span>
          </div>
          <div className="flex justify-between">
            <span>War Contribution:</span>
            <span className="font-medium">{breakdown.war.toFixed(1)} pts</span>
          </div>
          <div className="flex justify-between">
            <span>Capital:</span>
            <span className="font-medium">{breakdown.capital.toFixed(1)} pts</span>
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
          {playerName}&apos;s activity scored based on daily contributions across key metrics
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
