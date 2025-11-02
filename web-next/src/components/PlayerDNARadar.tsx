"use client";

import { useEffect, useRef } from 'react';
import { PlayerDNA, PlayerArchetype, getArchetypeInfo } from '@/lib/player-dna';

interface PlayerDNARadarProps {
  dna: PlayerDNA;
  archetype: PlayerArchetype;
  playerName: string;
  size?: number;
  showName?: boolean;
  clanAverageDNA?: PlayerDNA | null;
}

export default function PlayerDNARadar({ 
  dna, 
  archetype, 
  playerName, 
  size = 200,
  showName = true,
  clanAverageDNA = null
}: PlayerDNARadarProps) {
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

    // Define dimensions and their positions
    const dimensions = [
      { name: 'Leadership', value: dna.leadership, angle: -Math.PI / 2 },
      { name: 'Performance', value: dna.performance, angle: -Math.PI / 2 + Math.PI / 3 },
      { name: 'Generosity', value: dna.generosity, angle: -Math.PI / 2 + 2 * Math.PI / 3 },
      { name: 'Social', value: dna.social, angle: Math.PI / 2 },
      { name: 'Specialization', value: dna.specialization, angle: Math.PI / 2 + Math.PI / 3 },
      { name: 'Consistency', value: dna.consistency, angle: Math.PI / 2 + 2 * Math.PI / 3 }
    ];

    // Dark theme colors
    const gridColor = '#475569'; // slate-600
    const lineColor = '#64748b'; // slate-500
    const textColor = '#cbd5e1'; // slate-300
    const textColorDim = '#94a3b8'; // slate-400
    const bgColor = '#0f172a'; // slate-900

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Draw grid circles
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

    // Draw clan average polygon (if provided) - draw first so it's behind player data
    if (clanAverageDNA) {
      const clanDimensions = [
        { name: 'Leadership', value: clanAverageDNA.leadership, angle: -Math.PI / 2 },
        { name: 'Performance', value: clanAverageDNA.performance, angle: -Math.PI / 2 + Math.PI / 3 },
        { name: 'Generosity', value: clanAverageDNA.generosity, angle: -Math.PI / 2 + 2 * Math.PI / 3 },
        { name: 'Social', value: clanAverageDNA.social, angle: Math.PI / 2 },
        { name: 'Specialization', value: clanAverageDNA.specialization, angle: Math.PI / 2 + Math.PI / 3 },
        { name: 'Consistency', value: clanAverageDNA.consistency, angle: Math.PI / 2 + 2 * Math.PI / 3 }
      ];

      ctx.beginPath();
      clanDimensions.forEach(({ value, angle }, index) => {
        const x = centerX + Math.cos(angle) * (radius * value / 100);
        const y = centerY + Math.sin(angle) * (radius * value / 100);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();

      // Stroke clan average with dashed line
      ctx.strokeStyle = '#94a3b8'; // slate-400
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

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

    // Fill polygon with archetype color
    const archetypeInfo = getArchetypeInfo(archetype);
    // Convert hex to rgba with opacity
    const hex = archetypeInfo.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
    ctx.fill();

    // Stroke polygon
    ctx.strokeStyle = archetypeInfo.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = archetypeInfo.color;
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

    // Draw value labels
    ctx.fillStyle = textColorDim;
    ctx.font = '9px Inter, sans-serif';
    dimensions.forEach(({ value, angle }) => {
      const labelRadius = radius + 36;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      ctx.fillText(value.toString(), x, y);
    });

  }, [dna, archetype, size, clanAverageDNA]);

  const archetypeInfo = getArchetypeInfo(archetype);

  return (
    <div className="flex flex-col items-center space-y-2">
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-slate-700 bg-slate-900"
        style={{ width: size, height: size }}
      />
      
      <div className="text-center">
        <div 
          className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white cursor-help"
          style={{ backgroundColor: archetypeInfo.color }}
          title={`${archetype} Player Archetype

${archetypeInfo.description}

Key Strengths:
${archetypeInfo.strengths.map(s => `• ${s}`).join('\n')}

Optimal Roles:
${archetypeInfo.optimalRoles.map(r => `• ${r}`).join('\n')}

This archetype is determined by analyzing the player's DNA scores across six dimensions: Leadership, Performance, Generosity, Social, Specialization, and Consistency.`}
        >
          {archetype}
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          {archetypeInfo.description}
        </p>
        {clanAverageDNA && (
          <div className="flex items-center justify-center gap-3 mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: archetypeInfo.color }}></div>
              <span className="text-slate-300">Player</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 border-t-2 border-dashed border-slate-400"></div>
              <span className="text-slate-400">Clan Avg</span>
            </div>
          </div>
        )}
        {showName && playerName && (
          <p className="text-sm font-semibold text-slate-200 mt-2">{playerName}</p>
        )}
      </div>
    </div>
  );
}
