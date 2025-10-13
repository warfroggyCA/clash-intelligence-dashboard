'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Heart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

interface DonationDataPoint {
  date: string;
  donations: number | null;
  donationsReceived: number | null;
}

interface DonationChartProps {
  data: DonationDataPoint[];
}

const chartConfig = {
  donations: {
    label: 'Donated',
    color: 'hsl(142, 76%, 50%)', // Emerald green
  },
  donationsReceived: {
    label: 'Received',
    color: 'hsl(330, 81%, 60%)', // Pink
  },
} satisfies ChartConfig;

export default function DonationChart({ data }: DonationChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
          <Heart className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-slate-400">No donation history available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart - carry forward last known values
  let lastDonations = 0;
  let lastReceived = 0;
  const chartData = data.map(point => {
    const donations = point.donations ?? lastDonations;
    const donationsReceived = point.donationsReceived ?? lastReceived;
    
    if (point.donations !== null) lastDonations = point.donations;
    if (point.donationsReceived !== null) lastReceived = point.donationsReceived;
    
    return {
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      donations,
      donationsReceived,
    };
  });

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-pink-500/10 border-b border-slate-700">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="p-2 bg-pink-500/20 rounded-lg">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          Donation Activity
        </CardTitle>
        <CardDescription className="text-slate-300">
          Track your clan generosity and support received
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDonations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(330, 81%, 60%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(330, 81%, 60%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="#94a3b8"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="#94a3b8"
              style={{ fontSize: '12px' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area 
              type="monotone" 
              dataKey="donations" 
              stroke="var(--color-donations)"
              fillOpacity={1}
              fill="url(#colorDonations)"
              strokeWidth={3}
              dot={{ fill: 'hsl(142, 76%, 50%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 7, strokeWidth: 2 }}
              connectNulls
            />
            <Area 
              type="monotone" 
              dataKey="donationsReceived" 
              stroke="var(--color-donationsReceived)"
              fillOpacity={1}
              fill="url(#colorReceived)"
              strokeWidth={3}
              dot={{ fill: 'hsl(330, 81%, 60%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 7, strokeWidth: 2 }}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
