'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
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
    color: 'hsl(142, 76%, 36%)', // Green
  },
  donationsReceived: {
    label: 'Received',
    color: 'hsl(330, 81%, 60%)', // Pink
  },
} satisfies ChartConfig;

export default function DonationChart({ data }: DonationChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
          <Heart className="w-12 h-12 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No donation history available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    donations: point.donations ?? 0,
    donationsReceived: point.donationsReceived ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          Donation Activity
        </CardTitle>
        <CardDescription>
          Your generosity and support from clan mates
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
              dataKey="donations" 
              stroke="var(--color-donations)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="donationsReceived" 
              stroke="var(--color-donationsReceived)"
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
