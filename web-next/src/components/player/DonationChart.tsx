'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Heart } from 'lucide-react';

interface DonationDataPoint {
  date: string;
  donations: number | null;
  donationsReceived: number | null;
}

interface DonationChartProps {
  data: DonationDataPoint[];
}

export default function DonationChart({ data }: DonationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <Heart className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">No donation history available</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Donated': point.donations ?? 0,
    'Received': point.donationsReceived ?? 0,
  }));

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-pink-500" />
        <h2 className="text-xl font-semibold text-white">Donation Activity</h2>
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
            dataKey="Donated" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Received" 
            stroke="#ec4899" 
            strokeWidth={2}
            dot={{ fill: '#ec4899', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
