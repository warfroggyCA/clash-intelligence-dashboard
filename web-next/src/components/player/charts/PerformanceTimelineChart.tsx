'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceTimelineChartProps {
  data: Array<{
    date: string;
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
    clanCapitalContributions?: number;
    deltas?: {
      trophies?: number;
      donations?: number;
      donationsReceived?: number;
      clanCapitalContributions?: number;
    };
  }>;
  metric: 'trophies' | 'donations' | 'donationsReceived' | 'clanCapitalContributions';
  title: string;
  color?: string;
}

const metricColors = {
  trophies: '#F59E0B',
  donations: '#10B981', 
  donationsReceived: '#8B5CF6',
  clanCapitalContributions: '#EF4444'
};

const metricLabels = {
  trophies: 'Trophies',
  donations: 'Donations',
  donationsReceived: 'Donations Received',
  clanCapitalContributions: 'Capital Gold'
};

export default function PerformanceTimelineChart({ 
  data, 
  metric, 
  title, 
  color 
}: PerformanceTimelineChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      date: format(new Date(point.date), 'MMM dd'),
      value: point[metric] || 0,
      delta: point.deltas?.[metric] || 0
    }));
  }, [data, metric]);

  const trendPercentage = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }, [chartData]);

  const chartColor = color || metricColors[metric];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const delta = data.delta;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm">
          <span className="font-medium" style={{ color: chartColor }}>
            {metricLabels[metric]}: {data.value.toLocaleString()}
          </span>
        </p>
        {delta !== 0 && (
          <p className="text-xs flex items-center gap-1">
            {delta > 0 ? (
              <>
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span className="text-green-600">+{delta.toLocaleString()}</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-3 h-3 text-red-600" />
                <span className="text-red-600">{delta.toLocaleString()}</span>
              </>
            )}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {Math.abs(trendPercentage) > 0.1 && (
          <div className="flex items-center gap-1 text-sm">
            {trendPercentage > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-green-600">+{trendPercentage.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-red-600">{trendPercentage.toFixed(1)}%</span>
              </>
            )}
          </div>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={chartColor}
            strokeWidth={2}
            dot={{ fill: chartColor, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, stroke: chartColor, strokeWidth: 2, fill: 'white' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}