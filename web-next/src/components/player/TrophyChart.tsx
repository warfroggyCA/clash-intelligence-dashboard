'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

interface TrophyDataPoint {
  date: string;
  trophies: number | null;
  rankedTrophies: number | null;
}

interface TrophyChartProps {
  data: TrophyDataPoint[];
}

const chartConfig = {
  trophies: {
    label: 'Regular Trophies',
    color: 'hsl(48, 96%, 53%)', // Yellow
  },
  rankedTrophies: {
    label: 'Ranked Trophies',
    color: 'hsl(217, 91%, 60%)', // Blue
  },
} satisfies ChartConfig;

export default function TrophyChart({ data }: TrophyChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
          <Trophy className="w-12 h-12 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No trophy history available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    trophies: point.trophies ?? 0,
    rankedTrophies: point.rankedTrophies ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Trophy Progression
        </CardTitle>
        <CardDescription>
          Track your trophy journey over the last {data.length} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="trophies" 
              stroke="var(--color-trophies)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="rankedTrophies" 
              stroke="var(--color-rankedTrophies)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
