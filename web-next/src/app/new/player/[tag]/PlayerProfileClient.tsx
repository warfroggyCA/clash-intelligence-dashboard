"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import useSWR, { useSWRConfig } from 'swr';
import Card from '@/components/new-ui/Card';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import HeroIcon from '@/components/new-ui/icons/HeroIcon';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { playerProfileFetcher } from '@/lib/api/swr-fetcher';
import { playerProfileSWRConfig } from '@/lib/api/swr-config';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import { formatNumber } from '@/lib/format';
import type { WarIntelligenceMetrics } from '@/lib/war-intelligence/engine';
import {
  getEquipmentByName,
  getHeroForEquipment,
  heroEquipmentData,
  getPetByName,
  heroPetsData,
  PET_MAX_LEVEL,
  type HeroEquipment,
} from '@/lib/hero-equipment';
import { Button } from '@/components/new-ui/Button';
import { useRosterData } from '../../roster/useRosterData';
import { normalizeTag } from '@/lib/tags';
import { resolveLeague, resolveTownHall } from '../../roster/roster-utils';
import { resolveTrophies as resolveTrophiesSSOT } from '@/lib/roster-derivations';
import { HERO_MAX_LEVELS } from '@/types';
import { rushTone } from '../../roster/roster-utils';
import Link from 'next/link';
import { compareRankedLeagues } from '@/lib/league-tiers';

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD-CLASS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Info tooltip component - elegant hover tooltip for explaining metrics
const InfoTooltip = ({ 
  text, 
  children,
  position = 'top',
  size = 'sm'
}: { 
  text: string; 
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'xs' | 'sm' | 'md';
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  
  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent',
  };
  
  const sizeStyles: Record<string, { wrapper: string; icon: string }> = {
    xs: { wrapper: 'w-3 h-3 text-[8px]', icon: '?' },
    sm: { wrapper: 'w-3.5 h-3.5 text-[9px]', icon: '?' },
    md: { wrapper: 'w-4 h-4 text-[10px]', icon: 'i' },
  };
  
  const sizeStyle = sizeStyles[size];
  
  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <span
          className={`flex items-center justify-center ${sizeStyle.wrapper} rounded-full font-medium cursor-help transition-all hover:opacity-100 opacity-40 hover:scale-110`}
          style={{ 
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.3)'
          }}
        >
          {sizeStyle.icon}
        </span>
      )}
      
      {isVisible && (
        <div 
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div 
            className="relative px-3 py-2 rounded-lg text-xs text-slate-200 min-w-[220px] max-w-[380px] text-left whitespace-normal leading-relaxed"
            style={{ 
              background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)'
            }}
          >
            {text}
            <div 
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Section header with optional info tooltip
const SectionHeader = ({ 
  title, 
  info,
  className = ''
}: { 
  title: string; 
  info?: string;
  className?: string;
}) => (
  <div className={`flex items-center gap-1.5 mb-4 ${className}`}>
    <div className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-medium">{title}</div>
    {info && <InfoTooltip text={info} size="sm" />}
  </div>
);

// Stat definitions for tooltips
const STAT_DEFINITIONS = {
  trophies: "Your ranked ladder trophies. Win attacks to climb the leaderboard and earn better rewards.",
  donated: "Troops donated this season. Higher donations help your clan and show you're an active, supportive member.",
  received: "Troops received from clanmates this season. A healthy balance with donations shows good clan engagement.",
  warStars: "Total stars earned from Clan War attacks across all wars. A measure of your war experience.",
  rushPercent: "Rush % measures how much your base is 'rushed' (upgraded TH before maxing). Lower is better: <10% is excellent, 10-20% is acceptable, >20% needs work.",
  baseQuality: "Base Quality = 100% - Rush%. This shows how well-developed your base is for your Town Hall level. Higher is better.",
  activity: "Activity score based on recent donations, attacks, and clan participation. Higher scores indicate more engaged players.",
  tenure: "Days since you joined this clan. Longer tenure often indicates loyalty and commitment.",
  heroPower: "Combined levels of all your heroes. This is a quick measure of your offensive strength.",
  vipScore: "VIP Score combines activity, donations, war performance, and base quality into a single value. Higher scores indicate more valuable clan members.",
  warAttacks: "Total war attacks used over the last 120 days (including CWL). More attacks means higher participation.",
  averageStars: "Average stars per war attack over the last 120 days (including CWL). Higher values indicate stronger attack efficiency.",
  holdRate: "Defensive hold rate over the last 120 days (including CWL). Higher means your base holds enemies below 3 stars more often.",
  capitalGold: "Total Capital Gold contributed to your clan's Clan Capital. Shows your contribution to clan progression.",
  warPreference: "Your war opt-in status. 'In War' means you're available for Clan War selection.",
};

type WarIntelResponse = {
  success: boolean;
  data?: {
    metrics?: WarIntelligenceMetrics[];
  };
  error?: string;
};

const warIntelFetcher = async (url: string): Promise<WarIntelResponse> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = payload?.error || `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<WarIntelResponse>;
};

// Animated counter that counts up to the target value
const AnimatedCounter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return;
    
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{formatNumber(displayValue)}</>;
};

// Circular progress ring for hero levels
const HeroProgressRing = ({ 
  level, 
  maxLevel, 
  size = 80, 
  strokeWidth = 6,
  hero,
  clanAverage
}: { 
  level: number | null; 
  maxLevel: number | null; 
  size?: number; 
  strokeWidth?: number;
  hero: 'bk' | 'aq' | 'gw' | 'rc' | 'mp';
  clanAverage?: number | null;
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = level && maxLevel ? (level / maxLevel) * 100 : 0;
  const clanProgress = clanAverage && maxLevel ? (clanAverage / maxLevel) * 100 : 0;
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);
  
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;
  const clanStrokeDashoffset = circumference - (clanProgress / 100) * circumference;
  
  const heroColors: Record<string, string> = {
    bk: '#f59e0b', // amber
    aq: '#8b5cf6', // violet
    gw: '#10b981', // emerald
    rc: '#3b82f6', // blue
    mp: '#ec4899', // pink
  };
  
  const color = heroColors[hero] || '#6366f1';
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Clan average indicator (subtle dotted line) */}
        {clanAverage && clanProgress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
            strokeDasharray={`${(clanProgress / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            className="opacity-50"
          />
        )}
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <HeroIcon hero={hero} size="sm" />
        <span className="text-white font-bold text-sm mt-0.5">{level ?? '—'}</span>
      </div>
    </div>
  );
};

