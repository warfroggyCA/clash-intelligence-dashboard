'use client';

import React, { useMemo } from 'react';
import type { PlayerPerformanceOverviewData } from '@/lib/player-profile';
import SectionCard from '@/components/ui/SectionCard';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface PlayerPerformanceOverviewProps {
  data: PlayerPerformanceOverviewData;
}

export const PlayerPerformanceOverview: React.FC<PlayerPerformanceOverviewProps> = ({ data }) => {
  const { war, capital, activityTrend } = data;
  const chartData = useMemo(
    () =>
      activityTrend.map((entry) => ({
        period: entry.period,
        player: entry.playerScore,
        clan: entry.clanAverage,
        delta: entry.playerScore - entry.clanAverage,
      })),
    [activityTrend]
  );
  const hasActivityTrend = chartData.length > 0;

  return (
    <div className="space-y-4">
      <SectionCard title="War Performance" subtitle="Recent wars and efficiency" className="section-card--sub">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm text-muted-contrast">
              <span title="Successful attacks ÷ total attacks across the last 10 wars">
                Hit rate <span className="font-semibold text-high-contrast">{war.hitRate}%</span>
              </span>
              {' • '}
              <span title="Average stars earned per attack over the tracked span">
                Stars/attack <span className="font-semibold text-high-contrast">{war.starsPerAttack.toFixed(2)}</span>
              </span>
            </p>
            <div className="space-y-2">
              {war.recentWars.map((match) => (
                <div key={match.id} className="flex justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                  <div>
                    <p className="font-semibold text-high-contrast">{match.opponent}</p>
                    <p className="text-xs text-muted-contrast">{match.teamSize}v{match.teamSize} • Stars {match.stars}</p>
                  </div>
                  <span className={`text-sm font-semibold ${match.result === 'WIN' ? 'text-emerald-300' : match.result === 'LOSE' ? 'text-rose-300' : 'text-slate-200'}`}>
                    {match.result}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-muted-contrast">
              <span>Activity trend</span>
              <span className="text-[10px] font-medium lowercase tracking-[0.12em] text-amber-200" title="Player vs. clan average activity index">
                player vs clan
              </span>
            </p>
            <div className="mt-3 h-48">
              {hasActivityTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="6 6" vertical={false} />
                    <XAxis dataKey="period" stroke="rgba(226,232,240,0.6)" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.3)' }} dy={6} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<ActivityTrendTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="clan" stroke="rgba(250,204,21,0.8)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Clan avg" />
                    <Line type="monotone" dataKey="player" stroke="rgba(56,189,248,0.9)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Player" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-contrast">
                  No activity history yet.
                </div>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-contrast">
              Weekly activity index derived from donations, war attacks, capital raids, and logins. Hover a point to see how far above or below clan pace this player is.
            </p>
            <div className="mt-3 flex items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-muted-contrast">
              <span className="inline-flex items-center gap-2" title="Player activity score">
                <span className="h-1 w-6 rounded-full bg-sky-300" aria-hidden="true" /> Player
              </span>
              <span className="inline-flex items-center gap-2" title="Clan average activity score">
                <span className="h-1 w-6 rounded-full bg-amber-300" aria-hidden="true" /> Clan Avg
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Capital Performance" subtitle="Weekend contributions" className="section-card--sub">
        <div className="grid gap-3 sm:grid-cols-3 text-sm text-medium-contrast">
          <StatBlock
            label="Total loot"
            value={capital.totalLoot.toLocaleString()}
            hint="Sum of weekend Capital Gold delivered by this player across the selected period"
          />
          <StatBlock
            label="Carry score"
            value={capital.carryScore.toString()}
            hint="Weighted score combining districts cleared, donations, and raid medals earned"
          />
          <StatBlock
            label="Participation"
            value={`${capital.participationRate}%`}
            hint="Share of raid weekends where this player contributed at least one attack or donation"
          />
        </div>
      </SectionCard>
    </div>
  );
};

const StatBlock: React.FC<{ label: string; value: string; suffix?: string; hint?: string }> = ({ label, value, suffix, hint }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3" title={hint}>
    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-contrast">{label}</p>
    <p className="mt-1 text-lg font-semibold text-high-contrast">{value}{suffix}</p>
  </div>
);

interface ActivityTrendTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

const ActivityTrendTooltip: React.FC<ActivityTrendTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const playerPoint = payload.find((item) => item.dataKey === 'player');
  const clanPoint = payload.find((item) => item.dataKey === 'clan');

  if (!playerPoint || !clanPoint) {
    return null;
  }

  const delta = (playerPoint.value ?? 0) - (clanPoint.value ?? 0);
  const deltaLabel = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);

  return (
    <div className="min-w-[200px] rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{label}</p>
      <div className="mt-2 space-y-1">
        <p className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" /> Player
          </span>
          <span className="font-mono text-sm text-high-contrast">{playerPoint.value?.toFixed(1)}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" /> Clan avg
          </span>
          <span className="font-mono text-sm text-high-contrast">{clanPoint.value?.toFixed(1)}</span>
        </p>
      </div>
      <p className={`mt-2 text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
        {delta >= 0 ? 'Ahead of clan pace' : 'Below clan pace'} {deltaLabel}
      </p>
    </div>
  );
};

export default PlayerPerformanceOverview;
