"use client";

import { useEffect, useRef } from 'react';

interface StatsRadarChartProps {
  playerStats: {
    trophies: number;
    donations: number;
    warStars: number;
    capitalContributions: number;
    townHallLevel: number;
    vipScore: number;
  };
  clanAverages: {
    trophies: number;
    donations: number;
    warStars: number;
    capitalContributions: number;
    townHallLevel: number;
    vipScore: number;
  };
  playerName: string;
  size?: number;
  showName?: boolean;
}

/**
 * Normalize a value to 0-100 scale based on comparison to average
 * Returns percentage where 0 = far below average, 50 = at average, 100 = far above average
 */
function normalizeToPercent(value: number, average: number): number {
  if (average === 0) return value > 0 ? 100 : 50;
  // If player is exactly at average, return 50%
  // If player is 2x average, return 100%
  // If player is 0, return 0%
  const ratio = value / average;
  if (ratio >= 2) return 100;
  if (ratio <= 0) return 0;
  // Linear interpolation: 0.5x = 25%, 1x = 50%, 1.5x = 75%, 2x = 100%
  return Math.min(100, Math.max(0, 25 + (ratio - 0.5) * 50));
}

export default function StatsRadarChart({ 
  playerStats, 
  clanAverages,
  playerName, 
  size = 280,
  showName = true
}: StatsRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Normalize player stats to percentage (0-100) where 50 = clan average
    const playerPercentages = {
      trophies: normalizeToPercent(playerStats.trophies, clanAverages.trophies),
      donations: normalizeToPercent(playerStats.donations, clanAverages.donations),
      warStars: normalizeToPercent(playerStats.warStars, clanAverages.warStars),
      capitalContributions: normalizeToPercent(playerStats.capitalContributions, clanAverages.capitalContributions),
      townHallLevel: normalizeToPercent(playerStats.townHallLevel, clanAverages.townHallLevel),
      vipScore: normalizeToPercent(playerStats.vipScore, clanAverages.vipScore),
    };

    // Define dimensions and their positions (6 dimensions like DNA radar)
    const dimensions = [
      { name: 'Trophies', value: playerPercentages.trophies, angle: -Math.PI / 2 },
      { name: 'Donations', value: playerPercentages.donations, angle: -Math.PI / 2 + Math.PI / 3 },
      { name: 'War Stars', value: playerPercentages.warStars, angle: -Math.PI / 2 + 2 * Math.PI / 3 },
      { name: 'Capital', value: playerPercentages.capitalContributions, angle: Math.PI / 2 },
      { name: 'Town Hall', value: playerPercentages.townHallLevel, angle: Math.PI / 2 + Math.PI / 3 },
      { name: 'VIP Score', value: playerPercentages.vipScore, angle: Math.PI / 2 + 2 * Math.PI / 3 }
    ];

    // Dark theme colors
    const gridColor = '#475569'; // slate-600
    const lineColor = '#64748b'; // slate-500
    const playerFillColor = 'rgba(59, 130, 246, 0.15)'; // blue-500 with opacity
    const playerStrokeColor = '#3b82f6'; // blue-500
    const averageLineColor = '#94a3b8'; // slate-400
    const textColor = '#cbd5e1'; // slate-300
    const textColorDim = '#94a3b8'; // slate-400
    const bgColor = '#0f172a'; // slate-900

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Draw grid circles (5 concentric circles)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 5, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw dimension lines
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    dimensions.forEach(({ angle }) => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      );
      ctx.stroke();
    });

    // Draw average line (50% = average)
    ctx.strokeStyle = averageLineColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    dimensions.forEach(({ angle }, index) => {
      const avgRadius = radius * 0.5; // 50% = clan average
      const x = centerX + Math.cos(angle) * avgRadius;
      const y = centerY + Math.sin(angle) * avgRadius;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw player data polygon
    ctx.beginPath();
    dimensions.forEach(({ value, angle }, index) => {
      const x = centerX + Math.cos(angle) * (radius * value / 100);
      const y = centerY + Math.sin(angle) * (radius * value / 100);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // Fill polygon
    ctx.fillStyle = playerFillColor;
    ctx.fill();

    // Stroke polygon
    ctx.strokeStyle = playerStrokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = playerStrokeColor;
    dimensions.forEach(({ value, angle }) => {
      const x = centerX + Math.cos(angle) * (radius * value / 100);
      const y = centerY + Math.sin(angle) * (radius * value / 100);
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw dimension labels
    ctx.fillStyle = textColor;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    dimensions.forEach(({ name, angle }) => {
      const labelRadius = radius + 22;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      ctx.fillText(name, x, y);
    });

    // Draw value labels (percentage vs average)
    ctx.fillStyle = textColorDim;
    ctx.font = '9px Inter, sans-serif';
    dimensions.forEach(({ value, angle }) => {
      const labelRadius = radius + 36;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      const percentDiff = ((value - 50) / 50) * 100; // Convert to % difference from average
      const sign = percentDiff >= 0 ? '+' : '';
      ctx.fillText(`${sign}${percentDiff.toFixed(0)}%`, x, y);
    });

  }, [playerStats, clanAverages, size]);

  return (
    <div className="flex flex-col items-center space-y-2">
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-slate-700 bg-slate-900"
        style={{ width: size, height: size }}
      />
      
      {showName && playerName && (
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-200">{playerName}</p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-slate-300">Player</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 border-t-2 border-dashed border-slate-400"></div>
              <span className="text-slate-400">Clan Avg</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
