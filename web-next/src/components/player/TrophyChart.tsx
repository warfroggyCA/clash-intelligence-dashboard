'use client';

import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy } from 'lucide-react';

interface TrophyDataPoint {
  date: string;
  trophies: number | null;
  rankedTrophies: number | null;
}

interface TrophyChartProps {
  data: TrophyDataPoint[];
}

export default function TrophyChart({ data }: TrophyChartProps) {
  // Ranked League start date - Oct 6, 2025
  const rankedStartTime = new Date('2025-10-06T00:00:00Z').getTime();
  
  // Filter and format data, ensuring we only include Oct 6, 2025 onwards
  // Use strict date string comparison to exclude Oct 5 and earlier
  const chartData = useMemo(() => {
    const rankedStartDateStr = '2025-10-06';
    
    console.log('[TrophyChart] Raw input data:', data);
    
    const filtered = data.filter(point => {
      if (!point.date) {
        console.warn('[TrophyChart] Point missing date:', point);
        return false;
      }
      
      // Extract date string (YYYY-MM-DD) - handle both ISO strings and date-only strings
      let pointDateStr: string;
      const dateStr = String(point.date);
      if (dateStr.includes('T')) {
        pointDateStr = dateStr.split('T')[0];
      } else {
        pointDateStr = dateStr.substring(0, 10);
      }
      
      console.log('[TrophyChart] Checking date:', pointDateStr, '>=', rankedStartDateStr, '?', pointDateStr >= rankedStartDateStr);
      
      // Strictly exclude Oct 5 and earlier - must be >= Oct 6
      if (pointDateStr < rankedStartDateStr) {
        console.warn('[TrophyChart] EXCLUDING date:', pointDateStr, point);
        return false;
      }
      
      // Double-check with timestamp comparison
      const pointTime = new Date(point.date).getTime();
      if (pointTime < rankedStartTime) {
        console.warn('[TrophyChart] EXCLUDING timestamp:', point.date, pointTime, rankedStartTime);
        return false;
      }
      
      return true;
    });
    
    console.log('[TrophyChart] Filtered data:', filtered.length, 'of', data.length);
    console.log('[TrophyChart] First filtered date:', filtered[0]?.date);
    
    // Debug: log any Oct 5 dates that might be getting through
    const oct5Dates = data.filter(point => {
      if (!point.date) return false;
      const dateStr = String(point.date);
      const pointDateStr = dateStr.includes('T') 
        ? dateStr.split('T')[0] 
        : dateStr.substring(0, 10);
      return pointDateStr === '2025-10-05';
    });
    if (oct5Dates.length > 0) {
      console.error('[TrophyChart] ERROR: Found Oct 5 dates in input data:', oct5Dates);
      console.error('[TrophyChart] Filtered data count:', filtered.length, 'of', data.length);
    }
    
    let previousMonth: number | null = null;
    let index = 0;
    const mapped = filtered.map(point => {
      const dateObj = new Date(point.date);
      const dateTime = dateObj.getTime();
      const dateStr = dateObj.toISOString().split('T')[0];
      
      // Final safety check - don't include if timestamp is before Oct 6
      if (dateTime < rankedStartTime || dateStr < rankedStartDateStr) {
        console.error('[TrophyChart] ERROR: Point passed filter but timestamp/date is before Oct 6:', point.date, dateTime, dateStr);
        return null;
      }
      
      const currentMonth = dateObj.getMonth();
      const currentDay = dateObj.getDate();
      
      // Format date: show month name at the start of each month, otherwise just the day number
      // Always show month name for the first data point
      let formattedDate: string;
      if (index === 0 || previousMonth === null || currentMonth !== previousMonth) {
        // First data point or start of a new month - show "Month Day"
        formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        previousMonth = currentMonth;
      } else {
        // Same month - show just the day number
        formattedDate = currentDay.toString();
      }
      
      index++;
      
      // Final check - if formatted date contains "Oct 5", reject it
      if (formattedDate.includes('Oct 5')) {
        console.error('[TrophyChart] ERROR: Formatted date contains Oct 5:', formattedDate, point.date);
        return null;
      }
      
      return {
        date: formattedDate,
        dateTime: dateTime,
        rankedTrophies: point.rankedTrophies ?? 0,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    
    console.log('[TrophyChart] Final chartData:', mapped.length, 'points');
    console.log('[TrophyChart] First chartData point:', mapped[0]);
    
    // Final check - make sure no Oct 5 made it through
    const oct5InFinal = mapped.filter(d => d.date.includes('Oct 5'));
    if (oct5InFinal.length > 0) {
      console.error('[TrophyChart] CRITICAL ERROR: Oct 5 in final chartData:', oct5InFinal);
      // Remove them explicitly
      return mapped.filter(d => !d.date.includes('Oct 5'));
    }
    
    console.log('[TrophyChart] Final chartData count:', mapped.length);
    if (mapped.length > 0) {
      console.log('[TrophyChart] First chartData point:', mapped[0]);
      console.log('[TrophyChart] All chartData dates:', mapped.map(d => d.date));
    }
    
    return mapped;
  }, [data, rankedStartTime]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">No trophy history available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <div>
          <h2 className="text-xl font-semibold text-white">Trophy Progression</h2>
          <p className="text-sm text-slate-400">Ranked mode started Oct 6, 2025</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart 
          data={chartData} 
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTrophies" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            type="category"
            allowDataOverflow={false}
            domain={chartData.length > 0 ? [chartData[0].date, chartData[chartData.length - 1].date] : []}
            ticks={chartData.map(d => d.date).filter(tick => !tick.includes('Oct 5'))}
            interval={0}
            tickFormatter={(value) => {
              // Explicitly reject Oct 5
              if (String(value).includes('Oct 5')) {
                return '';
              }
              return value;
            }}
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
          <Area 
            type="monotone" 
            dataKey="rankedTrophies" 
            stroke="#eab308"
            fillOpacity={1}
            fill="url(#colorTrophies)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
