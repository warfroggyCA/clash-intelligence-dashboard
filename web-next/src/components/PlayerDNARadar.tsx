"use client";

import { useEffect, useRef } from 'react';
import { PlayerDNA, PlayerArchetype, getArchetypeInfo } from '@/lib/player-dna';

interface PlayerDNARadarProps {
  dna: PlayerDNA;
  archetype: PlayerArchetype;
  playerName: string;
  size?: number;
}

export default function PlayerDNARadar({ 
  dna, 
  archetype, 
  playerName, 
  size = 200 
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

    // Draw grid circles
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 5, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw dimension lines
    ctx.strokeStyle = '#d1d5db';
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

    // Draw data polygon
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
    ctx.fillStyle = archetypeInfo.color + '20'; // 20% opacity
    ctx.fill();

    // Stroke polygon
    ctx.strokeStyle = archetypeInfo.color;
    ctx.lineWidth = 2;
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
    ctx.fillStyle = '#374151';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    dimensions.forEach(({ name, angle }) => {
      const labelRadius = radius + 20;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      ctx.fillText(name, x, y);
    });

    // Draw value labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, sans-serif';
    dimensions.forEach(({ value, angle }) => {
      const labelRadius = radius + 35;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      ctx.fillText(value.toString(), x, y);
    });

  }, [dna, archetype, size]);

  const archetypeInfo = getArchetypeInfo(archetype);

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded-lg bg-white"
        style={{ width: size, height: size }}
      />
      
      <div className="text-center">
        <div 
          className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: archetypeInfo.color }}
        >
          {archetype}
        </div>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">
          {archetypeInfo.description}
        </p>
      </div>
    </div>
  );
}
