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
  memberData?: Member; // Optional: full member data for accurate activity calculation
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
  playerName,
  memberData
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
      memberData ?? ({
        tag: `analytics-${playerName}`,
        name: playerName,
      } as Member),
    [playerName, memberData],
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
      const evidence = calculateActivityScore(stubMember, { timeline: [event], lookbackDays: 7 });
      const breakdownTotals = evidence.breakdown ?? createEmptyBreakdown();
      // Store full breakdown so tooltip can show all contributing categories
      const chartBreakdown = {
        donations: breakdownTotals.donations,
        trophies: breakdownTotals.trophies,
        war: breakdownTotals.war,
        capital: breakdownTotals.capital,
        // Add other major categories
        realtime: breakdownTotals.realtime,
        heroProgress: breakdownTotals.heroProgress,
        role: breakdownTotals.role,
        upgrades: breakdownTotals.upgrades,
        builder: breakdownTotals.builder,
        other: breakdownTotals.other + breakdownTotals.lab + breakdownTotals.achievements + breakdownTotals.superTroops,
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

    // Show all non-zero categories, grouped logically
    const categories = [
      { key: 'realtime', label: 'Ranked Battles', value: breakdown.realtime },
      { key: 'donations', label: 'Donations', value: breakdown.donations },
      { key: 'trophies', label: 'Trophy Level', value: breakdown.trophies },
      { key: 'war', label: 'War Contribution', value: breakdown.war },
      { key: 'capital', label: 'Capital', value: breakdown.capital },
      { key: 'heroProgress', label: 'Hero Progress', value: breakdown.heroProgress },
      { key: 'role', label: 'Clan Role', value: breakdown.role },
      { key: 'upgrades', label: 'Upgrades', value: breakdown.upgrades },
      { key: 'builder', label: 'Builder Base', value: breakdown.builder },
      { key: 'other', label: 'Other', value: breakdown.other },
    ].filter(cat => cat.value > 0);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl max-w-xs">
        <p className="font-medium text-slate-100 mb-2">{label}</p>
        <p className="text-lg font-bold mb-3" style={{ color: data.color }}>
          Score: {data.score}/100 ({getScoreLabel(data.score)})
        </p>
        {categories.length > 0 ? (
          <div className="space-y-1 text-sm">
            {categories.map((cat) => (
              <div key={cat.key} className="flex justify-between">
                <span className="text-slate-300">{cat.label}:</span>
                <span className="font-medium text-slate-100">{cat.value.toFixed(1)} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No activity breakdown available</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className="font-medium text-slate-200">Avg Score</h3>
          </div>
          <p className="text-2xl font-bold text-blue-400">{analytics.averageScore}</p>
          <p className="text-sm text-slate-400">{getScoreLabel(analytics.averageScore)}</p>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-slate-200">Consistency</h3>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{analytics.consistencyScore}</p>
          <p className="text-sm text-slate-400">
            {analytics.consistencyScore >= 80 ? 'Very Consistent' :
             analytics.consistencyScore >= 60 ? 'Consistent' :
             analytics.consistencyScore >= 40 ? 'Moderate' : 'Inconsistent'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            {analytics.trend >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <h3 className="font-medium text-slate-200">7-Day Trend</h3>
          </div>
          <p className={`text-2xl font-bold ${analytics.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {analytics.trend >= 0 ? '+' : ''}{analytics.trend}
          </p>
          <p className="text-sm text-slate-400">
            {Math.abs(analytics.trend) < 5 ? 'Stable' :
             analytics.trend > 0 ? 'Improving' : 'Declining'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-5 h-5 ${
              analytics.inactivityRisk === 'High' ? 'text-red-400' :
              analytics.inactivityRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
            }`} />
            <h3 className="font-medium text-slate-200">Risk Level</h3>
          </div>
          <p className={`text-2xl font-bold ${
            analytics.inactivityRisk === 'High' ? 'text-red-400' :
            analytics.inactivityRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {analytics.inactivityRisk}
          </p>
          <p className="text-sm text-slate-400">Inactivity Risk</p>
        </div>
      </div>

      {/* Activity Score Chart */}
      <div className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-6">
        <h3 className="font-semibold text-slate-100 mb-4">Daily Activity Scores</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={activityScores} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#94a3b8"
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
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
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
