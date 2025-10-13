'use client';

import React from 'react';
import { Swords, TrendingUp } from 'lucide-react';

interface HeroLevels {
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
}

interface HeroDataPoint {
  date: string;
  heroLevels: HeroLevels | null;
  deltas?: {
    heroUpgrades: string[];
  };
}

interface HeroUpgradeHistoryProps {
  data: HeroDataPoint[];
}

const heroNames: Record<string, string> = {
  'BK': 'Barbarian King',
  'AQ': 'Archer Queen',
  'GW': 'Grand Warden',
  'RC': 'Royal Champion',
  'MP': 'Minion Prince',
};

const heroColors: Record<string, string> = {
  'BK': 'text-orange-400 bg-orange-500/20',
  'AQ': 'text-pink-400 bg-pink-500/20',
  'GW': 'text-blue-400 bg-blue-500/20',
  'RC': 'text-purple-400 bg-purple-500/20',
  'MP': 'text-cyan-400 bg-cyan-500/20',
};

export default function HeroUpgradeHistory({ data }: HeroUpgradeHistoryProps) {
  // Extract upgrade events from deltas
  const upgradeEvents = data
    .filter(point => point.deltas?.heroUpgrades && point.deltas.heroUpgrades.length > 0)
    .map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }),
      upgrades: point.deltas!.heroUpgrades,
    }))
    .reverse(); // Show most recent first

  if (upgradeEvents.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center min-h-[200px]">
          <Swords className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-slate-400">No hero upgrades recorded in this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 border-b border-slate-700">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-orange-400" />
          </div>
          Hero Upgrade History
        </CardTitle>
        <CardDescription className="text-slate-300">
          {upgradeEvents.length} upgrade{upgradeEvents.length !== 1 ? 's' : ''} recorded
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {upgradeEvents.map((event, idx) => (
            <div 
              key={idx}
              className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
            >
              {/* Date */}
              <div className="flex-shrink-0 w-24">
                <div className="text-sm font-medium text-slate-300">
                  {event.date}
                </div>
              </div>

              {/* Upgrades */}
              <div className="flex-1 flex flex-wrap gap-2">
                {event.upgrades.map((upgrade, upgradeIdx) => {
                  // Parse upgrade string like "BK: 65 → 67"
                  const match = upgrade.match(/^([A-Z]+): (\d+) → (\d+)$/);
                  if (!match) return null;
                  
                  const [, hero, fromLevel, toLevel] = match;
                  const heroName = heroNames[hero] || hero;
                  const colorClass = heroColors[hero] || 'text-slate-400 bg-slate-500/20';

                  return (
                    <div 
                      key={upgradeIdx}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${colorClass} text-sm font-medium`}
                    >
                      <span className="font-semibold">{hero}</span>
                      <span className="text-xs opacity-75">
                        {fromLevel} → {toLevel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
