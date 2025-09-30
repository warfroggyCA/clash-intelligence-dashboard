'use client';

import React from 'react';
import { PlayerPerformanceOverviewData } from '@/lib/player-profile';
import SectionCard from '@/components/ui/SectionCard';

interface PlayerPerformanceOverviewProps {
  data: PlayerPerformanceOverviewData;
}

export const PlayerPerformanceOverview: React.FC<PlayerPerformanceOverviewProps> = ({ data }) => {
  const { war, capital, activityTrend } = data;

  return (
    <div className="space-y-4">
      <SectionCard title="War Performance" subtitle="Recent wars and efficiency" className="section-card--sub">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm text-muted-contrast">
              Hit rate <span className="font-semibold text-high-contrast">{war.hitRate}%</span> • Stars/attack <span className="font-semibold text-high-contrast">{war.starsPerAttack.toFixed(2)}</span>
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
            <p className="text-xs uppercase tracking-[0.28em] text-muted-contrast">Activity trend</p>
            <div className="mt-3 flex items-end gap-1">
              {activityTrend.map((value, index) => (
                <div
                  key={`trend-${index}`}
                  className="flex-1 rounded-t bg-brand-primary/60"
                  style={{ height: `${Math.max(value, 10)}px` }}
                  title={`Activity score: ${value}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-contrast">Values represent weekly activity scores recalculated from donations, attacks, and logins.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Capital Performance" subtitle="Weekend contributions" className="section-card--sub">
        <div className="grid gap-3 sm:grid-cols-3 text-sm text-medium-contrast">
          <StatBlock label="Total loot" value={capital.totalLoot.toLocaleString()} suffix="" />
          <StatBlock label="Carry score" value={capital.carryScore.toString()} suffix="" />
          <StatBlock label="Participation" value={`${capital.participationRate}%`} suffix="" />
        </div>
      </SectionCard>
    </div>
  );
};

const StatBlock: React.FC<{ label: string; value: string; suffix?: string }> = ({ label, value, suffix }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-contrast">{label}</p>
    <p className="mt-1 text-lg font-semibold text-high-contrast">{value}{suffix}</p>
  </div>
);

export default PlayerPerformanceOverview;
