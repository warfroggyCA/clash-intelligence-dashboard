'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Swords } from 'lucide-react';

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
}

interface HeroProgressionChartProps {
  data: HeroDataPoint[];
}

export default function HeroProgressionChart({ data }: HeroProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <Swords className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">No hero progression data available</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Barbarian King': point.heroLevels?.bk ?? 0,
    'Archer Queen': point.heroLevels?.aq ?? 0,
    'Grand Warden': point.heroLevels?.gw ?? 0,
    'Royal Champion': point.heroLevels?.rc ?? 0,
  }));

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Swords className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-semibold text-white">Hero Progression</h2>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            label={{ value: 'Level', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              fontSize: '14px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="Barbarian King" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="Archer Queen" 
            stroke="#ec4899" 
            strokeWidth={2}
            dot={{ fill: '#ec4899', r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="Grand Warden" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="Royal Champion" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={{ fill: '#8b5cf6', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
