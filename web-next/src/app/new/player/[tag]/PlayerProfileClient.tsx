"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
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
import { HERO_MAX_LEVELS } from '@/types';
import { rushTone } from '../../roster/roster-utils';
import Link from 'next/link';

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
            className="relative px-3 py-2 rounded-lg text-xs text-slate-200 max-w-[220px] text-center whitespace-normal leading-relaxed"
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
  warAttacks: "Total war attacks used during the selected period. More attacks means higher participation.",
  averageStars: "Average stars per war attack. Higher values indicate stronger attack efficiency.",
  holdRate: "Defensive hold rate is the percentage of defenses that held the enemy below 3 stars.",
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

// Large trend chart component
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
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;
  
  return (
    <div className="relative w-full" style={{ height }}>
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
        </defs>
        {/* Area fill */}
        <path
          d={areaD}
          fill={`url(#gradient-${label})`}
          className={`transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
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
          className={`transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            className={`transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              transitionDelay: `${i * 100}ms`,
              filter: `drop-shadow(0 0 4px ${color})`
            }}
          />
        ))}
      </svg>
      {/* Labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-500 px-1">
          {points.map((p, i) => (
            <span key={i} className="text-center" style={{ width: `${100 / points.length}%` }}>
              {p.label}
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
            <span 
              className="text-xl"
              style={{ 
                filter: 'brightness(1.2) saturate(1.3)',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              {icon}
            </span>
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
  const swrKey = `/api/player/${encodeURIComponent(tag)}/profile`;
  const { data, isLoading, error } = useSWR<SupabasePlayerProfilePayload>(swrKey, playerProfileFetcher, {
    ...playerProfileSWRConfig,
    fallbackData: initialProfile || undefined,
  });

  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  
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
    router.push(`/new/player/${encodeURIComponent(normalizedTag)}`, { scroll: false });
  }, [router]);
  
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
  const normalizedTag = normalizeTag(tag) || tag;
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
  const history = (profile as any)?.history ?? null;
  const vip = (profile as any)?.vip?.current ?? null;

  const heroLevels = useMemo(() => {
    const levels: Record<string, number | null | undefined> = {};
    const srcLevels = (summary as any)?.heroLevels ?? (summary as any)?.hero_levels ?? {};
    heroOrder.forEach((key) => {
      levels[key] = srcLevels[key] ?? (summary as any)?.[key] ?? (rosterFallback as any)?.[key] ?? null;
    });
    return levels;
  }, [summary, rosterFallback]);

  const townHall = summary.townHallLevel ?? (summary as any).th ?? resolveTownHall(rosterFallback as any) ?? null;
  const heroPowerTotal = useMemo(() => {
    return heroOrder.reduce((sum: number, heroKey) => {
      const thCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};
      const maxLevel = (thCaps as any)[heroKey] ?? null;
      if (!maxLevel) return sum;
      const level = heroLevels[heroKey] as number | null;
      return sum + (toNumber(level) || 0);
    }, 0);
  }, [heroLevels, townHall]);
  const leagueFromProfile = (summary as any)?.rankedLeague?.name ?? summary?.leagueName ?? null;
  const { league: leagueName, tier: leagueTier } = rosterFallback ? resolveLeague(rosterFallback as any) : { league: leagueFromProfile, tier: undefined };
  const role = (summary?.role as any)?.toString().toLowerCase() || (rosterFallback?.role as any)?.toString().toLowerCase() || 'member';
  const displayName = summary?.name || rosterFallback?.name || (rosterLoading ? 'Loading name…' : 'Name unavailable');
  const clanName = (summary as any)?.clanName ?? (summary as any)?.clan?.name ?? (rosterFallback as any)?.clanName ?? (rosterFallback as any)?.meta?.clanName ?? null;
  const clanTag = (summary as any)?.clanTag ?? (summary as any)?.clan?.tag ?? (rosterFallback as any)?.clanTag ?? null;
  const normalizedClanTag = normalizeTag(clanTag || '') || clanTag || '';
  const warIntelKey = normalizedClanTag
    ? `/api/war-intelligence?clanTag=${encodeURIComponent(normalizedClanTag)}&playerTag=${encodeURIComponent(normalizedTag)}&daysBack=120`
    : null;
  const { data: warIntelData, error: warIntelError } = useSWR<WarIntelResponse>(warIntelKey, warIntelFetcher, {
    revalidateOnFocus: false,
  });
  const rushPercent = (summary as any)?.rushPercent ?? (rosterFallback as any)?.rushPercent ?? null;
  const activityScore = (summary as any)?.activity?.score ?? (summary as any)?.activityScore ?? (rosterFallback as any)?.activityScore ?? null;
  const tenureDays = (summary as any)?.tenure_days ?? (summary as any)?.tenureDays ?? (rosterFallback as any)?.tenure_days ?? null;
  const snapshotDate = timeline?.length ? timeline[timeline.length - 1]?.snapshotDate ?? null : null;
  const snapshotFreshness = snapshotDate ? new Date(snapshotDate) : null;
  const snapshotText = snapshotFreshness ? `Snapshot ${snapshotFreshness.toISOString().slice(0, 10)}` : null;
  const warPreference = (summary as any)?.war?.preference ?? null;
  const builderBase = (summary as any)?.builderBase ?? {};
  const capitalContrib = (summary as any)?.capitalContributions ?? null;
  const achievements = (summary as any)?.achievements ?? {};
  const expLevel = (summary as any)?.expLevel ?? null;
  const joinStatus = history?.currentStint?.isActive ? 'Active' : history?.currentStint ? 'Inactive' : null;
  const joinStart = history?.currentStint?.startDate ?? null;
  const aliases = history?.aliases ?? [];
  const movements = history?.movements ?? [];

  const recentTimeline = useMemo(() => (timeline?.length ? timeline.slice(Math.max(0, timeline.length - 7)) : []), [timeline]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showUnownedEquipment, setShowUnownedEquipment] = useState(true);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingStat, setRankingStat] = useState<'trophies' | 'donated' | 'received' | 'warStars' | 'rushPercent' | 'activity' | 'heroPower'>('trophies');

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
    return {
      trophies: toNumber(latest.rankedTrophies ?? latest.trophies) - toNumber(prev.rankedTrophies ?? prev.trophies),
      donations: toNumber(latest.donations) - toNumber(prev.donations),
      donationsReceived: toNumber(latest.donationsReceived) - toNumber(prev.donationsReceived),
      warStars: toNumber(latest.warStars) - toNumber(prev.warStars),
    };
  }, [timeline]);

  const trendSeries = useMemo(() => {
    const getSeries = (key: string) => recentTimeline.map((entry: any) => toNumber((entry as any)[key]));
    return {
      trophies: recentTimeline.map((entry: any) => toNumber(entry.rankedTrophies ?? entry.trophies)),
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

  const trophies = summary?.rankedTrophies ?? summary?.trophies ?? rosterFallback?.rankedTrophies ?? rosterFallback?.trophies ?? 0;
  const donated = summary?.donations?.given ?? rosterFallback?.donations ?? 0;
  const received = summary?.donations?.received ?? rosterFallback?.donationsReceived ?? 0;
  const warStarsValue = summary?.war?.stars ?? (rosterFallback as any)?.warStars ?? 0;
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

  const rankingConfig = useMemo(() => ({
    trophies: {
      label: 'Trophies',
      description: 'Ranked trophies compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toNumber(m.rankedTrophies ?? m.trophies ?? 0),
      format: (v: number) => formatNumber(v),
    },
    donated: {
      label: 'Donated',
      description: 'Season donations compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toNumber(m.donations ?? m?.donations?.given ?? 0),
      format: (v: number) => formatNumber(v),
    },
    received: {
      label: 'Received',
      description: 'Season received troops compared to your current clan.',
      higherBetter: false,
      value: (m: any) => toNumber(m.donationsReceived ?? m?.donations?.received ?? 0),
      format: (v: number) => formatNumber(v),
    },
    warStars: {
      label: 'War Stars',
      description: 'Total war stars compared to your current clan.',
      higherBetter: true,
      value: (m: any) => toNumber(m.warStars ?? m?.war?.stars ?? 0),
      format: (v: number) => formatNumber(v),
    },
    rushPercent: {
      label: 'Rush %',
      description: 'Rush percentage compared to your clan (lower is better).',
      higherBetter: false,
      value: (m: any) => toNumber(m.rushPercent ?? m?.rush_percent ?? 0),
      format: (v: number) => `${v.toFixed(1)}%`,
    },
    activity: {
      label: 'Activity',
      description: 'Activity score compared to your clan.',
      higherBetter: true,
      value: (m: any) => toNumber(m.activityScore ?? m?.activity?.score ?? 0),
      format: (v: number) => formatNumber(Math.round(v)),
    },
    heroPower: {
      label: 'Hero Power',
      description: 'Total hero levels compared to your clan.',
      higherBetter: true,
      value: (m: any) => {
        const levels = (m?.heroLevels ?? m?.hero_levels ?? m) as any;
        return (
          toNumber(levels?.bk ?? 0) +
          toNumber(levels?.aq ?? 0) +
          toNumber(levels?.gw ?? 0) +
          toNumber(levels?.rc ?? 0) +
          toNumber(levels?.mp ?? 0)
        );
      },
      format: (v: number) => formatNumber(v),
    },
  }), []);

  const rankingData = useMemo(() => {
    const config = rankingConfig[rankingStat];
    if (!config) return { entries: [], me: null, total: 0 };
    const baseEntries = rosterMembers.map((member: any) => ({
      tag: normalizeTag(member.tag) || member.tag,
      name: member.name || member.tag,
      value: config.value(member),
    }));
    const currentTag = normalizeTag(tag) || tag;
    const hasMe = baseEntries.some((entry) => entry.tag === currentTag);
    if (!hasMe) {
      baseEntries.push({
        tag: currentTag,
        name: displayName || currentTag,
        value: config.value(summary),
      });
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
          {/* Top section: Identity + VIP */}
          <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
            {/* Left: Player identity */}
            <div className="flex items-center gap-5">
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
              
              {/* Name and details */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 
                    className="text-5xl font-black text-white tracking-tight"
                    style={{ 
                      fontFamily: 'var(--font-display)', 
                      textShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.1)'
                    }}
                  >
                    {displayName}
                  </h1>
                  <RoleIcon role={role as any} size={32} className="shrink-0" />
                  <LeagueIcon league={leagueName ?? undefined} ranked size="sm" badgeText={leagueTier ?? undefined} showBadge />
                </div>
                <div className="flex items-center gap-3 text-sm">
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
            </div>
            
            {/* Right: VIP Score + Actions */}
            <div className="flex items-center gap-4">
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
              
              {/* Player Navigation + Actions */}
              <div className="flex items-center gap-2">
                {/* Prev/Next Navigation */}
                {sortedRoster.length > 1 && (
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                  <AnimatedCounter value={heroPowerTotal} />
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Total Power</div>
              </div>
            </div>
          </div>

          {/* Key Stats Grid - Premium stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <GlowStatCard 
              label="Trophies" 
              value={trophies} 
              delta={deltas?.trophies}
              icon="🏆"
              color="#f59e0b"
              info={STAT_DEFINITIONS.trophies}
              onClick={() => openRanking('trophies')}
            />
            <GlowStatCard 
              label="Donated" 
              value={donated} 
              delta={deltas?.donations}
              icon="📤"
              color="#10b981"
              info={STAT_DEFINITIONS.donated}
              onClick={() => openRanking('donated')}
            />
            <GlowStatCard 
              label="Received" 
              value={received} 
              delta={deltas?.donationsReceived}
              icon="📥"
              color="#6366f1"
              info={STAT_DEFINITIONS.received}
              onClick={() => openRanking('received')}
            />
            <GlowStatCard 
              label="War Stars" 
              value={warStarsValue}
              icon="⭐"
              color="#eab308"
              info={STAT_DEFINITIONS.warStars}
              onClick={() => openRanking('warStars')}
            />
            <GlowStatCard 
              label="Rush %" 
              value={rushPercent != null ? `${rushPercent.toFixed(1)}%` : '—'}
              icon="📊"
              color={rushTone(rushPercent) || '#94a3b8'}
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
            onClick={() => setActiveTab(tabKey)}
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Trophy Progression</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">
                      <AnimatedCounter value={trophies} />
                    </span>
                    {deltas?.trophies != null && deltas.trophies !== 0 && (
                      <span className={`text-lg font-bold ${deltas.trophies > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {deltas.trophies > 0 ? '↑' : '↓'} {Math.abs(deltas.trophies)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-5xl" style={{ opacity: 0.6, filter: 'saturate(1.4) brightness(1.1)' }}>🏆</div>
              </div>
              <TrendChart 
                data={recentTimeline.map((e: any) => ({
                  value: toNumber(e.rankedTrophies ?? e.trophies),
                  label: new Date(e.snapshotDate).toLocaleDateString('en', { weekday: 'short' })
                }))}
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Donation Activity</div>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <span className="text-3xl font-black text-emerald-400">
                        <AnimatedCounter value={donated} />
                      </span>
                      <span className="text-slate-500 text-sm ml-1">given</span>
                    </div>
                    <div className="text-slate-600">|</div>
                    <div>
                      <span className="text-2xl font-bold text-indigo-400">
                        <AnimatedCounter value={received} />
                      </span>
                      <span className="text-slate-500 text-sm ml-1">received</span>
                    </div>
                  </div>
                </div>
                <div className="text-5xl" style={{ opacity: 0.6, filter: 'saturate(1.4) brightness(1.1)' }}>📤</div>
              </div>
              <TrendChart 
                data={recentTimeline.map((e: any) => ({
                  value: toNumber(e.donations),
                  label: new Date(e.snapshotDate).toLocaleDateString('en', { weekday: 'short' })
                }))}
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
                  <span className="text-slate-400">War Stars</span>
                  <span className="text-2xl font-bold text-amber-400">{formatNumber(warStarsValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Attacks Used</span>
                  <span className="text-xl font-semibold text-white">{formatMetric(warAttacksUsed)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Avg Stars</span>
                  <span className="text-xl font-semibold text-white">{formatMetric(avgStarsPerAttack, { decimals: 2 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hold Rate</span>
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
                    stroke={rushTone(rushPercent) || '#10b981'}
                    strokeWidth="10"
                    strokeDasharray={`${(100 - (rushPercent ?? 0)) / 100 * 235.6} 314`}
                    strokeLinecap="round"
                    transform="rotate(135 60 60)"
                    className="transition-all duration-1000"
                    style={{ filter: `drop-shadow(0 0 8px ${rushTone(rushPercent) || '#10b981'})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span 
                    className="text-3xl font-black"
                    style={{ color: rushTone(rushPercent) || '#10b981' }}
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
                    .sort((a, b) => (pets?.[b.name] ?? 0) - (pets?.[a.name] ?? 0))
                    .filter((pet) => showUnownedEquipment || toNumber((pets as any)?.[pet.name] ?? 0) > 0)
                    .map((pet) => {
                      const level = toNumber((pets as any)?.[pet.name] ?? 0);
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
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Trophy History */}
            <Card title="Trophy Trend (7 Days)">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-white">{formatNumber(trophies)}</span>
                  {deltas?.trophies != null && (
                    <span className={`text-sm font-semibold ${deltas.trophies >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {deltas.trophies >= 0 ? '+' : ''}{formatNumber(deltas.trophies)} this week
                    </span>
                  )}
                </div>
                <div className="h-24">
                  <Sparkline points={trendSeries.trophies} height={96} strokeWidth={2} />
                </div>
                {recentTimeline.length > 0 && (
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
                    {recentTimeline.map((entry: any, i: number) => (
                      <div key={i}>
                        <div className="text-white font-medium">{formatNumber(toNumber(entry.rankedTrophies ?? entry.trophies))}</div>
                        <div>{new Date(entry.snapshotDate).toLocaleDateString('en', { weekday: 'short' })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Donation History */}
            <Card title="Donation Trend (7 Days)">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-white">{formatNumber(donated)}</span>
                    <span className="text-slate-400 text-sm ml-2">given</span>
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-slate-300">{formatNumber(received)}</span>
                    <span className="text-slate-400 text-sm ml-2">received</span>
                  </div>
                </div>
                <div className="h-24">
                  <Sparkline points={trendSeries.donations} height={96} strokeWidth={2} />
                </div>
              </div>
            </Card>
          </div>

          {/* Timeline details */}
          {recentTimeline.length > 0 && (
            <Card title="Recent Snapshots">
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
                    {recentTimeline.slice().reverse().map((entry: any, i: number) => (
                      <tr key={i} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2 text-slate-300">{new Date(entry.snapshotDate).toLocaleDateString()}</td>
                        <td className="py-2 px-2 text-right text-white">{formatNumber(toNumber(entry.rankedTrophies ?? entry.trophies))}</td>
                        <td className="py-2 px-2 text-right text-white">{formatNumber(toNumber(entry.donations))}</td>
                        <td className="py-2 px-2 text-right text-white">{formatNumber(toNumber(entry.donationsReceived))}</td>
                        <td className="py-2 px-2 text-right text-white">{formatNumber(toNumber(entry.warStars))}</td>
                      </tr>
                    ))}
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
              <div className="space-y-2">
                {movements
                  .slice()
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((movement: any, i: number) => (
                    <div key={`${movement.type}-${movement.date}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
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
              <div className="flex flex-wrap gap-2">
                {aliases.map((alias: any, i: number) => {
                  const label = typeof alias === 'string' ? alias : alias?.name ?? 'Unknown';
                  return (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border-subtle)' }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
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