// Large trend chart component with drawing animation
const TrendChart = ({ 
  data, 
  label, 
  color = '#10b981',
  height = 120,
  showLabels = true 
}: { 
  data: { value: number; label: string }[]; 
  label: string;
  color?: string;
  height?: number;
  showLabels?: boolean;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Generate stable unique IDs for this chart instance - only once
  const clipPathId = useMemo(() => `clip-${label}-${Math.random().toString(36).substr(2, 9)}`, [label]);
  const animationName = useMemo(() => `reveal-${label}-${Math.random().toString(36).substr(2, 9)}`, [label]);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);
  
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Not enough data for chart
      </div>
    );
  }
  
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 20;
  const chartWidth = 100; // percentage
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
    return { x, y, ...d };
  });
  
  const buildSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    const midPoint = (a: typeof pts[number], b: typeof pts[number]) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const mid = midPoint(prev, curr);
      d += ` Q ${prev.x} ${prev.y} ${mid.x} ${mid.y}`;
    }
    const last = pts[pts.length - 1];
    const secondLast = pts[pts.length - 2];
    d += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;
    return d;
  };

  const pathD = buildSmoothPath(points);
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;
  
  return (
    <div className="relative w-full" style={{ height }}>
      <style>
        {`
          @keyframes ${animationName} {
            from { width: 0; }
            to { width: 100%; }
          }
        `}
      </style>
      <svg 
        viewBox={`0 0 100 ${height}`} 
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {/* Clip path for progressive reveal - synchronized with line */}
          <clipPath id={clipPathId}>
            <rect 
              x="0" 
              y="0" 
              width="0" 
              height={height}
              style={{
                animationName: animationName,
                animationDuration: '1.5s',
                animationTimingFunction: 'ease-out',
                animationFillMode: 'forwards',
                animationDelay: '0.1s'
              }}
            />
          </clipPath>
        </defs>
        {/* Area fill and line - both clipped to reveal together */}
        <g clipPath={`url(#${clipPathId})`}>
          {/* Area fill */}
          <path
            d={areaD}
            fill={`url(#gradient-${label})`}
          />
          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ 
              filter: `drop-shadow(0 0 4px ${color})`
            }}
          />
        </g>
      </svg>
      {/* Labels - Intelligently sampled based on data density */}
      {showLabels && (() => {
        // Determine how many labels to show based on data point count
        const totalPoints = points.length;
        let maxLabels = 7; // Default for short ranges
        
        if (totalPoints > 60) maxLabels = 4;  // 90d range: show ~4 labels
        else if (totalPoints > 25) maxLabels = 5;  // 30d range: show ~5 labels
        else if (totalPoints > 14) maxLabels = 6;  // 2-3 weeks: show ~6 labels
        
        // Calculate interval to evenly distribute labels
        const interval = totalPoints <= maxLabels ? 1 : Math.floor(totalPoints / (maxLabels - 1));
        
        // Generate label indices (always include first and last)
        const labelIndices = new Set<number>();
        labelIndices.add(0); // First
        labelIndices.add(totalPoints - 1); // Last
        
        // Add evenly spaced middle points
        for (let i = interval; i < totalPoints - 1; i += interval) {
          labelIndices.add(i);
        }
        
        return (
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-500 px-1">
            {points.map((p, i) => (
              <span 
                key={i} 
                className="text-center"
                style={{ 
                  width: `${100 / points.length}%`,
                  visibility: labelIndices.has(i) ? 'visible' : 'hidden'
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

const BarTrendChart = ({
  data,
  label,
  color = '#10b981',
  height = 120,
  showLabels = true,
}: {
  data: { value: number; label: string }[];
  label: string;
  color?: string;
  height?: number;
  showLabels?: boolean;
}) => {
  const gradientId = useMemo(
    () => `bar-gradient-${label}-${Math.random().toString(36).slice(2, 9)}`,
    [label],
  );

  if (!data || data.length < 1) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Not enough data for chart
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const padding = 18;
  const topPadding = 28; // Extra padding at top for value labels
  const chartWidth = 100;
  const barSlot = chartWidth / data.length;
  const barWidth = Math.max(4, barSlot * 0.68);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Value labels above bars */}
      <div className="absolute top-0 left-0 right-0 flex justify-between px-1" style={{ height: topPadding }}>
        {data.map((d, i) => (
          <div 
            key={`${label}-value-${i}`} 
            className="flex items-end justify-center text-[11px] font-semibold"
            style={{ 
              width: `${100 / data.length}%`,
              color: color,
            }}
          >
            {d.value.toLocaleString()}
          </div>
        ))}
      </div>
      
      <svg viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        
        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = ((d.value || 0) / max) * (height - padding - topPadding);
          const x = i * barSlot + (barSlot - barWidth) / 2;
          const y = height - padding - barHeight;
          return (
            <rect
              key={`${label}-${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={`url(#${gradientId})`}
              style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
            />
          );
        })}
        
        {/* Connecting line to show trend */}
        <path
          d={data.map((d, i) => {
            const barHeight = ((d.value || 0) / max) * (height - padding - topPadding);
            const x = i * barSlot + barSlot / 2; // Center of each bar
            const y = height - padding - barHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.8"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
        
        {/* Dots at top of each bar */}
        {data.map((d, i) => {
          const barHeight = ((d.value || 0) / max) * (height - padding - topPadding);
          const x = i * barSlot + barSlot / 2;
          const y = height - padding - barHeight;
          return (
            <circle
              key={`${label}-dot-${i}`}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              opacity="0.9"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
          );
        })}
      </svg>
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-500 px-1">
          {data.map((d, i) => (
            <span key={`${label}-label-${i}`} className="text-center" style={{ width: `${100 / data.length}%` }}>
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Stat card with glow effect
const GlowStatCard = ({ 
  label, 
  value, 
  delta, 
  icon, 
  color = 'var(--accent)',
  subtitle,
  comparison,
  info,
  onClick
}: { 
  label: string; 
  value: string | number; 
  delta?: number | null; 
  icon?: string;
  color?: string;
  subtitle?: string;
  comparison?: { label: string; value: number; better: boolean } | null;
  info?: string;
  onClick?: () => void;
}) => {
  return (
    <div 
      className={`relative rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] group ${onClick ? 'cursor-pointer' : ''}`}
      style={{ 
        background: 'linear-gradient(135deg, rgba(30,40,60,0.8) 0%, rgba(20,30,50,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 0 20px ${color}10, inset 0 1px 0 rgba(255,255,255,0.05)`
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Glow effect on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ 
          background: `radial-gradient(circle at 50% 50%, ${color}15 0%, transparent 70%)`
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-medium">{label}</span>
            {info && <InfoTooltip text={info} size="xs" position="bottom" />}
          </div>
          {icon && (
            icon.startsWith('/') ? (
              <div className="relative w-5 h-5">
                <Image 
                  src={icon}
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                  style={{ 
                    filter: 'brightness(1.2) saturate(1.3) drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                  }}
                />
              </div>
            ) : (
              <span 
                className="text-xl"
                style={{ 
                  filter: 'brightness(1.2) saturate(1.3)',
                  textShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                {icon}
              </span>
            )
          )}
        </div>
        
        <div className="flex items-baseline gap-2">
          <span 
            className="text-3xl font-black tracking-tight"
            style={{ color, textShadow: `0 0 20px ${color}40` }}
          >
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </span>
          {typeof delta === 'number' && delta !== 0 && (
            <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
            </span>
          )}
        </div>
        
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
        
        {comparison && (
          <div className="flex items-center gap-1 mt-2 text-[10px]">
            <span className="text-slate-500">vs clan avg:</span>
            <span className={comparison.better ? 'text-emerald-400' : 'text-amber-400'}>
              {comparison.better ? '↑' : '↓'} {Math.abs(comparison.value)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const heroOrder: Array<'bk' | 'aq' | 'gw' | 'rc' | 'mp'> = ['bk', 'aq', 'gw', 'rc', 'mp'];
const heroLabels: Record<typeof heroOrder[number], string> = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
};

type ProfileTab = 'overview' | 'equipment' | 'history';
const TAB_LABELS: Record<ProfileTab, string> = {
  overview: 'Overview',
  equipment: 'Equipment & Pets',
  history: 'History',
};

type HistoryRange = '7d' | '30d' | '90d' | 'all';
const HISTORY_RANGE_OPTIONS: Array<{ value: HistoryRange; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

const isProfileTab = (value: string | null): value is ProfileTab => {
  return value === 'overview' || value === 'equipment' || value === 'history';
};

const parseAssociatedHeroes = (value?: string): Array<typeof heroOrder[number]> => {
  if (!value) return [];
  const parts = value
    .toLowerCase()
    .split(/,|\/| or | and /g)
    .map((p) => p.trim())
    .filter(Boolean);
  const keys = new Set<typeof heroOrder[number]>();
  parts.forEach((p) => {
    if (p.includes('barbarian')) keys.add('bk');
    if (p.includes('king') && !p.includes('minion')) keys.add('bk');
    if (p.includes('archer')) keys.add('aq');
    if (p.includes('queen')) keys.add('aq');
    if (p.includes('warden')) keys.add('gw');
    if (p.includes('champion')) keys.add('rc');
    if (p.includes('rc')) keys.add('rc');
    if (p.includes('minion')) keys.add('mp');
  });
  return Array.from(keys);
};

const heroKeyFromName = (hero: string): typeof heroOrder[number] | null => {
  const lower = hero.toLowerCase();
  if (lower.includes('barbarian')) return 'bk';
  if (lower.includes('archer')) return 'aq';
  if (lower.includes('warden')) return 'gw';
  if (lower.includes('champion')) return 'rc';
  if (lower.includes('minion')) return 'mp';
  return null;
};

const cleanEquipmentName = (value: string) =>
  value
    ?.replace(/\blevel\s*\d+/i, '')
    ?.replace(/\blv\.?\s*\d+/i, '')
    ?.replace(/\d+$/i, '')
    ?.replace(/\s{2,}/g, ' ')
    ?.trim();

const normalizeEquip = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizePet = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const equipmentIconMap: Record<string, string> = {
  // Archer Queen
  archerpuppet: '/assets/equipment/Hero_Equipment_AQ_Archer_Puppet.png',
  frozenarrow: '/assets/equipment/Hero_Equipment_AQ_Frozen_Arrow.png',
  giantarrow: '/assets/equipment/Hero_Equipment_AQ_Giant_Arrow.png',
  healerpuppet: '/assets/equipment/Hero_Equipment_AQ_Healer_Puppet.png',
  invisibilityvial: '/assets/equipment/Hero_Equipment_AQ_Invisibility_Vial.png',
  magicmirror: '/assets/equipment/Hero_Equipment_AQ_Magic_Mirror.png',
  actionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  wweactionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  // Barbarian King
  barbarianpuppet: '/assets/equipment/Hero_Equipment_BK_Barbarian_Puppet.png',
  earthquakeboots: '/assets/equipment/Hero_Equipment_BK_Earthquake_Boots.png',
  ragevial: '/assets/equipment/Hero_Equipment_BK_Rage_Vial.png',
  snakebracelet: '/assets/equipment/Hero_Equipment_BK_SnakeBracelet.png',
  vampstache: '/assets/equipment/Hero_Equipment_BK_Vampstache.png',
  giantgauntlet: '/assets/equipment/Hero_Equipment_BQ_Giant_Gauntlet.png',
  spikyball: '/assets/equipment/Hero_Equipment_BK_Spiky_Ball.png',
  // Grand Warden
  eternaltome: '/assets/equipment/Hero_Equipment_GW_Eternal_Tome.png',
  fireball: '/assets/equipment/Hero_Equipment_GW_Fireball.png',
  healingtome: '/assets/equipment/Hero_Equipment_GW_Healing_Tome.png',
  lifegem: '/assets/equipment/Hero_Equipment_GW_Life_Gem.png',
  ragegem: '/assets/equipment/Hero_Equipment_GW_Rage_Gem.png',
  heroictorch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  torch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  lavaloonpuppet: '/assets/equipment/icon_gear_GW_LavaloonPuppet.png',
  // Royal Champion
  electroboots: '/assets/equipment/Hero_Equipment_RC_ElectroBoots.png',
  hastevial: '/assets/equipment/Hero_Equipment_RC_Haste_Vial.png',
  hogriderdoll: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  hogriderpuppet: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  royalgem: '/assets/equipment/Hero_Equipment_RC_Royal_Gem.png',
  seekingshield: '/assets/equipment/Hero_Equipment_RC_Seeking_Shield.png',
  rocketspear: '/assets/equipment/HeroGear_RoyalChampion_RocketSpear_Equipment_03.png',
  // Minion Prince
  darkcrown: '/assets/equipment/HeroGear_MP_DarkCrown_2k.png',
  darkorb: '/assets/equipment/Hero_Equipment_MP_DarkOrb.png',
  henchman: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmanpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmenpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmen: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  powerpump: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  nobleiron: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  ironpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  metalpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  meteorstaff: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteoritesceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteorsceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  // Misc (extra assets)
  geardarkcrown: '/assets/equipment/HeroGear_MP_DarkCrown_2k.png',
};

const petIconMap: Record<string, string> = {
  lassi: '/assets/pets/Hero_Pet_HV_L.A.S.S.I_1.png',
  electroowl: '/assets/pets/Hero_Pet_HV_Electro_Owl.png',
  mightyyak: '/assets/pets/Hero_Pet_HV_Mighty_Yak_1.png',
  unicorn: '/assets/pets/Hero_Pet_HV_Unicorn_2.png',
  frosty: '/assets/pets/Hero_Pet_HV_Frosty_2.png',
  diggy: '/assets/pets/Hero_Pet_HV_Diggy_2.png',
  poisonlizard: '/assets/pets/Hero_Pet_HV_Poison_Lizard_1.png',
  phoenix: '/assets/pets/Hero_Pet_HV_Phoenix_1_shadow.png',
  spiritfox: '/assets/pets/Hero_Pet_HV_Spirit_Fox.png',
  angryjelly: '/assets/pets/Hero_Pet_HV_Angry_Jelly_05.png',
  sneezy: '/assets/pets/Icon_HV_Hero_Pets_Sneezy.png',
};

const getEquipmentIcon = (name: string): string | undefined => {
  const cleanName = cleanEquipmentName(name) || name;
  const key = normalizeEquip(cleanName);
  if (equipmentIconMap[key]) return equipmentIconMap[key];
  // Heuristic fallbacks
  if (key.includes('henchman') || key.includes('henchmen')) return equipmentIconMap.henchman;
  if (key.includes('hogrider')) return equipmentIconMap.hogriderdoll;
  if (key.includes('ironpant') || key.includes('metalpant')) return equipmentIconMap.ironpants;
  if (key.includes('darkcrown')) return equipmentIconMap.darkcrown;
  if (key.includes('darkorb')) return equipmentIconMap.darkorb;
  if (key.includes('meteor')) return equipmentIconMap.meteorstaff;
  if (key.includes('torch')) return equipmentIconMap.heroictorch;
  return undefined;
};

const getPetIcon = (name: string): string | undefined => {
  const key = normalizePet(name);
  if (petIconMap[key]) return petIconMap[key];
  if (key.includes('lassi')) return petIconMap.lassi;
  return undefined;
};

const classifyEquipmentHero = (name: string): 'King' | 'Queen' | 'Warden' | 'Royal Champion' | 'Minion Prince' | 'Other' => {
  const lower = (cleanEquipmentName(name) || name).toLowerCase();
  if (
    lower.includes('king') ||
    lower.includes('barbarian') ||
    lower.includes('gauntlet') ||
    lower.includes('earthquake') ||
    lower.includes('rage vial') ||
    lower.includes('snake') ||
    lower.includes('vamp')
  ) return 'King';

  if (
    lower.includes('queen') ||
    lower.includes('archer') ||
    lower.includes('arrow') ||
    lower.includes('healer') ||
    lower.includes('mirror') ||
    lower.includes('invisibility')
  ) return 'Queen';

  if (
    lower.includes('warden') ||
    lower.includes('tome') ||
    lower.includes('gem') ||
    lower.includes('life') ||
    lower.includes('lava') ||
    lower.includes('heroic torch') ||
    lower.includes('torch') ||
    lower.includes('fireball')
  ) return 'Warden';

  if (
    lower.includes('champion') ||
    lower.includes('royal') ||
    lower.includes('shield') ||
    lower.includes('spear') ||
    lower.includes('rocket') ||
    lower.includes('hog') ||
    lower.includes('electro') ||
    lower.includes('boot') ||
    lower.includes('haste')
  ) return 'Royal Champion';

  if (
    lower.includes('minion') ||
    lower.includes('henchman') ||
    lower.includes('mp') ||
    lower.includes('iron') ||
    lower.includes('metal') ||
    lower.includes('meteor') ||
    lower.includes('noble') ||
    lower.includes('powerpump') ||
    lower.includes('pump') ||
    lower.includes('dark orb') ||
    lower.includes('darkorb') ||
    lower.includes('dark crown')
  ) return 'Minion Prince';

  return 'Other';
};

const bucketFromHeroName = (hero: string | undefined): 'King' | 'Queen' | 'Warden' | 'Royal Champion' | 'Minion Prince' | 'Other' => {
  if (!hero) return 'Other';
  const lower = hero.toLowerCase();
  if (lower.includes('king')) return 'King';
  if (lower.includes('queen')) return 'Queen';
  if (lower.includes('warden')) return 'Warden';
  if (lower.includes('champion')) return 'Royal Champion';
  if (lower.includes('minion')) return 'Minion Prince';
  return 'Other';
};

const toNumber = (value: any): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const toOptionalNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const resolveTimelineTrophies = (entry: any): number | null => {
  if (!entry) return null;
  return resolveTrophiesSSOT(entry);
};

const Sparkline = ({ points, width = 92, height = 32, stroke = '#34d399', strokeWidth = 1.5 }: { points?: number[]; width?: number; height?: number; stroke?: string; strokeWidth?: number }) => {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="text-current">
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((points[points.length - 1] - min) / range) * height} r={3} fill={stroke} />
    </svg>
  );
};

const skeletonRow = Array.from({ length: 3 }).map((_, idx) => (
  <div key={idx} className="rounded-2xl border p-4 animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
    <div className="h-5 w-2/3 rounded bg-white/5 mb-4" />
    <div className="space-y-2">
      <div className="h-4 w-full rounded bg-white/5" />
      <div className="h-4 w-2/3 rounded bg-white/5" />
    </div>
  </div>
));

export default function PlayerProfileClient({ tag, initialProfile }: { tag: string; initialProfile?: SupabasePlayerProfilePayload | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedTag = normalizeTag(tag) || tag;
  const { cache, mutate } = useSWRConfig();
  const swrKey = `/api/v2/player/${encodeURIComponent(tag)}`;
  const { data, isLoading, error } = useSWR<SupabasePlayerProfilePayload>(swrKey, playerProfileFetcher, {
    ...playerProfileSWRConfig,
    fallbackData: initialProfile || undefined,
  });

  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    const tabParam = searchParams?.get('tab') ?? null;
    return isProfileTab(tabParam) ? tabParam : 'overview';
  });
  const [historyRange, setHistoryRange] = useState<HistoryRange>('7d');
  const [trophyTrendMode, setTrophyTrendMode] = useState<'weekly-max' | 'raw'>('weekly-max');
  useEffect(() => {
    const tabParam = searchParams?.get('tab') ?? null;
    if (isProfileTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [searchParams, activeTab]);

  const setActiveTabWithUrl = useCallback((tabKey: ProfileTab) => {
    setActiveTab(tabKey);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', tabKey);
    const suffix = params.toString();
    router.replace(`/new/player/${encodeURIComponent(normalizedTag)}${suffix ? `?${suffix}` : ''}`, { scroll: false });
  }, [router, normalizedTag, searchParams]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // PLAYER NAVIGATION - Prev/Next through roster
  // ═══════════════════════════════════════════════════════════════════════════════
  const sortedRoster = useMemo(() => {
    // Sort by name alphabetically (same as roster page)
    return [...rosterMembers].sort((a, b) => {
      const nameA = (a.name || a.tag || '').toLowerCase();
      const nameB = (b.name || b.tag || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [rosterMembers]);
  
  const currentPlayerIndex = useMemo(() => {
    const normalizedCurrentTag = normalizeTag(tag) || tag;
    return sortedRoster.findIndex((m) => (normalizeTag(m.tag) || m.tag) === normalizedCurrentTag);
  }, [sortedRoster, tag]);
  
  const prevPlayer = currentPlayerIndex > 0 ? sortedRoster[currentPlayerIndex - 1] : null;
  const nextPlayer = currentPlayerIndex < sortedRoster.length - 1 ? sortedRoster[currentPlayerIndex + 1] : null;
  
  const navigateToPlayer = useCallback((playerTag: string) => {
    const normalizedTag = normalizeTag(playerTag) || playerTag;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (activeTab) {
      params.set('tab', activeTab);
    }
    const suffix = params.toString();
    router.push(`/new/player/${encodeURIComponent(normalizedTag)}${suffix ? `?${suffix}` : ''}`, { scroll: false });
  }, [router, searchParams, activeTab]);

  const buildProfileUrl = useCallback((playerTag: string) => {
    const normalizedTag = normalizeTag(playerTag) || playerTag;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (activeTab) {
      params.set('tab', activeTab);
    }
    const suffix = params.toString();
    return `/new/player/${encodeURIComponent(normalizedTag)}${suffix ? `?${suffix}` : ''}`;
  }, [activeTab, searchParams]);

  useEffect(() => {
    const prefetchPlayer = async (playerTag?: string | null) => {
      if (!playerTag) return;
      const normalized = normalizeTag(playerTag) || playerTag;
      const apiKey = `/api/v2/player/${encodeURIComponent(normalized)}`;
      if (!cache.get(apiKey)) {
        try {
          await mutate(apiKey, playerProfileFetcher(apiKey), { populateCache: true, revalidate: false });
        } catch (err) {
          // Ignore prefetch failures; primary navigation will retry.
        }
      }
      router.prefetch(buildProfileUrl(normalized));
    };

    void prefetchPlayer(prevPlayer?.tag);
    void prefetchPlayer(nextPlayer?.tag);
  }, [prevPlayer, nextPlayer, cache, mutate, router, buildProfileUrl]);
  
  // Keyboard navigation (left/right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft' && prevPlayer) {
        navigateToPlayer(prevPlayer.tag);
      } else if (e.key === 'ArrowRight' && nextPlayer) {
        navigateToPlayer(nextPlayer.tag);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPlayer, nextPlayer, navigateToPlayer]);
  const rosterFallback = useMemo(() => {
    return rosterMembers.find((m) => (normalizeTag(m.tag) || m.tag) === normalizedTag);
  }, [rosterMembers, normalizedTag]);

  const profile = data;
  const summary = useMemo(
    () => (profile as any)?.summary ?? profile ?? rosterFallback ?? {},
    [profile, rosterFallback],
  );
  const timeline = useMemo(() => (profile as any)?.timeline ?? [], [profile]);
  const clanHeroAverages = (profile as any)?.clanHeroAverages ?? {};
  const leadership = (profile as any)?.leadership ?? null;
  const linkedAccounts = (profile as any)?.linkedAccounts ?? leadership?.linkedAccounts ?? [];
  const equipmentLevels = (summary as any)?.equipmentLevels ?? null;
  const pets = (summary as any)?.pets ?? null;
  const isProfileDataLoaded = Boolean((profile as any)?.summary);
  const normalizedPets = useMemo(() => {
    if (!pets || typeof pets !== 'object') return null;
    const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameMap = new Map<string, string>();
    heroPetsData.forEach((pet) => {
      nameMap.set(normalizeKey(pet.name), pet.name);
    });
    const mapped: Record<string, number> = {};
    Object.entries(pets).forEach(([rawName, rawLevel]) => {
      const canonical = getPetByName(rawName)?.name || nameMap.get(normalizeKey(rawName));
      if (!canonical) return;
      const level = toNumber(rawLevel);
      if (Number.isFinite(level)) {
        mapped[canonical] = level;
      }
    });
    return mapped;
  }, [pets]);
  const history = (profile as any)?.history ?? null;
  const tenureFromHistory = useMemo(() => {
    if (!history) return null;
    const base = Number((history as any).totalTenure ?? (history as any).total_tenure ?? 0);
    const currentStint = (history as any).currentStint ?? (history as any).current_stint ?? null;
    let current = 0;
    if (currentStint?.isActive && currentStint.startDate) {
      const start = new Date(currentStint.startDate);
      if (!Number.isNaN(start.getTime())) {
        current = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    return {
      total: Math.max(0, Math.round(base + Math.max(0, current))),
      current: Math.max(0, Math.round(current)),
    };
  }, [history]);
  const aliases = history?.aliases ?? [];
  const vip = (profile as any)?.vip?.current ?? null;
  const vipHistory = useMemo(() => {
    const historyRows = (profile as any)?.vip?.history;
    if (!Array.isArray(historyRows)) return [];
    return historyRows
      .filter((row) => row && row.week_start)
      .map((row) => ({
        weekStart: String(row.week_start),
        score: toNumber(row.vip_score),
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [profile]);
  const vipCurrentScore = useMemo(() => {
    if (typeof vip?.score === 'number' && Number.isFinite(vip.score)) {
      return vip.score;
    }
    if (vipHistory.length) {
      return vipHistory[vipHistory.length - 1].score;
    }
    return null;
  }, [vip, vipHistory]);
  const vipDelta = useMemo(() => {
    if (vipHistory.length < 2) return null;
    const rangeDays = historyRange === '7d' ? 7 : historyRange === '30d' ? 30 : historyRange === '90d' ? 90 : null;
    const toWeekTime = (weekStart: string) => new Date(`${weekStart}T00:00:00Z`).getTime();
    const lastTime = toWeekTime(vipHistory[vipHistory.length - 1].weekStart);
    const cutoff = rangeDays ? lastTime - rangeDays * 24 * 60 * 60 * 1000 : null;
    const filtered = cutoff ? vipHistory.filter((row) => toWeekTime(row.weekStart) >= cutoff) : vipHistory;
    if (filtered.length < 2) return null;
    const last = filtered[filtered.length - 1]?.score ?? 0;
    const first = filtered[0]?.score ?? 0;
    return last - first;
  }, [vipHistory, historyRange]);
  const vipTrendData = useMemo(() => {
    const rangeDays = historyRange === '7d' ? 7 : historyRange === '30d' ? 30 : historyRange === '90d' ? 90 : null;
    const toWeekTime = (weekStart: string) => new Date(`${weekStart}T00:00:00Z`).getTime();
    const lastTime = vipHistory.length ? toWeekTime(vipHistory[vipHistory.length - 1].weekStart) : 0;
    const cutoff = rangeDays ? lastTime - rangeDays * 24 * 60 * 60 * 1000 : null;
    const filtered = cutoff ? vipHistory.filter((row) => toWeekTime(row.weekStart) >= cutoff) : vipHistory;
    return filtered.map((row) => ({
      value: row.score,
      label: new Date(`${row.weekStart}T00:00:00Z`).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [vipHistory, historyRange]);
  const aliasTimeline = useMemo(() => {
    const normalized = aliases
      .map((alias: any) => {
        if (typeof alias === 'string') {
          return { name: alias, firstSeen: null, lastSeen: null };
        }
        return {
          name: alias?.name ?? 'Unknown',
          firstSeen: alias?.firstSeen ?? null,
          lastSeen: alias?.lastSeen ?? null,
        };
      })
      .filter((entry) => entry.name && entry.name !== 'Unknown');

    const toTime = (value: string | null) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sorted = normalized.slice().sort((a, b) => toTime(a.firstSeen ?? a.lastSeen) - toTime(b.firstSeen ?? b.lastSeen));
    const changes: Array<{ from: string; to: string; date: string | null }> = [];

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.name.toLowerCase() !== curr.name.toLowerCase()) {
        changes.push({
          from: prev.name,
          to: curr.name,
          date: curr.firstSeen ?? curr.lastSeen ?? null,
        });
      }
    }

    return { sorted, changes };
  }, [aliases]);

  const heroLevels = useMemo(() => {
    const levels: Record<string, number | null | undefined> = {};
    const srcLevels = (summary as any)?.heroLevels ?? (summary as any)?.hero_levels ?? {};
    heroOrder.forEach((key) => {
      levels[key] = srcLevels[key] ?? (summary as any)?.[key] ?? (rosterFallback as any)?.[key] ?? null;
    });
    return levels;
  }, [summary, rosterFallback]);

  const resolvedPlayerTag = normalizeTag((summary as any)?.tag ?? (rosterFallback as any)?.tag ?? tag) || normalizedTag;
  const townHall = summary.townHallLevel ?? (summary as any).th ?? resolveTownHall(rosterFallback as any) ?? null;
  const heroPowerTotal = summary?.heroPower ?? rosterFallback?.heroPower ?? null;
  const leagueFromProfile =
    (summary as any)?.rankedLeagueName ??
    (summary as any)?.ranked_league_name ??
    (summary as any)?.rankedLeague?.name ??
    (summary as any)?.league?.name ??
    summary?.leagueName ??
    null;
  const leagueSource = rosterFallback ?? ({
    rankedLeagueName: leagueFromProfile,
    rankedLeague: (summary as any)?.rankedLeague ?? null,
    rankedModifier: (summary as any)?.rankedModifier ?? (summary as any)?.league?.modifier ?? null,
    leagueName: summary?.leagueName ?? null,
  } as any);
  const { league: leagueName, tier: leagueTier } = resolveLeague(leagueSource);
  const role = (summary?.role as any)?.toString().toLowerCase() || (rosterFallback?.role as any)?.toString().toLowerCase() || 'member';
  const displayName = summary?.name || rosterFallback?.name || (rosterLoading ? 'Loading name…' : 'Name unavailable');
  const clanName = (summary as any)?.clanName ?? (summary as any)?.clan?.name ?? (rosterFallback as any)?.clanName ?? (rosterFallback as any)?.meta?.clanName ?? null;
  const clanTag = (summary as any)?.clanTag ?? (summary as any)?.clan?.tag ?? (rosterFallback as any)?.clanTag ?? null;
  const normalizedClanTag = normalizeTag(clanTag || '') || clanTag || '';
  const warIntelKey = normalizedClanTag
    ? `/api/war-intelligence?clanTag=${encodeURIComponent(normalizedClanTag)}&playerTag=${encodeURIComponent(resolvedPlayerTag)}&daysBack=120&minWars=1`
    : null;
  const { data: warIntelData, error: warIntelError } = useSWR<WarIntelResponse>(warIntelKey, warIntelFetcher, {
    revalidateOnFocus: false,
  });
  const rushPercent = (summary as any)?.rushPercent ?? (rosterFallback as any)?.rushPercent ?? null;
  const activityScore = (summary as any)?.activity?.score ?? (summary as any)?.activityScore ?? (rosterFallback as any)?.activityScore ?? null;
  const tenureDays = useMemo(() => {
    const candidates = [
      tenureFromHistory?.total,
      (summary as any)?.tenure_days,
      (summary as any)?.tenureDays,
      (rosterFallback as any)?.tenure_days,
    ]
      .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
      .filter((value): value is number => value !== null);
    if (!candidates.length) return null;
    return Math.max(...candidates);
  }, [tenureFromHistory, summary, rosterFallback]);
  const snapshotDate = (summary as any)?.lastSeen ?? (timeline?.length ? timeline[timeline.length - 1]?.snapshotDate ?? null : null);
  const snapshotFreshness = snapshotDate ? new Date(snapshotDate) : null;
  const snapshotText = snapshotFreshness ? `Snapshot ${snapshotFreshness.toISOString().slice(0, 10)}` : null;
  const warPreference = (summary as any)?.war?.preference ?? null;
  const builderBase = (summary as any)?.builderBase ?? {};
  const capitalContrib = (summary as any)?.capitalContributions ?? null;
  const achievements = (summary as any)?.achievements ?? {};
  const expLevel = (summary as any)?.expLevel ?? null;
  const joinStatus = history?.currentStint?.isActive ? 'Active' : history?.currentStint ? 'Inactive' : null;
  const joinStart = history?.currentStint?.startDate ?? null;
  const movements = history?.movements ?? [];

  const historyRangeDays = useMemo(() => {
    if (historyRange === '7d') return 7;
    if (historyRange === '30d') return 30;
    if (historyRange === '90d') return 90;
    return null;
  }, [historyRange]);
  const historyRangeLabel = useMemo(() => {
    if (historyRange === 'all') return 'all time';
    return `last ${historyRangeDays ?? 7}d`;
  }, [historyRange, historyRangeDays]);
  const toSnapshotTime = (entry: any) => {
    const raw = entry?.snapshotDate ?? entry?.snapshot_date ?? entry?.timestamp ?? entry?.date ?? null;
    const parsed = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const lastSnapshotTime = useMemo(
    () => (timeline?.length ? toSnapshotTime(timeline[timeline.length - 1]) : 0),
    [timeline],
  );
  const historyTimeline = useMemo(() => {
    if (!timeline?.length) return [];
    if (historyRange === 'all') return timeline;
    const days = historyRangeDays ?? 7;
    const cutoff = (lastSnapshotTime || Date.now()) - days * 24 * 60 * 60 * 1000;
    return timeline.filter((entry) => toSnapshotTime(entry) >= cutoff);
  }, [timeline, historyRange, historyRangeDays, lastSnapshotTime]);
  const sortedHistoryTimeline = useMemo(() => {
    return historyTimeline.slice().sort((a, b) => toSnapshotTime(a) - toSnapshotTime(b));
  }, [historyTimeline]);
  const historyDeltaTrophies = useMemo(() => {
    if (sortedHistoryTimeline.length < 2) return null;
    const first = sortedHistoryTimeline[0];
    const last = sortedHistoryTimeline[sortedHistoryTimeline.length - 1];
    const firstValue = resolveTimelineTrophies(first);
    const lastValue = resolveTimelineTrophies(last);
    if (firstValue == null || lastValue == null) return null;
    return lastValue - firstValue;
  }, [sortedHistoryTimeline]);
  const trophyTrendRawData = useMemo(() => {
    return sortedHistoryTimeline
      .map((e: any) => {
        const rawDate = e.snapshotDate ?? e.snapshot_date ?? e.timestamp ?? e.date ?? null;
        const value = resolveTimelineTrophies(e);
        if (value == null) return null;
        return {
          value,
          label: rawDate
            ? new Date(rawDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : '',
        };
      })
      .filter((entry): entry is { value: number; label: string } => Boolean(entry));
  }, [sortedHistoryTimeline]);
  const trophyTrendWeeklyData = useMemo(() => {
    if (!sortedHistoryTimeline.length) return [];
    const buckets = new Map<string, number>();
    sortedHistoryTimeline.forEach((entry: any) => {
      const rawDate = entry.snapshotDate ?? entry.snapshot_date ?? entry.timestamp ?? entry.date ?? null;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const utcDay = date.getUTCDay();
      const diff = utcDay === 0 ? -6 : 1 - utcDay;
      const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
      const key = weekStart.toISOString().slice(0, 10);
      const value = resolveTimelineTrophies(entry);
      if (value == null) return;
      const prev = buckets.get(key);
      if (prev == null || value > prev) {
        buckets.set(key, value);
      }
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, value]) => ({
        value,
        label: new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en', {
          month: 'short',
          day: 'numeric',
        }),
      }));
  }, [sortedHistoryTimeline]);
  const trophyTrendData = trophyTrendMode === 'weekly-max' ? trophyTrendWeeklyData : trophyTrendRawData;

  const resolveHistoryDate = (entry: any) =>
    entry?.snapshotDate ?? entry?.snapshot_date ?? entry?.timestamp ?? entry?.date ?? null;
  const resolveHistoryLeague = (entry: any) =>
    entry?.rankedLeagueName ?? entry?.leagueName ?? null;

  const leagueHistoryChanges = useMemo(() => {
    if (!sortedHistoryTimeline.length) return [];
    const changes: Array<{ date: string | null; from: string | null; to: string }> = [];
    let lastLeague: string | null = null;
    sortedHistoryTimeline.forEach((entry: any) => {
      const league = resolveHistoryLeague(entry);
      if (!league) return;
      if (league !== lastLeague) {
        changes.push({ date: resolveHistoryDate(entry), from: lastLeague, to: league });
        lastLeague = league;
      }
    });
    return changes;
  }, [sortedHistoryTimeline]);

  const weeklyLeagueHistory = useMemo(() => {
    if (!sortedHistoryTimeline.length) return [];
    const buckets = new Map<string, { weekStart: string; date: string | null; league: string }>();
    sortedHistoryTimeline.forEach((entry: any) => {
      const rawDate = resolveHistoryDate(entry);
      const league = resolveHistoryLeague(entry);
      if (!rawDate || !league) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const utcDay = date.getUTCDay();
      const diff = utcDay === 0 ? -6 : 1 - utcDay;
      const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
      const key = weekStart.toISOString().slice(0, 10);
      buckets.set(key, { weekStart: key, date: rawDate, league });
    });
    return Array.from(buckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [sortedHistoryTimeline]);

  const recentTimeline = useMemo(() => (timeline?.length ? timeline.slice(Math.max(0, timeline.length - 7)) : []), [timeline]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showUnownedEquipment, setShowUnownedEquipment] = useState(true);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingStat, setRankingStat] = useState<'trophies' | 'donated' | 'received' | 'warStars' | 'rushPercent' | 'activity' | 'heroPower'>('trophies');
  const [leagueCopied, setLeagueCopied] = useState<null | 'weekly' | 'changes'>(null);

  const handleCopyLeagueHistory = useCallback(async (mode: 'weekly' | 'changes') => {
    const payload =
      mode === 'weekly'
        ? [
            'week_start,league',
            ...weeklyLeagueHistory.map((row) => `${row.weekStart},${row.league}`),
          ].join('\n')
        : [
            'date,league',
            ...leagueHistoryChanges.map((row) => `${row.date ?? ''},${row.league}`),
          ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      setLeagueCopied(mode);
      setTimeout(() => setLeagueCopied(null), 2000);
    } catch (error) {
      console.warn('Failed to copy league history', error);
    }
  }, [leagueHistoryChanges, weeklyLeagueHistory]);

  useEffect(() => {
    if (rankingOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [rankingOpen]);

  const deltas = useMemo(() => {
    if (!timeline || timeline.length < 2) return null;
    const latest = timeline[timeline.length - 1];
    const prev = timeline[timeline.length - 2];
    const diff = (current: number | null, previous: number | null) => {
      if (current == null || previous == null) return null;
      return current - previous;
    };
    return {
      trophies: diff(resolveTimelineTrophies(latest), resolveTimelineTrophies(prev)),
      donations: diff(toOptionalNumber(latest.donations), toOptionalNumber(prev.donations)),
      donationsReceived: diff(toOptionalNumber(latest.donationsReceived), toOptionalNumber(prev.donationsReceived)),
      warStars: diff(toOptionalNumber(latest.warStars), toOptionalNumber(prev.warStars)),
    };
  }, [timeline]);

  const trendSeries = useMemo(() => {
    const getSeries = (key: string) => recentTimeline.map((entry: any) => toOptionalNumber((entry as any)[key]));
    return {
      trophies: recentTimeline.map((entry: any) => resolveTimelineTrophies(entry)),
      donations: getSeries('donations'),
      received: getSeries('donationsReceived'),
      warStars: getSeries('warStars'),
    };
  }, [recentTimeline]);

const groupedEquipment = useMemo(() => {
  const heroBuckets: Record<string, { name: string; level: number | null; canonical?: HeroEquipment; displayName: string; maxLevel?: number; owned: boolean }[]> = {
    King: [],
      Queen: [],
      Warden: [],
      'Royal Champion': [],
      'Minion Prince': [],
      Other: [],
    };
    const levelMap: Record<string, number> = {};
    if (equipmentLevels && typeof equipmentLevels === 'object') {
      Object.entries(equipmentLevels).forEach(([rawName, rawLevel]) => {
        const cleaned = cleanEquipmentName(rawName) || rawName;
        levelMap[normalizeEquip(cleaned)] = toNumber(rawLevel);
      });
    }

    // Add canonical equipment for each hero, mark owned if present in payload
    heroEquipmentData.forEach((heroSet) => {
      heroSet.equipment.forEach((eq) => {
        const norm = normalizeEquip(eq.name);
        const level = levelMap[norm] ?? null;
        const item = {
          name: eq.name,
          level,
          canonical: eq,
          displayName: eq.name,
          maxLevel: eq.maxLevel,
          owned: level !== null && Number.isFinite(level),
        };
        const bucket = bucketFromHeroName(heroSet.hero);
        heroBuckets[bucket].push(item);
        delete levelMap[norm]; // consumed
      });
    });

    // Any remaining payload equipment not in canonical list
    Object.entries(levelMap).forEach(([normName, level]) => {
      const cleaned = normName;
      const canonical = getEquipmentByName(cleaned);
      const displayName = canonical?.name || cleaned;
      const maxLevel = canonical?.maxLevel;
      const item = { name: cleaned, level, canonical, displayName, maxLevel, owned: true };
      const heroFromDoc = bucketFromHeroName(getHeroForEquipment(cleaned));
      const bucket = heroFromDoc !== 'Other' ? heroFromDoc : classifyEquipmentHero(cleaned);
      heroBuckets[bucket].push(item);
    });

  return heroBuckets;
}, [equipmentLevels]);

  const trophies =
    summary?.trophies ??
    rosterFallback?.resolvedTrophies ??
    rosterFallback?.trophies ??
    null;
  const donated = summary?.donations?.given ?? rosterFallback?.donations ?? null;
  const received = summary?.donations?.received ?? rosterFallback?.donationsReceived ?? null;
  const warStarsValue = summary?.war?.stars ?? (rosterFallback as any)?.warStars ?? null;
  const warIntelMetrics = warIntelData?.data?.metrics?.[0];
  const warIntelReady = !!warIntelMetrics;
  const warAttacksUsed = warIntelMetrics?.totalAttacks ?? null;
  const avgStarsPerAttack = warIntelMetrics?.averageStarsPerAttack ?? null;
  const holdRate = warIntelMetrics?.defensiveHoldRate ?? null;
  const warIntelUnavailable = !warIntelReady && !!warIntelError;
  const formatMetric = (value: number | null | undefined, options?: { decimals?: number; suffix?: string }) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const formatted = options?.decimals !== undefined ? value.toFixed(options.decimals) : formatNumber(value);
    return `${formatted}${options?.suffix ?? ''}`;
  };
  const rushToneColor = rushPercent != null ? rushTone(rushPercent) : '#64748b';
  const rushQualityArc = rushPercent != null ? ((100 - rushPercent) / 100) * 235.6 : 0;

  const rankingConfig = useMemo(() => ({
    trophies: {
      label: 'Trophies',
      description: 'Ranked trophies compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toOptionalNumber(m.resolvedTrophies ?? m.trophies ?? m.rankedTrophies ?? null),
      format: (v: number) => formatNumber(v),
    },
    donated: {
      label: 'Donated',
      description: 'Season donations compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toOptionalNumber(m.donations ?? m?.donations?.given ?? null),
      format: (v: number) => formatNumber(v),
    },
    received: {
      label: 'Received',
      description: 'Season received troops compared to your current clan.',
      higherBetter: false,
      value: (m: any) => toOptionalNumber(m.donationsReceived ?? m?.donations?.received ?? null),
      format: (v: number) => formatNumber(v),
    },
    warStars: {
      label: 'War Stars',
      description: 'Total war stars compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toOptionalNumber(m.warStars ?? m?.war?.stars ?? null),
      format: (v: number) => formatNumber(v),
    },
    rushPercent: {
      label: 'Rush %',
      description: 'Rush percentage compared to your clan (lower is better).',
      higherBetter: false,
      value: (m: any) => toOptionalNumber(m.rushPercent ?? m?.rush_percent ?? null),
      format: (v: number) => `${v.toFixed(1)}%`,
    },
    activity: {
      label: 'Activity',
      description: 'Activity score compared to your clan.',
      higherBetter: true,
      value: (m: any) => toOptionalNumber(m.activityScore ?? m?.activity?.score ?? null),
      format: (v: number) => formatNumber(Math.round(v)),
    },
    heroPower: {
      label: 'Hero Power',
      description: 'Total hero levels compared to your clan.',
      higherBetter: true,
      value: (m: any) => toOptionalNumber(m.heroPower ?? null),
      format: (v: number) => formatNumber(v),
    },
  }), []);

  const rankingData = useMemo(() => {
    const config = rankingConfig[rankingStat];
    if (!config) return { entries: [], me: null, total: 0 };
    const baseEntries = rosterMembers
      .map((member: any) => ({
        tag: normalizeTag(member.tag) || member.tag,
        name: member.name || member.tag,
        value: config.value(member),
      }))
      .filter((entry) => entry.value != null);
    const currentTag = normalizeTag(tag) || tag;
    const hasMe = baseEntries.some((entry) => entry.tag === currentTag);
    if (!hasMe) {
      const meValue = config.value(summary);
      if (meValue != null) {
        baseEntries.push({
          tag: currentTag,
          name: displayName || currentTag,
          value: meValue,
        });
      }
    }
    const sorted = [...baseEntries].sort((a, b) => {
      if (config.higherBetter) return b.value - a.value;
      return a.value - b.value;
    });
    const total = sorted.length;
    const meIndex = sorted.findIndex((entry) => entry.tag === currentTag);
    return { entries: sorted, me: meIndex >= 0 ? meIndex + 1 : null, total };
  }, [rankingConfig, rankingStat, rosterMembers, tag, displayName, summary]);

  const openRanking = (stat: 'trophies' | 'donated' | 'received' | 'warStars' | 'rushPercent' | 'activity' | 'heroPower') => {
    setRankingStat(stat);
    setRankingOpen(true);
  };
  const activeRanking = rankingConfig[rankingStat];
  const meRank = rankingData.me;
  const totalRanked = rankingData.total;
  const percentile =
    meRank && totalRanked > 1
      ? Math.round(((totalRanked - meRank) / (totalRanked - 1)) * 100)
      : null;
  const sortedHeroEquipmentList = useMemo(() => {
    const order: Record<string, number> = { bk: 0, aq: 1, gw: 2, rc: 3, mp: 4 };
    return [...heroEquipmentData].sort((a, b) => {
      const ka = order[heroKeyFromName(a.hero) || 'zz'] ?? 99;
      const kb = order[heroKeyFromName(b.hero) || 'zz'] ?? 99;
      return ka - kb;
    });
  }, []);

  if (isLoading && !profile && !rosterFallback) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-white/5 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skeletonRow}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && !profile && (
        <div className="rounded-2xl border p-4 text-sm text-amber-200" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
          Failed to load player profile from API. Showing roster fallback if available.
        </div>
      )}
      {!profile && !rosterFallback && (
        <div className="rounded-2xl border p-6 text-sm text-slate-200" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
          No player data available.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          WORLD-CLASS HERO HEADER - The kind people talk about
      ═══════════════════════════════════════════════════════════════════════ */}
      <div 
        className="relative rounded-3xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        {/* Animated gradient overlay */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(59,130,246,0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139,92,246,0.12) 0%, transparent 50%),
              radial-gradient(ellipse 40% 30% at 50% 80%, rgba(16,185,129,0.08) 0%, transparent 50%)
            `,
            animation: 'pulse 8s ease-in-out infinite'
          }}
        />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="relative p-8">
          {/* Top section: Identity + Navigation */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <RoleIcon role={role as any} size={32} className="shrink-0" />
                <h1 
                  className="min-w-0 break-words text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight"
                  style={{ 
                    fontFamily: 'var(--font-display)', 
                    textShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.1)'
                  }}
                >
                  {displayName}
                </h1>
              </div>

              {sortedRoster.length > 1 ? (
                <div className="flex items-center rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={() => prevPlayer && navigateToPlayer(prevPlayer.tag)}
                    disabled={!prevPlayer}
                    className={`px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                      prevPlayer 
                        ? 'text-white hover:bg-white/10 hover:text-amber-300' 
                        : 'text-slate-600 cursor-not-allowed'
                    }`}
                    title={prevPlayer ? `Previous: ${prevPlayer.name || prevPlayer.tag}` : 'No previous player'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="h-6 w-px bg-white/10" />

                  <div className="px-3 py-2 text-xs text-slate-400 font-medium tabular-nums">
                    {currentPlayerIndex + 1} / {sortedRoster.length}
                  </div>

                  <div className="h-6 w-px bg-white/10" />

                  <button
                    onClick={() => nextPlayer && navigateToPlayer(nextPlayer.tag)}
                    disabled={!nextPlayer}
                    className={`px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                      nextPlayer 
                        ? 'text-white hover:bg-white/10 hover:text-amber-300' 
                        : 'text-slate-600 cursor-not-allowed'
                    }`}
                    title={nextPlayer ? `Next: ${nextPlayer.name || nextPlayer.tag}` : 'No next player'}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5 min-w-0">
                {/* Town Hall with glow */}
                <div className="relative group">
                  <div 
                    className="absolute inset-0 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"
                    style={{ background: 'var(--accent)' }}
                  />
                  <div className="relative">
                    <TownHallIcon level={townHall ?? undefined} size="lg" />
                    <div 
                      className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full text-xs font-black text-white"
                      style={{ 
                        background: 'linear-gradient(135deg, var(--accent) 0%, #f59e0b 100%)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4), 0 0 20px var(--accent)'
                      }}
                    >
                    {townHall ?? '?'}
                  </div>
                </div>
              </div>

              <LeagueIcon league={leagueName ?? undefined} ranked size="sm" badgeText={leagueTier ?? undefined} showBadge className="shrink-0" />

              <div className="flex flex-wrap items-center gap-3 text-sm">
                  <code className="text-slate-400 bg-black/30 px-2 py-0.5 rounded font-mono text-xs">
                    {summary?.tag || rosterFallback?.tag || tag}
                  </code>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300 font-medium">{clanName || 'Unknown clan'}</span>
                  {tenureDays != null && (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-400 text-xs font-medium">{tenureDays}d tenure</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* VIP Score Badge */}
                {vip && (
                  <div 
                    className="relative group cursor-help"
                    title={`VIP Score: ${vip.score?.toFixed(1) || '—'}`}
                  >
                    <div 
                      className="absolute inset-0 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}
                    />
                    <div 
                      className="relative px-5 py-3 rounded-2xl"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(239,68,68,0.2) 100%)',
                        border: '1px solid rgba(245,158,11,0.3)'
                      }}
                    >
                      <div className="text-[10px] text-amber-300/70 uppercase tracking-widest mb-0.5 text-center">VIP Score</div>
                      <div className="text-3xl font-black text-amber-400 text-center" style={{ textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>
                        {vip.score?.toFixed(0) || '—'}
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  tone="ghost"
                  onClick={() => setActionsOpen((v) => !v)}
                  title="Leadership actions"
                  className="text-sm backdrop-blur-sm"
                >
                  Leadership
                </Button>
              </div>
            </div>
          </div>

          {/* Hero Power Section - Visual centerpiece */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-10">
              {heroOrder.map((heroKey) => {
                const level = heroLevels[heroKey] as number | null;
                const thCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                const maxLevel = (thCaps as any)[heroKey] ?? null;
                const clanAvg = clanHeroAverages?.[heroKey] ?? null;
                
                // Skip heroes not available at this TH level
                // (maxLevel being null/0 means the hero doesn't unlock until a higher TH)
                if (!maxLevel) return null;
                
                return (
                  <div key={heroKey} className="flex flex-col items-center group">
                    <HeroProgressRing 
                      level={level} 
                      maxLevel={maxLevel} 
                      hero={heroKey}
                      clanAverage={clanAvg}
                      size={90}
                      strokeWidth={6}
                    />
                    <div className="mt-2 text-center">
                      <div className="text-xs text-slate-400">{heroLabels[heroKey].split(' ').pop()}</div>
                      {clanAvg && level && (
                        <div className={`text-[10px] ${level >= clanAvg ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {level >= clanAvg ? '↑' : '↓'} vs clan
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Total Hero Power */}
              <div
                className="flex flex-col items-center px-6 border-l border-white/10 cursor-pointer"
                onClick={() => openRanking('heroPower')}
                role="button"
                tabIndex={0}
                title="View hero power ranking"
              >
                <div className="text-5xl font-black text-white mb-1" style={{ textShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
                  {heroPowerTotal != null ? <AnimatedCounter value={heroPowerTotal} /> : '—'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Total Power</div>
              </div>
            </div>
          </div>

          {/* Key Stats Grid - Premium stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <GlowStatCard 
              label="Trophies" 
              value={trophies ?? '—'} 
              delta={deltas?.trophies}
              icon="/assets/clash/trophy.png"
              color="#f59e0b"
              info={STAT_DEFINITIONS.trophies}
              onClick={() => openRanking('trophies')}
            />
            <GlowStatCard 
              label="Donated" 
              value={donated ?? '—'} 
              delta={deltas?.donations}
              icon="📤"
              color="#10b981"
              info={STAT_DEFINITIONS.donated}
              onClick={() => openRanking('donated')}
            />
            <GlowStatCard 
              label="Received" 
              value={received ?? '—'} 
              delta={deltas?.donationsReceived}
              icon="📥"
              color="#6366f1"
              info={STAT_DEFINITIONS.received}
              onClick={() => openRanking('received')}
            />
            <GlowStatCard 
              label="War Stars" 
              value={warStarsValue ?? '—'}
              icon="⭐"
              color="#eab308"
              info={STAT_DEFINITIONS.warStars}
              onClick={() => openRanking('warStars')}
            />
            <GlowStatCard 
              label="Rush %" 
              value={rushPercent != null ? `${rushPercent.toFixed(1)}%` : '—'}
              icon="🏃"
              color={rushPercent != null ? rushTone(rushPercent) : '#94a3b8'}
              info={STAT_DEFINITIONS.rushPercent}
              onClick={() => openRanking('rushPercent')}
            />
            <GlowStatCard 
              label="Activity" 
              value={activityScore != null ? Math.round(activityScore) : '—'}
              icon="📈"
              color="#8b5cf6"
              info={STAT_DEFINITIONS.activity}
              onClick={() => openRanking('activity')}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB NAVIGATION
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {(Object.keys(TAB_LABELS) as ProfileTab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setActiveTabWithUrl(tabKey)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
              activeTab === tabKey
                ? 'text-white border-[var(--accent)]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-slate-500 pr-2">
          {snapshotText || 'No snapshot'}
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB CONTENT PANELS - World Class
      ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* OVERVIEW TAB - Premium Design */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Large Trend Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Trophy Trend */}
            <div 
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Trophy Progression</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">
                      {trophies != null ? <AnimatedCounter value={trophies} /> : '—'}
                    </span>
                    {deltas?.trophies != null && deltas.trophies !== 0 && (
                      <span className={`text-lg font-bold ${deltas.trophies > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {deltas.trophies > 0 ? '↑' : '↓'} {Math.abs(deltas.trophies)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <TrendChart 
                data={recentTimeline
                  .map((e: any) => {
                    const value = resolveTimelineTrophies(e);
                    if (value == null) return null;
                    return {
                      value,
                      label: new Date(e.snapshotDate).toLocaleDateString('en', { weekday: 'short' }),
                    };
                  })
                  .filter((entry): entry is { value: number; label: string } => Boolean(entry))}
                label="trophies"
                color="#f59e0b"
                height={100}
              />
            </div>

            {/* Donation Trend */}
            <div 
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Donation Activity</div>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <span className="text-3xl font-black text-emerald-400">
                        {donated != null ? <AnimatedCounter value={donated} /> : '—'}
                      </span>
                      <span className="text-slate-500 text-sm ml-1">given</span>
                    </div>
                    <div className="text-slate-600">|</div>
                    <div>
                      <span className="text-2xl font-bold text-indigo-400">
                        {received != null ? <AnimatedCounter value={received} /> : '—'}
                      </span>
                      <span className="text-slate-500 text-sm ml-1">received</span>
                    </div>
                  </div>
                </div>
              </div>
              <TrendChart 
                data={recentTimeline
                  .map((e: any) => {
                    const value = toOptionalNumber(e.donations);
                    if (value == null) return null;
                    return {
                      value,
                      label: new Date(e.snapshotDate).toLocaleDateString('en', { weekday: 'short' }),
                    };
                  })
                  .filter((entry): entry is { value: number; label: string } => Boolean(entry))}
                label="donations"
                color="#10b981"
                height={100}
              />
            </div>
          </div>

          {/* War Performance + Base Quality Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* War Stats */}
            <div 
              className="rounded-2xl p-6"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <SectionHeader title="War Performance" info="War efficiency and defensive impact from recent clan wars." />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    War Stars
                    <InfoTooltip text={STAT_DEFINITIONS.warStars} size="xs" position="top" />
                  </span>
                  <span className="text-2xl font-bold text-amber-400">
                    {warStarsValue != null ? formatNumber(warStarsValue) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    Attacks Used
                    <InfoTooltip text={STAT_DEFINITIONS.warAttacks} size="xs" position="top" />
                  </span>
                  <span className="text-xl font-semibold text-white">{formatMetric(warAttacksUsed)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    Avg Stars
                    <InfoTooltip text={STAT_DEFINITIONS.averageStars} size="xs" position="top" />
                  </span>
                  <span className="text-xl font-semibold text-white">{formatMetric(avgStarsPerAttack, { decimals: 2 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    Hold Rate
                    <InfoTooltip text={STAT_DEFINITIONS.holdRate} size="xs" position="top" />
                  </span>
                  <span className="text-xl font-semibold text-white">{formatMetric(holdRate, { decimals: 0, suffix: '%' })}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-slate-400">Preference</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${warPreference === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {warPreference === 'in' ? '✓ In War' : 'Opted Out'}
                  </span>
                </div>
                {warIntelUnavailable ? (
                  <div className="text-[11px] text-slate-500">War analytics unavailable without leadership access.</div>
                ) : !warIntelReady ? (
                  <div className="text-[11px] text-slate-500">No war data found in the last 120 days.</div>
                ) : null}
              </div>
            </div>

            {/* Base Quality Gauge */}
            <div 
              className="rounded-2xl p-6 flex flex-col items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <SectionHeader title="Base Quality" info={STAT_DEFINITIONS.baseQuality} />
              <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  {/* Background arc */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="10"
                    strokeDasharray="235.6 78.5"
                    transform="rotate(135 60 60)"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={rushToneColor}
                    strokeWidth="10"
                    strokeDasharray={`${rushQualityArc} 314`}
                    strokeLinecap="round"
                    transform="rotate(135 60 60)"
                    className="transition-all duration-1000"
                    style={{ filter: `drop-shadow(0 0 8px ${rushToneColor})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span 
                    className="text-3xl font-black"
                    style={{ color: rushToneColor }}
                  >
                    {rushPercent != null ? `${(100 - rushPercent).toFixed(0)}%` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">Quality</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Rush: {rushPercent?.toFixed(1) ?? '—'}%
              </div>
            </div>

            {/* Progression Stats */}
            <div 
              className="rounded-2xl p-6"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <SectionHeader title="Progression" info="Your account development including Town Hall level, experience, and clan contributions." />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Town Hall</span>
                  <span className="text-2xl font-bold text-white">{townHall ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Experience</span>
                  <span className="text-xl font-semibold text-white">{expLevel ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Capital Gold</span>
                  <span className="text-lg font-semibold text-amber-400">{capitalContrib != null ? formatNumber(capitalContrib) : '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-slate-400">Activity Score</span>
                  <span className="text-xl font-bold text-purple-400">{activityScore != null ? Math.round(activityScore) : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EQUIPMENT TAB */}
      {activeTab === 'equipment' && (
        <div className="space-y-6">
          {/* Equipment controls */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Hero Equipment & Pets</h2>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnownedEquipment}
                onChange={(e) => setShowUnownedEquipment(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Show unowned
            </label>
          </div>

          {!isProfileDataLoaded ? (
            <>
              <Card title="Hero Equipment">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={`equipment-skeleton-${index}`}
                      className="rounded-xl border border-white/5 bg-white/5 p-3 animate-pulse"
                    >
                      <div className="h-12 w-12 rounded-lg bg-white/10 mx-auto mb-3" />
                      <div className="h-3 w-20 rounded bg-white/10 mx-auto" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Hero Pets">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div
                      key={`pet-skeleton-${index}`}
                      className="rounded-xl border border-white/5 bg-white/5 p-3 animate-pulse"
                    >
                      <div className="h-12 w-12 rounded-full bg-white/10 mx-auto mb-3" />
                      <div className="h-3 w-16 rounded bg-white/10 mx-auto" />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <>
              {sortedHeroEquipmentList.length ? (
                <Card title="Hero Equipment">
                  <div className="grid gap-4 md:grid-cols-2">
                    {sortedHeroEquipmentList.map((heroSet) => {
                      const bucket = bucketFromHeroName(heroSet.hero);
                      if (!bucket) return null;
                      
                      // Check if hero is available at this TH level
                      const heroKey = heroKeyFromName(heroSet.hero);
                      const thCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                      const heroMax = heroKey ? (thCaps as any)[heroKey] ?? null : null;
                      
                      // Skip heroes not available at this TH level
                      if (!heroMax) return null;
                      
                      const allItems = (groupedEquipment[bucket] || []).slice().sort((a, b) => {
                        const la = a.level ?? -1;
                        const lb = b.level ?? -1;
                        return lb - la;
                      });
                      // Filter based on showUnownedEquipment toggle
                      const items = showUnownedEquipment 
                        ? allItems 
                        : allItems.filter((item) => item.owned);
                      if (!items.length) return null;
                      const heroLevel = heroKey ? heroLevels[heroKey] ?? null : null;
                      const heroPct = heroLevel && heroMax ? Math.min(100, Math.round((heroLevel / heroMax) * 100)) : null;

                      const isMinion = bucket === 'Minion Prince';
                      return (
                        <div
                          key={heroSet.hero}
                          className={`rounded-2xl border p-3 ${isMinion ? 'md:col-span-2' : ''}`}
                          style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              {heroKey ? <HeroIcon hero={heroKey} size="sm" /> : null}
                              <div className="text-white font-semibold">
                                {heroSet.hero}{heroLevel ? ` · Lvl ${heroLevel}` : ''}
                              </div>
                            </div>
                            {heroPct !== null ? (
                              <div className="flex items-center gap-2 text-xs text-slate-300 min-w-[120px]">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full rounded-full" style={{ width: `${heroPct}%`, background: 'var(--accent-alt)' }} />
                                </div>
                                {heroMax ? <span>Max {heroMax}</span> : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {items.map((item) => {
                              const icon = getEquipmentIcon(item.name);
                              const displayName = item.displayName || item.name;
                              const rarity = item.canonical?.rarity;
                              const maxLevel = item.canonical?.maxLevel;
                              const isEpic = rarity === 'Epic';
                              const isMaxed = item.owned && maxLevel ? toNumber(item.level) >= maxLevel : false;
                              const epicGradient = 'linear-gradient(180deg, #a74ce5 0%, #933fcb 50%, #b04fac 100%)';
                              const fadedEpicGradient = 'linear-gradient(180deg, rgba(167,76,229,0.25) 0%, rgba(147,63,203,0.2) 50%, rgba(176,79,172,0.2) 100%)';
                              const tooltipParts = [
                                item.canonical?.description || displayName,
                                item.owned ? null : 'Not owned yet',
                              ].filter(Boolean);
                              const iconStyle = item.owned
                                ? {}
                                : { filter: 'grayscale(100%) brightness(0.6)', opacity: 0.7 };
                              return (
                                <div
                                  key={`${heroSet.hero}-${item.name}`}
                                  className="relative rounded-xl border p-2 text-center text-xs"
                                  style={{
                                    borderColor: isMaxed ? '#f5d06c' : 'var(--border-subtle)',
                                    background: 'var(--panel)',
                                  }}
                                  title={tooltipParts.join(' • ')}
                                >
                                  <div className="flex items-center justify-center">
                                    <div
                                      className="relative rounded-lg text-[11px] leading-tight text-slate-100 flex items-center justify-center overflow-hidden"
                                      style={{
                                        background: isEpic ? (item.owned ? epicGradient : fadedEpicGradient) : 'var(--panel)',
                                        width: '72px',
                                        height: '60px',
                                      }}
                                    >
                                      {icon ? (
                                        <img
                                          src={icon}
                                          alt={displayName}
                                          className="h-full w-full object-contain transition duration-150 hover:grayscale-0 hover:brightness-100"
                                          width={64}
                                          height={64}
                                          style={{ width: '64px', height: '64px', filter: item.owned ? undefined : 'grayscale(100%) brightness(0.7)', ...iconStyle }}
                                        />
                                      ) : (
                                        <span className="px-1 text-center" style={iconStyle}>{displayName}</span>
                                      )}
                                      <span
                                        className="absolute bottom-0 right-0 translate-x-1 translate-y-1 rounded-full border px-2 py-[1px] text-xs font-black text-white shadow-lg"
                                        style={{
                                          background: 'rgba(0,0,0,0.8)',
                                          borderColor: 'rgba(255,255,255,0.12)',
                                          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                        }}
                                      >
                                        {item.owned ? item.level : '—'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-1 text-white font-semibold leading-tight text-center text-[13px]">{displayName}</div>
                                  {maxLevel ? (
                                    <div className="text-[11px] text-slate-400">{isMaxed ? 'Maxed' : `Max ${maxLevel}`}</div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              {heroPetsData.length ? (
                <Card title="Hero Pets">
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                      {heroPetsData
                        .slice()
                        .sort((a, b) => (normalizedPets?.[b.name] ?? 0) - (normalizedPets?.[a.name] ?? 0))
                        .filter((pet) => showUnownedEquipment || toNumber((normalizedPets as any)?.[pet.name] ?? 0) > 0)
                        .map((pet) => {
                          const level = toNumber((normalizedPets as any)?.[pet.name] ?? 0);
                          const owned = level > 0;
                          const max = pet.maxLevel || PET_MAX_LEVEL;
                          const badgeBg = 'rgba(0,0,0,0.85)';
                          const iconBg = owned ? 'var(--panel)' : 'rgba(255,255,255,0.06)';
                          return (
                            <div
                              key={pet.name}
                              className="rounded-xl border p-2 text-center text-xs"
                              style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                              title={`${pet.name} • ${pet.description}${owned ? '' : ' • Not owned yet'}`}
                            >
                              <div className="flex justify-center">
                                <div
                                  className="relative h-16 w-16 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden"
                                  style={{ background: iconBg }}
                                >
                                  {getPetIcon(pet.name) ? (
                                    <img
                                      src={getPetIcon(pet.name)!}
                                      alt={pet.name}
                                      className="h-full w-full object-contain"
                                      width={64}
                                      height={64}
                                      style={{ width: '64px', height: '64px', filter: owned ? undefined : 'grayscale(100%) brightness(0.7)' }}
                                    />
                                  ) : (
                                    <span className="text-sm">{pet.name.charAt(0)}</span>
                                  )}
                                  <span
                                    className="absolute bottom-0 right-0 translate-x-1 translate-y-1 rounded-full border px-2 py-[1px] text-xs font-black text-white shadow-lg"
                                    style={{
                                      background: badgeBg,
                                      borderColor: 'rgba(255,255,255,0.12)',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                    }}
                                  >
                                    {owned ? level : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-white font-semibold leading-tight text-center text-[13px]">{pet.name}</div>
                              <div className="text-[11px] text-slate-400">{owned ? `Lv ${level}` : 'Not owned'}</div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-widest text-slate-500">History Range</div>
            <div className="flex flex-wrap items-center gap-2">
              {HISTORY_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHistoryRange(option.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    historyRange === option.value
                      ? 'bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* Trophy History */}
            <Card>
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">Trophy Trend</h3>
                      <span className="text-2xl font-bold text-white">
                        {trophies != null ? formatNumber(trophies) : '—'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {historyDeltaTrophies != null && (
                        <span className={`text-xs font-semibold sm:text-sm sm:text-right ${historyDeltaTrophies >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {historyDeltaTrophies >= 0 ? '+' : ''}{formatNumber(historyDeltaTrophies)} {historyRangeLabel}
                        </span>
                      )}
                      <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 text-[10px] uppercase tracking-wide">
                        <button
                          type="button"
                          onClick={() => setTrophyTrendMode('weekly-max')}
                          className={`rounded-full px-2 py-1 transition ${
                            trophyTrendMode === 'weekly-max'
                              ? 'bg-amber-400 text-slate-900'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          Weekly max
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrophyTrendMode('raw')}
                          className={`rounded-full px-2 py-1 transition ${
                            trophyTrendMode === 'raw'
                              ? 'bg-amber-400 text-slate-900'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          Raw
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Helpful description based on mode */}
                  <p className="text-xs text-slate-400">
                    {trophyTrendMode === 'weekly-max' 
                      ? 'Each bar shows the highest trophy count reached during that week (Monday–Sunday)'
                      : 'Daily snapshots of trophy counts over time'}
                  </p>
                </div>
                {trophyTrendMode === 'weekly-max' ? (
                  <BarTrendChart
                    data={trophyTrendData}
                    label="trophies-weekly"
                    color="#f59e0b"
                    height={120}
                  />
                ) : (
                  <TrendChart 
                    data={trophyTrendData}
                    label="trophies"
                    color="#f59e0b"
                    height={120}
                  />
                )}
              </div>
            </Card>

            {/* Donation History */}
            <Card>
              <div className="space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">Donation Trend</h3>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3 sm:justify-end">
                    <div>
                      <span className="text-2xl font-bold text-white">{donated != null ? formatNumber(donated) : '—'}</span>
                      <span className="text-slate-400 text-sm ml-2">given</span>
                    </div>
                    <div>
                      <span className="text-xl font-semibold text-slate-300">{received != null ? formatNumber(received) : '—'}</span>
                      <span className="text-slate-400 text-sm ml-2">received</span>
                    </div>
                  </div>
                </div>
                <TrendChart
                    data={sortedHistoryTimeline
                      .map((e: any, idx: number, arr: any[]) => {
                        const rawDate = e.snapshotDate ?? e.snapshot_date ?? e.timestamp ?? e.date ?? null;
                        const value = toOptionalNumber(e.donations);
                        if (value == null) return null;
                        
                        const date = rawDate ? new Date(rawDate) : null;
                        const useFullDate = arr.length > 14;
                        
                        return {
                          value,
                          label: date
                            ? useFullDate
                              ? date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                              : date.toLocaleDateString('en', { month: 'numeric', day: 'numeric' })
                            : '',
                        };
                      })
                      .filter((entry): entry is { value: number; label: string } => Boolean(entry))}
                  label="donations"
                  color="#10b981"
                  height={120}
                />
              </div>
            </Card>

            {/* VIP History */}
            <Card>
              <div className="space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">VIP Trend</h3>
                    <span className="text-2xl font-bold text-amber-400">
                      {vipCurrentScore != null ? Math.round(vipCurrentScore) : '—'}
                    </span>
                  </div>
                  {vipDelta != null && (
                    <span className={`text-xs font-semibold sm:text-sm sm:text-right ${vipDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {vipDelta >= 0 ? '+' : ''}{vipDelta.toFixed(1)} {historyRangeLabel}
                    </span>
                  )}
                </div>
                <TrendChart
                  data={vipTrendData}
                  label="vip-score"
                  color="#fbbf24"
                  height={120}
                />
              </div>
            </Card>
          </div>

          <div id="league-history" className="scroll-mt-28">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Weekly League Snapshot">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Week of</div>
                  <button
                    type="button"
                    onClick={() => handleCopyLeagueHistory('weekly')}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {leagueCopied === 'weekly' ? 'Copied' : 'Copy weekly CSV'}
                  </button>
                </div>
                {weeklyLeagueHistory.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <th className="text-left py-2 pr-3">Week of</th>
                          <th className="text-right py-2">League</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyLeagueHistory.slice().reverse().map((row) => {
                          const dateLabel = row.weekStart
                            ? new Date(`${row.weekStart}T00:00:00Z`).toLocaleDateString('en', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '-';
                          return (
                            <tr key={`${row.weekStart}-${row.league}`} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="py-2 pr-3 text-slate-300">{dateLabel}</td>
                              <td className="py-2 text-right text-white font-semibold">{row.league}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">No league history recorded yet.</p>
                )}
              </Card>

              <Card title="League Change Log">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-widest text-slate-500">From -&gt; To</div>
                  <button
                    type="button"
                    onClick={() => handleCopyLeagueHistory('changes')}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {leagueCopied === 'changes' ? 'Copied' : 'Copy changes CSV'}
                  </button>
                </div>
                {leagueHistoryChanges.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left py-2 pr-3">From</th>
                          <th className="text-left py-2 pr-3">To</th>
                          <th className="text-right py-2">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leagueHistoryChanges.slice().reverse().map((row) => {
                          const dateLabel = row.date
                            ? new Date(row.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '-';
                          const comparison = row.from ? compareRankedLeagues(row.to, row.from) : 0;
                          const changeLabel = row.from
                            ? comparison > 0
                              ? 'Promotion'
                              : comparison < 0
                                ? 'Demotion'
                                : 'Change'
                            : 'Initial';
                          const changeTone = changeLabel === 'Promotion' ? 'text-emerald-400' : changeLabel === 'Demotion' ? 'text-amber-400' : 'text-slate-300';
                          return (
                            <tr key={`${row.date ?? 'unknown'}-${row.to}`} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="py-2 pr-3 text-slate-300">{dateLabel}</td>
                              <td className="py-2 pr-3 text-slate-300">{row.from ?? '-'}</td>
                              <td className="py-2 pr-3 text-white font-semibold">{row.to}</td>
                              <td className={`py-2 text-right text-xs font-semibold ${changeTone}`}>{changeLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">No league changes detected yet.</p>
                )}
              </Card>
            </div>
          </div>

          {/* Timeline details */}
          {sortedHistoryTimeline.length > 0 && (
            <Card title={`Snapshots (${historyRangeLabel})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-right py-2 px-2">Trophies</th>
                      <th className="text-right py-2 px-2">Donated</th>
                      <th className="text-right py-2 px-2">Received</th>
                      <th className="text-right py-2 px-2">War Stars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistoryTimeline.slice().reverse().map((entry: any, i: number) => {
                      const rawDate = entry.snapshotDate ?? entry.snapshot_date ?? entry.timestamp ?? entry.date ?? null;
                      const displayDate = rawDate ? new Date(rawDate).toLocaleDateString() : '—';
                      const trophyValue = resolveTimelineTrophies(entry);
                      const donationValue = toOptionalNumber(entry.donations);
                      const receivedValue = toOptionalNumber(entry.donationsReceived);
                      const warStarsValue = toOptionalNumber(entry.warStars);
                      return (
                      <tr key={i} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2 text-slate-300">{displayDate}</td>
                        <td className="py-2 px-2 text-right text-white">{trophyValue != null ? formatNumber(trophyValue) : '—'}</td>
                        <td className="py-2 px-2 text-right text-white">{donationValue != null ? formatNumber(donationValue) : '—'}</td>
                        <td className="py-2 px-2 text-right text-white">{receivedValue != null ? formatNumber(receivedValue) : '—'}</td>
                        <td className="py-2 px-2 text-right text-white">{warStarsValue != null ? formatNumber(warStarsValue) : '—'}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Associated Accounts">
            {linkedAccounts.length ? (
              <div className="space-y-2">
                {linkedAccounts.map((account: { tag: string; name?: string | null }) => (
                  <div key={account.tag} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <span className="text-white">{account.name || 'Unknown Player'}</span>
                    <span className="text-slate-400 text-xs font-mono">{account.tag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-300 text-sm">No linked accounts yet.</p>
            )}
          </Card>

          <Card title="Activity History">
            {movements.length ? (
              <div
                className="divide-y divide-white/5 rounded-lg border border-white/5 text-sm"
                style={{ background: 'var(--panel)' }}
              >
                {movements
                  .slice()
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((movement: any, i: number) => (
                    <div key={`${movement.type}-${movement.date}-${i}`} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <div className="text-white font-semibold capitalize">{movement.type}</div>
                        <div className="text-xs text-slate-400">{movement.reason || movement.notes || 'Roster update'}</div>
                      </div>
                      <div className="text-xs text-slate-400">{movement.date?.slice(0, 10)}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-slate-300 text-sm">No recorded movements yet.</p>
            )}
          </Card>

          {/* Player aliases history */}
          {aliases.length > 0 && (
            <Card title="Name History">
              {aliasTimeline.sorted.length > 0 ? (
                <div className="space-y-2">
                  {aliasTimeline.changes.length > 0 ? aliasTimeline.changes.map((change, i) => (
                    <div
                      key={`${change.from}-${change.to}-${change.date ?? i}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                    >
                      <div className="text-white font-semibold">{change.from} -&gt; {change.to}</div>
                      <div className="text-xs text-slate-400">{change.date?.slice(0, 10) ?? '—'}</div>
                    </div>
                  )) : (
                    aliasTimeline.sorted.map((entry, i) => (
                      <div
                        key={`${entry.name}-${entry.firstSeen ?? entry.lastSeen ?? i}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                      >
                        <div className="text-white font-semibold">{entry.name}</div>
                        <div className="text-xs text-slate-400">{(entry.firstSeen ?? entry.lastSeen ?? '').slice(0, 10) || '—'}</div>
                      </div>
                    ))
                  )}
                  {aliasTimeline.changes.length > 0 ? null : (
                    <div className="text-xs text-slate-400">Entries ordered by first seen date.</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-300">
                  Known as <span className="text-white font-semibold">{aliasTimeline.sorted[0]?.name ?? 'Unknown'}</span>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {actionsOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setActionsOpen(false)}>
          <div
            className="h-full w-full max-w-md bg-[var(--surface)] border-l"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-white font-semibold">Leadership Actions</div>
              <Button tone="ghost" onClick={() => setActionsOpen(false)} className="text-sm">
                Close
              </Button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Button tone="primary" className="w-full justify-between text-sm" disabled title="Add note (coming soon)">
                Add Note
              </Button>
              <Button tone="ghost" className="w-full justify-between text-sm" disabled title="Flag account (coming soon)">
                Flag Account
              </Button>
              <Button tone="ghost" className="w-full justify-between text-sm" disabled title="Report concern (coming soon)">
                Report concern
              </Button>
              <p className="text-xs text-slate-400">Leadership tools will wire to the new services soon.</p>

              <div className="h-px bg-white/10 my-2" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Linked Accounts</span>
                  <span className="text-white font-semibold">{linkedAccounts?.length ?? 0}</span>
                </div>
                {linkedAccounts?.length ? (
                  <div className="space-y-1">
                    {linkedAccounts.slice(0, 5).map((account: any) => (
                      <div key={account.tag} className="flex items-center justify-between">
                        <span className="text-white">{account.name || 'Unknown'}</span>
                        <span className="text-slate-400 text-xs font-mono">{account.tag}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm">No linked accounts yet.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Notes</div>
                    <div className="text-white font-semibold">{leadership?.notes?.length ?? 0}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Flags</div>
                    <div className="text-white font-semibold">{leadership?.warnings?.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10 my-2" />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Snapshot</span>
                  <span className="text-white font-semibold">{snapshotText || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Join</span>
                  <span className="text-white font-semibold">
                    {joinStatus ? `${joinStatus}${joinStart ? ` · since ${joinStart}` : ''}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rankingOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setRankingOpen(false)} />
          <aside
            className="relative ml-auto flex h-full w-full max-w-lg flex-col border-l border-white/10 text-white shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 60%, #0b1220 100%)' }}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Clan Ranking</div>
                <div className="text-2xl font-semibold text-white">{activeRanking?.label || 'Ranking'}</div>
                <div className="text-xs text-slate-400 mt-1">{activeRanking?.description}</div>
              </div>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                onClick={() => setRankingOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['trophies', 'donated', 'received', 'warStars', 'rushPercent', 'activity', 'heroPower'] as const).map((stat) => (
                  <button
                    key={stat}
                    onClick={() => setRankingStat(stat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      rankingStat === stat ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {rankingConfig[stat].label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Your Rank</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <div className="text-3xl font-bold text-white">#{meRank ?? '—'}</div>
                  <div className="text-sm text-slate-400">of {totalRanked}</div>
                  {percentile !== null ? (
                    <div className="text-sm text-emerald-300">Top {percentile}%</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-2">
                {rankingData.entries.map((entry, idx) => {
                  const isMe = normalizeTag(entry.tag) === (normalizeTag(tag) || tag);
                  return (
                    <div
                      key={`${entry.tag}-${idx}`}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                        isMe ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/5 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-semibold ${isMe ? 'text-cyan-200' : 'text-slate-400'}`}>#{idx + 1}</div>
                        <div>
                          <div className="text-white font-semibold">{entry.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{entry.tag}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{activeRanking?.format(entry.value)}</div>
                      </div>
                    </div>
                  );
                })}
                {!rankingData.entries.length ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                    No roster data available yet.
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-slate-300">
        <Link
          href="/new/roster"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          ← Back to roster
        </Link>
        <Link
          href={`/player/${encodeURIComponent(tag)}`}
          className="text-slate-400 hover:text-white underline"
          title="View classic profile"
        >
          View classic profile
        </Link>
      </div>
    </div>
  );
}
