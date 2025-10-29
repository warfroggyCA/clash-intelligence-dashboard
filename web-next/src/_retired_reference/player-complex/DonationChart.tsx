'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    donations: point.donations ?? 0,
    donationsReceived: point.donationsReceived ?? 0,
  }));

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Heart className="w-6 h-6 text-pink-500" />
        <div>
          <h2 className="text-xl font-semibold text-white">Donation Activity</h2>
          <p className="text-sm text-slate-400">Resets each season</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDonations" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
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
          <Legend />
          <Area 
            type="monotone" 
            dataKey="donations" 
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorDonations)"
            strokeWidth={3}
          />
          <Area 
            type="monotone" 
            dataKey="donationsReceived" 
            stroke="#ec4899"
            fillOpacity={1}
            fill="url(#colorReceived)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
