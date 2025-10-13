'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy } from 'lucide-react';

interface TrophyDataPoint {
  date: string;
  trophies: number | null;
  rankedTrophies: number | null;
}

interface TrophyChartProps {
  data: TrophyDataPoint[];
}

export default function TrophyChart({ data }: TrophyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">No trophy history available</p>
      </div>
    );
  }

  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rankedTrophies: point.rankedTrophies ?? 0,
  }));

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <div>
          <h2 className="text-xl font-semibold text-white">Trophy Progression</h2>
          <p className="text-sm text-slate-400">Ranked mode started Oct 6, 2025</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTrophies" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="rankedTrophies" 
            stroke="#eab308"
            fillOpacity={1}
            fill="url(#colorTrophies)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
