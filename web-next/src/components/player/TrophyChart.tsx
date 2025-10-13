'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, Label } from 'recharts';
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
  rankedTrophies: {
    label: 'Ranked Trophies',
    color: 'hsl(48, 96%, 53%)', // Gold
  },
} satisfies ChartConfig;

export default function TrophyChart({ data }: TrophyChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
          <Trophy className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-slate-400">No trophy history available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart (backend already handles carry-forward)
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: point.date,
    rankedTrophies: point.rankedTrophies ?? 0,
  }));

  // Find the index for Oct 6, 2025 (ranked mode start)
  const rankedModeStartDate = '2025-10-06';
  const rankedModeStartIndex = chartData.findIndex(d => d.fullDate >= rankedModeStartDate);

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-b border-slate-700">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          Trophy Progression
        </CardTitle>
        <CardDescription className="text-slate-300">
          Your ranked battle trophy journey • Ranked mode started Oct 6, 2025
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTrophies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(48, 96%, 53%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(48, 96%, 53%)" stopOpacity={0}/>
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
            {rankedModeStartIndex >= 0 && (
              <ReferenceLine 
                x={chartData[rankedModeStartIndex]?.date} 
                stroke="hsl(142, 76%, 50%)"
                strokeWidth={2}
                strokeDasharray="5 5"
              >
                <Label 
                  value="Ranked Mode Start" 
                  position="top" 
                  fill="hsl(142, 76%, 50%)"
                  style={{ fontSize: '12px', fontWeight: 'bold' }}
                />
              </ReferenceLine>
            )}
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area 
              type="monotone" 
              dataKey="rankedTrophies" 
              stroke="var(--color-rankedTrophies)"
              fillOpacity={1}
              fill="url(#colorTrophies)"
              strokeWidth={3}
              dot={{ fill: 'hsl(48, 96%, 53%)', r: 4, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ r: 7, strokeWidth: 2 }}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
