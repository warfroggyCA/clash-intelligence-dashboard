'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
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
    color: 'hsl(38, 92%, 50%)', // Orange
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[350px]">
          <Swords className="w-12 h-12 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No hero progression data available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    bk: point.heroLevels?.bk ?? 0,
    aq: point.heroLevels?.aq ?? 0,
    gw: point.heroLevels?.gw ?? 0,
    rc: point.heroLevels?.rc ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-orange-500" />
          Hero Progression
        </CardTitle>
        <CardDescription>
          Level progression of all your heroes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: 'Level', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="bk" 
              stroke="var(--color-bk)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="aq" 
              stroke="var(--color-aq)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="gw" 
              stroke="var(--color-gw)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="rc" 
              stroke="var(--color-rc)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
