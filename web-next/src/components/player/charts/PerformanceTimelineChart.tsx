'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DataPoint {
  date: string;
  trophies: number;
  donations: number;
  donationsReceived: number;
  clanCapitalContributions: number;
  deltas?: {
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
    clanCapitalContributions?: number;
  };
}

interface PerformanceTimelineChartProps {
  data: DataPoint[];
  metric: 'trophies' | 'donations' | 'donationsReceived' | 'clanCapitalContributions';
  title: string;
  color?: string;
}

const METRIC_CONFIG = {
  trophies: { 
    label: 'Trophies', 
    color: '#3b82f6', 
    icon: '🏆',
    format: (val: number) => val.toLocaleString()
  },
  donations: { 
    label: 'Donations Given', 
    color: '#10b981', 
    icon: '🎁',
    format: (val: number) => val.toLocaleString()
  },
  donationsReceived: { 
    label: 'Donations Received', 
    color: '#8b5cf6', 
    icon: '📥',
    format: (val: number) => val.toLocaleString()
  },
  clanCapitalContributions: { 
    label: 'Capital Gold', 
    color: '#f59e0b', 
    icon: '🏛️',
    format: (val: number) => val.toLocaleString()
  },
};

const CustomTooltip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload || !payload.length) return null;

  const config = METRIC_CONFIG[metric as keyof typeof METRIC_CONFIG];
  const value = payload[0].value;
  const delta = payload[0].payload.deltas?.[metric];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-300 text-sm font-medium mb-1">{label}</p>
      <p className="text-white text-lg font-bold">
        {config.icon} {config.format(value)}
      </p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-sm flex items-center gap-1 mt-1 ${
          delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
        }`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? '+' : ''}{delta}
        </p>
      )}
    </div>
  );
};

export const PerformanceTimelineChart: React.FC<PerformanceTimelineChartProps> = ({
  data,
  metric,
  title,
  color,
}) => {
  const config = METRIC_CONFIG[metric];
  const lineColor = color || config.color;

  // Format date for display (MM/DD)
  const formattedData = data.map(point => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Calculate trend
  const trend = data.length >= 2 
    ? data[data.length - 1][metric] - data[0][metric]
    : 0;

  const trendPercentage = data.length >= 2 && data[0][metric] > 0
    ? ((trend / data[0][metric]) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <span>{config.icon}</span>
            {title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">Last {data.length} days</p>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 text-sm font-medium ${
            trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : trend < 0 ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <span>{trend > 0 ? '+' : ''}{trend}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {trend > 0 ? '+' : ''}{trendPercentage}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="displayDate" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={{ stroke: '#4b5563' }}
          />
          <YAxis 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={{ stroke: '#4b5563' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Line 
            type="monotone" 
            dataKey={metric} 
            stroke={lineColor} 
            strokeWidth={2}
            dot={{ fill: lineColor, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceTimelineChart;
