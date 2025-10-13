'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Swords } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

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

const chartConfig = {
  bk: {
    label: 'Barbarian King',
    color: 'hsl(25, 95%, 53%)', // Bright orange
  },
  aq: {
    label: 'Archer Queen',
    color: 'hsl(330, 81%, 60%)', // Pink
  },
  gw: {
    label: 'Grand Warden',
    color: 'hsl(217, 91%, 60%)', // Blue
  },
  rc: {
    label: 'Royal Champion',
    color: 'hsl(271, 91%, 65%)', // Purple
  },
} satisfies ChartConfig;

export default function HeroProgressionChart({ data }: HeroProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center min-h-[350px]">
          <Swords className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-slate-400">No hero progression data available</p>
        </CardContent>
      </Card>
    );
  }

  // Clean data - carry forward last known values and filter out completely empty records
  let lastKnownValues = { bk: null as number | null, aq: null as number | null, gw: null as number | null, rc: null as number | null };
  
  const chartData = data
    .map(point => {
      // Get current values or use last known
      const bk = point.heroLevels?.bk ?? lastKnownValues.bk;
      const aq = point.heroLevels?.aq ?? lastKnownValues.aq;
      const gw = point.heroLevels?.gw ?? lastKnownValues.gw;
      const rc = point.heroLevels?.rc ?? lastKnownValues.rc;
      
      // Update last known values if we have new data
      if (point.heroLevels?.bk) lastKnownValues.bk = point.heroLevels.bk;
      if (point.heroLevels?.aq) lastKnownValues.aq = point.heroLevels.aq;
      if (point.heroLevels?.gw) lastKnownValues.gw = point.heroLevels.gw;
      if (point.heroLevels?.rc) lastKnownValues.rc = point.heroLevels.rc;
      
      return {
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bk: bk ?? undefined,
        aq: aq ?? undefined,
        gw: gw ?? undefined,
        rc: rc ?? undefined,
      };
    })
    .filter(point => point.bk || point.aq || point.gw || point.rc); // Only keep points with at least one hero

  if (chartData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center min-h-[350px]">
          <Swords className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-slate-400">No hero progression data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 border-b border-slate-700">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Swords className="w-5 h-5 text-orange-400" />
          </div>
          Hero Progression
        </CardTitle>
        <CardDescription className="text-slate-300">
          Track your hero levels over time - upgrades persist across snapshots
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBK" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAQ" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(330, 81%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(330, 81%, 60%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorGW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(271, 91%, 65%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(271, 91%, 65%)" stopOpacity={0}/>
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
              label={{ value: 'Level', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area 
              type="monotone" 
              dataKey="bk" 
              stroke="var(--color-bk)"
              fillOpacity={1}
              fill="url(#colorBK)"
              strokeWidth={3}
              dot={{ fill: 'hsl(25, 95%, 53%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
            <Area 
              type="monotone" 
              dataKey="aq" 
              stroke="var(--color-aq)"
              fillOpacity={1}
              fill="url(#colorAQ)"
              strokeWidth={3}
              dot={{ fill: 'hsl(330, 81%, 60%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
            <Area 
              type="monotone" 
              dataKey="gw" 
              stroke="var(--color-gw)"
              fillOpacity={1}
              fill="url(#colorGW)"
              strokeWidth={3}
              dot={{ fill: 'hsl(217, 91%, 60%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
            <Area 
              type="monotone" 
              dataKey="rc" 
              stroke="var(--color-rc)"
              fillOpacity={1}
              fill="url(#colorRC)"
              strokeWidth={3}
              dot={{ fill: 'hsl(271, 91%, 65%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
