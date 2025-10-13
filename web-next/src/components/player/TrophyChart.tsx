'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Regular Trophies': point.trophies ?? 0,
    'Ranked Trophies': point.rankedTrophies ?? 0,
  }));

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-semibold text-white">Trophy Progression</h2>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
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
            dataKey="Regular Trophies" 
            stroke="#eab308" 
            strokeWidth={2}
            dot={{ fill: '#eab308', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Ranked Trophies" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
