"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowDownUp, Filter, Info, ShieldCheck, TrendingUp, TrendingDown, Minus, Users, AlertTriangle, Sparkles, Award, Flame, Zap, Target, Crown } from "lucide-react";
import { Card } from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import { Input } from "@/components/new-ui/Input";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";
import { normalizeSearch } from "@/lib/search";
import LeadershipGuard from "@/components/LeadershipGuard";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

type Tier = "S" | "A" | "B" | "C" | "D";

type MemberRow = {
  name: string;
  tag: string;
  wars: number | null;
  aei: number | null;
  consistency: number | null;
  holdRate: number | null;
  overall: number | null;
  tier: Tier | null;
  reliability: number | null;
  capitalLoot: number | null;
  capitalROI: number | null;
  capitalParticipation: number | null;
  capitalOverall: number | null;
  composite: number | null;
};

type WarIntelResponse = {
  data?: {
    metrics: Array<{
      playerTag: string;
      playerName: string;
      attackEfficiencyIndex: number;
      averageStarsPerAttack: number;
      averageDestructionPerAttack: number;
      cleanupEfficiency: number;
      clutchFactor: number;
      participationRate: number;
      consistencyScore: number;
      consecutiveWarsWithAttacks: number;
      defensiveHoldRate: number | null;
      averageDestructionAllowed: number | null;
      baseStrengthScore: number;
      failedAttacks: number;
      attackTimingScore: number;
      targetSelectionQuality: number;
      overallScore: number;
      totalWars: number;
      totalAttacks: number;
      totalStars: number;
      totalDestruction: number;
      totalDefenses: number;
      totalDefenseDestruction: number;
      performanceTier: string;
      weeklySeries?: Array<{
        weekStart: string;
        aei: number;
        overall: number;
        attacks: number;
        wars: number;
      }>;
    }>;
    clanAverages: {
      averageAEI: number;
      averageConsistency: number;
      averageHoldRate: number;
      averageOverallScore: number;
    };
  };
};

type WarMetric = NonNullable<WarIntelResponse["data"]>["metrics"][number];

const AEI_TOOLTIP =
  "Attack Efficiency Index (AEI): combines war stars, destruction, and target difficulty to score attack performance. Higher is better.";
const CONSISTENCY_TOOLTIP =
  "Consistency measures how reliably a player hits solid results across recent wars (less variance = higher score).";
const HOLD_TOOLTIP =
  "Defense Quality is derived from average stars conceded on defense (lower stars conceded = higher score).";
const OVERALL_TOOLTIP =
  "Overall blends AEI, consistency, and hold rate into a single war performance score.";
const RELIABILITY_TOOLTIP =
  "Reliability blends consistency, defensive hold, and participation to highlight dependable performers.";
const CAPITAL_OVERALL_TOOLTIP =
  "Capital Overall summarizes raid weekend impact (loot/attack, ROI, and participation).";
const CAPITAL_PART_TOOLTIP =
  "Capital Participation reflects how often a player contributes to raid weekends.";
const COMPOSITE_TOOLTIP =
  "Composite is a combined score of war performance and capital impact (weighted blend).";
const TIER_TOOLTIP =
  "Tier bands are based on composite score: S (Elite) ≥ 80, A (Excellent) 65–79, B (Good) 50–64, C (Average) 35–49, D (Needs Improvement) < 35.";
const PLAYER_TOOLTIP =
  "Player name and tag. Click the row to focus the radar profile.";
const BADGES_TOOLTIP =
  "Achievement badges highlight standout traits (e.g., MVP, Consistency, Defender).";
const WARS_TOOLTIP =
  "Total wars counted in this window.";
const AEI_TREND_TOOLTIP =
  "Weekly AEI trend based on real war data. Higher trend line = improving attack efficiency.";
const OVERALL_TREND_TOOLTIP =
  "Weekly overall war performance trend based on real war data.";
const COMP_TREND_TOOLTIP =
  "Weekly performance trend based on war data blended with current capital score (60% war / 40% capital).";

type CapitalResponse = {
  data?: {
    metrics: Array<{
      playerTag: string;
      playerName: string;
      averageLootPerAttack: number;
      lootEfficiency: number;
      totalLoot: number;
      totalAttacks: number;
      carryScore: number;
      bonusAttacksEarned: number;
      bonusAttackRate: number;
      contributionToTotalLoot: number;
      roiScore: number;
      participationRate: number;
      overallScore: number;
      performanceTier: string;
      weekendsParticipated: number;
      totalWeekends: number;
      consecutiveWeekends: number;
      missedWeekends: number[];
      averageDestruction: number;
      capitalGoldContributed: number;
      netContribution: number;
    }>;
    clanAverages: {
      averageLootPerAttack: number;
      averageROI: number;
      averageParticipation: number;
      averageOverallScore: number;
    };
  };
};

type CapitalMetric = NonNullable<CapitalResponse["data"]>["metrics"][number];

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<WarIntelResponse>;
};


function tierFromComposite(score: number | null): Tier | null {
  if (score == null) return null;
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  if (score >= 35) return "C";
  return "D";
}

function reliabilityScore(consistency: number | null, hold: number | null, participation?: number | null) {
  if (consistency == null) return null;
  const parts: Array<{ score: number; weight: number }> = [{ score: consistency, weight: 0.5 }];
  if (typeof hold === "number") parts.push({ score: hold, weight: 0.2 });
  if (typeof participation === "number") parts.push({ score: participation, weight: 0.3 });
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce((sum, part) => sum + part.score * part.weight, 0);
  return Math.round(weighted / (totalWeight || 1));
}

function TierPill({ tier }: { tier: Tier | null }) {
  if (!tier) {
    return (
      <span className="rounded-full px-2.5 py-1 text-xs font-bold border border-white/10 text-white/60">
        —
      </span>
    );
  }
  const tone =
    tier === "S" ? "bg-emerald-500/25 text-emerald-200 border-emerald-400/30" :
    tier === "A" ? "bg-cyan-500/25 text-cyan-100 border-cyan-400/30" :
    tier === "B" ? "bg-amber-500/20 text-amber-100 border-amber-400/30" :
    tier === "C" ? "bg-orange-500/20 text-orange-100 border-orange-400/30" :
    "bg-slate-500/25 text-slate-100 border-slate-400/30";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${tone}`}>
      {tier}
    </span>
  );
}

type SparklinePoint = { value: number; label?: string };

// Sparkline component for inline performance visualization
function Sparkline({ data, color = "#10b981", height = 32 }: { data: SparklinePoint[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return <div className="w-16 h-8 flex items-center justify-center text-[10px] text-slate-600">—</div>;

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 64;
  
  const points = data.map((point, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return { x, y, value: point.value, label: point.label };
  });
  
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / width));
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(index);
  };

  const handleLeave = () => {
    setHoverIndex(null);
  };

  const hoveredPoint = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        className="inline-block"
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} opacity="0.6" />
        ))}
        {hoveredPoint ? (
          <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="3" fill={color} opacity="1" />
        ) : null}
      </svg>
      {hoveredPoint ? (
        <div
          className="absolute pointer-events-none rounded-md border border-white/10 bg-slate-950/90 px-2 py-1 text-[10px] text-white shadow-lg"
          style={{
            left: hoveredPoint.x,
            top: Math.max(0, hoveredPoint.y - 18),
            transform: 'translate(-50%, -100%)',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="text-[9px] text-slate-300">{hoveredPoint.label ?? `Week ${hoverIndex! + 1}`}</div>
          <div className="font-semibold">{Math.round(hoveredPoint.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

// Trend indicator component
function TrendIndicator({ value, previousValue }: { value: number; previousValue?: number }) {
  if (previousValue === undefined) return null;
  
  const change = value - previousValue;
  const percentChange = previousValue > 0 ? ((change / previousValue) * 100) : 0;
  
  if (Math.abs(percentChange) < 1) {
    return <Minus className="h-3.5 w-3.5 text-slate-500" />;
  }
  
  if (change > 0) {
    return (
      <div className="flex items-center gap-1 text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold">+{Math.abs(percentChange).toFixed(0)}%</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-red-400">
      <TrendingDown className="h-3.5 w-3.5" />
      <span className="text-[10px] font-semibold">-{Math.abs(percentChange).toFixed(0)}%</span>
    </div>
  );
}

// Achievement badge component
function AchievementBadge({ type, tooltip }: { type: 'mvp' | 'rising' | 'consistent' | 'defender' | 'capital'; tooltip: string }) {
  const badges = {
    mvp: { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    rising: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    consistent: { icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    defender: { icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
    capital: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  };
  
  const badge = badges[type];
  const Icon = badge.icon;
  
  return (
    <div 
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${badge.bg} ${badge.color} tooltip-trigger`}
      data-tooltip={tooltip}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

// Animated stat card with glow effect
function GlowStatCard({
  label,
  value,
  icon,
  color = "#10b981",
  trend,
  info,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
  info?: string;
}) {
  const trendIcon = trend === 'up' ? <TrendingUp className="h-4 w-4" /> : 
                     trend === 'down' ? <TrendingDown className="h-4 w-4" /> : 
                     trend === 'stable' ? <Minus className="h-4 w-4" /> : null;
  
  return (
    <div 
      className="group relative rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${color}15 0%, transparent 60%)`,
          boxShadow: `0 0 40px ${color}15`
        }}
      />
      
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${color}20` }}>
              <div style={{ color }}>{icon}</div>
            </div>
            {trendIcon && (
              <div className="text-slate-400">{trendIcon}</div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span>{label}</span>
            {info ? (
              <span className="tooltip-trigger tooltip-bottom" title={info}>
                <Info className="h-3 w-3 text-slate-500" />
              </span>
            ) : null}
          </div>
          <div className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

const radarAxes: Array<{ key: keyof MemberRow; label: string }> = [
  { key: "aei", label: "AEI" },
  { key: "consistency", label: "Consistency" },
  { key: "holdRate", label: "Defense" },
  { key: "reliability", label: "Reliability" },
  { key: "capitalOverall", label: "Capital" },
  { key: "capitalParticipation", label: "Cap Part." },
];


function buildRadarPoints(values: number[], radius: number, center: number) {
  const count = values.length;
  return values.map((val, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const scaled = (Math.max(0, Math.min(100, val)) / 100) * radius;
    return {
      x: center + Math.cos(angle) * scaled,
      y: center + Math.sin(angle) * scaled,
      value: val,
      angle,
    };
  });
}

function RadarChart({
  datasets,
  baseline,
  size = 340,
}: {
  datasets: Array<{ label: string; values: number[]; color: string }>;
  baseline?: { label: string; values: number[]; color?: string; leaders?: Array<{ name: string; value: number }> };
  size?: number;
}) {
  const [isAnimated, setIsAnimated] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ player: string; axis: string; value: number; x: number; y: number } | null>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, [datasets]);

  const center = size / 2;
  const radius = size * 0.35; // Increased from 0.32
  const labelRadius = radius + 28; // Reduced from 35
  const rings = [
    { r: 0.25, label: '25' },
    { r: 0.5, label: '50' },
    { r: 0.75, label: '75' },
    { r: 1, label: '100' }
  ];

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          {datasets.map((set, idx) => (
            <React.Fragment key={`defs-${set.label}-${idx}`}>
              <linearGradient id={`radar-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={set.color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={set.color} stopOpacity="0.05" />
              </linearGradient>
              <filter id={`glow-${idx}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </React.Fragment>
          ))}
        </defs>
        
        {/* Background rings with labels */}
        {rings.map((ring, idx) => (
          <g key={`ring-${ring.r}`}>
            <circle
              cx={center}
              cy={center}
              r={radius * ring.r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              className={`transition-opacity duration-700 ${isAnimated ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            />
            {ring.r === 1 && (
              <text
                x={center}
                y={center - radius * ring.r + 15}
                textAnchor="middle"
                className="text-[9px] fill-slate-500 font-mono"
              >
                {ring.label}%
              </text>
            )}
          </g>
        ))}
        
        {/* Axis lines with labels */}
        {radarAxes.map((axis, i) => {
          const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
          const labelX = center + Math.cos(angle) * labelRadius;
          const labelY = center + Math.sin(angle) * labelRadius;
          
          // Adjust text anchor based on position
          let textAnchor: "start" | "middle" | "end" = "middle";
          if (labelX < center - 5) textAnchor = "end";
          if (labelX > center + 5) textAnchor = "start";
          
          return (
            <g key={axis.label}>
              <line
                x1={center}
                y1={center}
                x2={center + Math.cos(angle) * radius}
                y2={center + Math.sin(angle) * radius}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
                className={`transition-opacity duration-500 ${isAnimated ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className="text-[11px] fill-slate-300 font-semibold"
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                  transition: 'opacity 0.5s',
                  transitionDelay: `${i * 80 + 300}ms`,
                  opacity: isAnimated ? 1 : 0
                }}
              >
                {axis.label}
              </text>
            </g>
          );
        })}
        
        {/* Baseline polygon (axis leaders) */}
        {baseline && baseline.values.length === radarAxes.length ? (() => {
          const points = buildRadarPoints(baseline.values, radius, center);
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          const strokeColor = "rgba(148,163,184,0.45)";
          const fillColor = "rgba(148,163,184,0.08)";
          return (
            <g className={`transition-opacity duration-700 ${isAnimated ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '200ms' }}>
              <path d={path} fill={fillColor} stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4 5" />
              {points.map((p, i) => {
                const leader = baseline.leaders?.[i];
                const leaderLabel = leader?.name ? `Best: ${leader.name}` : baseline.label;
                return (
                  <circle
                    key={`${baseline.label}-point-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="rgba(148,163,184,0.55)"
                    opacity="0.7"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({
                      player: leaderLabel,
                      axis: radarAxes[i].label,
                      value: p.value,
                      x: p.x,
                      y: p.y
                    })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </g>
          );
        })() : null}

        {/* Data polygons */}
        {datasets.map((set, idx) => {
          const points = buildRadarPoints(set.values, radius, center);
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          
          return (
            <g 
              key={`${set.label}-${idx}`}
              className={`transition-opacity duration-700 ${isAnimated ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: `${datasets.length > 1 ? idx * 200 : 400}ms` }}
            >
              {/* Fill */}
              <path 
                d={path} 
                fill={`url(#radar-fill-${idx})`} 
                className="transition-all duration-300"
              />
              
              {/* Stroke with glow */}
              <path 
                d={path} 
                fill="none"
                stroke={set.color} 
                strokeWidth="2.5"
                strokeLinejoin="round"
                filter={`url(#glow-${idx})`}
                className="transition-all duration-300"
              />
              
              {/* Data points */}
              {points.map((p, i) => (
                <g key={`${set.label}-point-${i}`}>
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="5" 
                    fill={set.color}
                    stroke="rgba(15,23,42,0.8)"
                    strokeWidth="2"
                    className="cursor-pointer transition-all duration-200 hover:r-[7]"
                    style={{
                      filter: `drop-shadow(0 2px 6px ${set.color}80)`,
                      transform: hoveredPoint?.player === set.label && hoveredPoint?.axis === radarAxes[i].label ? 'scale(1.3)' : 'scale(1)',
                      transformOrigin: `${p.x}px ${p.y}px`
                    }}
                    onMouseEnter={() => setHoveredPoint({
                      player: set.label,
                      axis: radarAxes[i].label,
                      value: p.value,
                      x: p.x,
                      y: p.y
                    })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      
      {/* Hover tooltip */}
      {hoveredPoint && (
        <div 
          className="absolute pointer-events-none z-50 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-xl transition-opacity duration-200"
          style={{
            left: hoveredPoint.x,
            top: hoveredPoint.y - 40,
            background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{hoveredPoint.axis}</div>
          <div className="text-sm font-bold">{hoveredPoint.value.toFixed(1)}%</div>
          <div className="text-[10px] text-slate-400">{hoveredPoint.player}</div>
        </div>
      )}
      
      {/* Legend for multiple players */}
      {datasets.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {datasets.map((set) => (
            <div key={set.label} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ 
                  backgroundColor: set.color,
                  boxShadow: `0 0 8px ${set.color}60`
                }}
              />
              <span className="text-slate-300 font-medium">{set.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberPerformanceInner({ previewBypass }: { previewBypass?: boolean }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof MemberRow>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [daysBack, setDaysBack] = useState(90);
  const [focusedTag, setFocusedTag] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTags, setCompareTags] = useState<string[]>([]);
  const [compareSearch, setCompareSearch] = useState("");
  const [currentOnly, setCurrentOnly] = useState(true);
  const [hasUserSelected, setHasUserSelected] = useState(false);
  const [copiedAction, setCopiedAction] = useState<null | "highlights" | "analysis">(null);

  const currentUser = useDashboardStore((state) => state.currentUser);
  const userRoles = useDashboardStore((state) => state.userRoles);

  const clanTag = normalizeTag(cfg.homeClanTag || "") || cfg.homeClanTag;
  const warKey = !previewBypass && clanTag
    ? `/api/war-intelligence?clanTag=${encodeURIComponent(clanTag)}&daysBack=${daysBack}&public=true`
    : null;

  const weeksBack = Math.max(4, Math.round(daysBack / 7));

  const { data: warData, error: warError, isLoading: warLoading } = useSWR<WarIntelResponse>(warKey, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: capData, error: capError, isLoading: capLoading } = useSWR<CapitalResponse>(
    !previewBypass && clanTag ? `/api/capital-analytics?clanTag=${encodeURIComponent(clanTag)}&weeksBack=${weeksBack}&public=true` : null,
    async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return res.json() as Promise<CapitalResponse>;
    },
    { revalidateOnFocus: false }
  );

  const hasAuthError = !!warError && `${warError.message}`.toLowerCase().includes("unauthorized");
  const hasCapAuthError = !!capError && `${capError.message}`.toLowerCase().includes("unauthorized");

  const hideLiveData = previewBypass || hasAuthError || hasCapAuthError;

  const metrics = hideLiveData ? [] : warData?.data?.metrics ?? [];
  const clanAvg = hideLiveData ? undefined : warData?.data?.clanAverages;

  const capitalMetrics = hideLiveData ? [] : capData?.data?.metrics ?? [];
  const capitalAvg = hideLiveData ? undefined : capData?.data?.clanAverages;
  const isLoading = !hideLiveData && (warLoading || capLoading);

  const warMetricsByTag = useMemo(() => {
    const map = new Map<string, WarMetric>();
    metrics.forEach((m) => {
      const key = normalizeTag(m.playerTag) || m.playerTag;
      map.set(key, m);
    });
    return map;
  }, [metrics]);

  const capitalMetricsByTag = useMemo(() => {
    const map = new Map<string, CapitalMetric>();
    capitalMetrics.forEach((m) => {
      const key = normalizeTag(m.playerTag) || m.playerTag;
      map.set(key, m);
    });
    return map;
  }, [capitalMetrics]);

  const { data: rosterData } = useSWR(
    clanTag ? `/api/v2/roster?clanTag=${encodeURIComponent(clanTag)}` : null,
    async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json() as Promise<any>;
    },
    { revalidateOnFocus: false }
  );

  const merged: Record<string, MemberRow> = {};

  metrics.forEach((m) => {
    const holdRateValue = m.defensiveHoldRate != null ? Math.round(m.defensiveHoldRate * 100) : null;
    const base: MemberRow = {
      name: m.playerName || m.playerTag,
      tag: m.playerTag,
      wars: m.totalWars,
      aei: Math.round(m.attackEfficiencyIndex),
      consistency: Math.round(m.consistencyScore),
      holdRate: holdRateValue,
      overall: Math.round(m.overallScore),
      tier: tierFromComposite(Math.round(m.overallScore)),
      reliability: reliabilityScore(Math.round(m.consistencyScore), holdRateValue, m.participationRate),
      capitalLoot: null,
      capitalROI: null,
      capitalParticipation: null,
      capitalOverall: null,
      composite: Math.round(m.overallScore),
    };
    merged[m.playerTag] = base;
  });

  capitalMetrics.forEach((c) => {
    const existing = merged[c.playerTag] || {
      name: c.playerName || c.playerTag,
      tag: c.playerTag,
      wars: null,
      aei: null,
      consistency: null,
      holdRate: null,
      overall: null,
      tier: null,
      reliability: null,
      capitalLoot: null,
      capitalROI: null,
      capitalParticipation: null,
      capitalOverall: null,
      composite: null,
    };
    existing.capitalLoot = Math.round(c.averageLootPerAttack);
    existing.capitalROI = Math.round(c.roiScore);
    existing.capitalParticipation =
      typeof c.participationRate === "number" ? Math.round(c.participationRate * 100) : null;
    existing.capitalOverall = Math.round(c.overallScore);
    const warComponent =
      typeof existing.overall === "number"
        ? existing.overall
        : typeof existing.aei === "number"
          ? existing.aei
          : null;
    const capComponent =
      typeof existing.capitalOverall === "number"
        ? existing.capitalOverall
        : typeof existing.capitalROI === "number"
          ? existing.capitalROI
          : null;
    const composite =
      warComponent != null && capComponent != null
        ? Math.round(warComponent * 0.6 + capComponent * 0.4)
        : warComponent ?? capComponent ?? null;
    existing.composite = composite;
    existing.tier = tierFromComposite(composite);
    merged[c.playerTag] = existing;
  });

  const rows: MemberRow[] = Object.values(merged);

  const rosterMembers = useMemo(() => rosterData?.data?.members || rosterData?.members || [], [rosterData]);
  const rosterTags = useMemo(() => {
    const members = rosterMembers || [];
    return new Set(
      (members as any[]).map((m) => normalizeTag(m.tag || m.playerTag || "")).filter(Boolean)
    );
  }, [rosterMembers]);

  const currentPlayerTag = useMemo(() => {
    if (!clanTag) return null;
    const roleForClan = userRoles.find((role) => normalizeTag(role.clan_tag) === normalizeTag(clanTag));
    return roleForClan?.player_tag ? normalizeTag(roleForClan.player_tag) : null;
  }, [clanTag, userRoles]);

  const currentRosterTag = useMemo(() => {
    if (!rosterMembers?.length) return null;
    if (currentPlayerTag) {
      const matched = rosterMembers.find((member: any) => normalizeTag(member.tag) === currentPlayerTag);
      return matched?.tag ? normalizeTag(matched.tag) : currentPlayerTag;
    }
    if (currentUser?.name) {
      const normalizedName = currentUser.name.trim().toLowerCase();
      const matched = rosterMembers.find((member: any) => member.name?.trim().toLowerCase() === normalizedName);
      return matched?.tag ? normalizeTag(matched.tag) : null;
    }
    return null;
  }, [currentPlayerTag, currentUser?.name, rosterMembers]);

  const baseRows = rows;
  const shouldLimitToRoster = rosterTags.size > 0;
  const scopedRows = useMemo(() => {
    if (!currentOnly || !shouldLimitToRoster) return baseRows;
    return baseRows.filter((row) => {
      const key = normalizeTag(row.tag) || row.tag;
      return rosterTags.has(key);
    });
  }, [baseRows, currentOnly, rosterTags, shouldLimitToRoster]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(search.trim());
    const dataRows = scopedRows.filter(
      (m) =>
        !term ||
        normalizeSearch(m.name).includes(term) ||
        normalizeSearch(m.tag).includes(term)
    );
    return [...dataRows].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const numA = typeof valA === "number" ? valA : null;
      const numB = typeof valB === "number" ? valB : null;
      if (numA !== null || numB !== null) {
        if (numA === null && numB === null) return 0;
        if (numA === null) return 1;
        if (numB === null) return -1;
        return sortDir === "asc" ? numA - numB : numB - numA;
      }
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return 0;
    });
  }, [scopedRows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const averageOptional = (key: keyof MemberRow) => {
      const values = scopedRows
        .map((m) => m[key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      if (!values.length) return null;
      return Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 10) / 10;
    };
    return {
      aei: clanAvg?.averageAEI ?? averageOptional("aei"),
      consistency: clanAvg?.averageConsistency ?? averageOptional("consistency"),
      hold: averageOptional("holdRate"),
      overall: clanAvg?.averageOverallScore ?? averageOptional("overall"),
      reliability: averageOptional("reliability"),
      capitalLoot: capitalAvg?.averageLootPerAttack ?? averageOptional("capitalLoot"),
      capitalROI: capitalAvg?.averageROI ?? averageOptional("capitalROI"),
      capitalParticipation: capitalAvg?.averageParticipation
        ? Math.round(capitalAvg.averageParticipation * 100)
        : averageOptional("capitalParticipation"),
      capitalOverall: capitalAvg?.averageOverallScore ?? averageOptional("capitalOverall"),
    };
  }, [scopedRows, clanAvg, capitalAvg]);

  const toggleSort = (key: keyof MemberRow) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortButton = ({ column, label, title }: { column: keyof MemberRow; label: string; title?: string }) => (
    <button
      className={`flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white transition-colors ${
        title ? "tooltip-trigger tooltip-bottom" : ""
      }`}
      title={title}
      onClick={() => toggleSort(column)}
    >
      {label}
      <ArrowDownUp className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  const timeRanges = [30, 60, 90, 180];

  const profileRows = scopedRows;
  const scoreFor = (value: number | null) => (typeof value === "number" ? value : Number.NEGATIVE_INFINITY);
  const topAei = profileRows.slice().sort((a, b) => scoreFor(b.aei) - scoreFor(a.aei))[0];
  const topReliability = profileRows.slice().sort((a, b) => scoreFor(b.reliability) - scoreFor(a.reliability))[0];
  const topCapital = profileRows.slice().sort((a, b) => scoreFor(b.capitalOverall) - scoreFor(a.capitalOverall))[0];
  const topComposite = profileRows.slice().sort((a, b) => scoreFor(b.composite) - scoreFor(a.composite))[0];
  const defaultFocusRow = useMemo(() => {
    if (!profileRows.length) return null;
    if (shouldLimitToRoster && currentRosterTag) {
      const matched = profileRows.find((row) => normalizeTag(row.tag) === currentRosterTag);
      if (matched) return matched;
    }
    return profileRows[0];
  }, [currentRosterTag, profileRows, shouldLimitToRoster]);

  useEffect(() => {
    if (!defaultFocusRow?.tag) return;
    const normalizedFocused = focusedTag ? normalizeTag(focusedTag) : null;
    const normalizedDefault = normalizeTag(defaultFocusRow.tag);
    const hasValidFocus = focusedTag
      ? profileRows.some((row) => normalizeTag(row.tag) === normalizedFocused)
      : false;

    if (!focusedTag) {
      setFocusedTag(defaultFocusRow.tag);
      return;
    }

    if (shouldLimitToRoster && !hasValidFocus) {
      setFocusedTag(defaultFocusRow.tag);
      return;
    }

    if (!hasUserSelected && normalizedFocused !== normalizedDefault) {
      setFocusedTag(defaultFocusRow.tag);
    }
  }, [defaultFocusRow?.tag, focusedTag, hasUserSelected, profileRows, shouldLimitToRoster]);

  const needsAttention = profileRows
    .filter((m) =>
      (typeof m.reliability === "number" && m.reliability < 60) ||
      (typeof m.capitalParticipation === "number" && m.capitalParticipation < 60)
    )
    .slice(0, 4);

  const copySummary = () => {
    const formatValue = (value?: number | null) => (typeof value === "number" ? value : "—");
    const lines = [
      `Top composite: ${topComposite?.name ?? "—"} (${formatValue(topComposite?.composite)})`,
      `Top AEI: ${topAei?.name ?? "—"} (${formatValue(topAei?.aei)})`,
      `Top reliability: ${topReliability?.name ?? "—"} (${formatValue(topReliability?.reliability)})`,
      `Top capital: ${topCapital?.name ?? "—"} (${formatValue(topCapital?.capitalOverall)})`,
      needsAttention.length
        ? `Needs attention: ${needsAttention
            .map((m) => `${m.name} (rel ${formatValue(m.reliability)}%, cap part ${formatValue(m.capitalParticipation)}%)`)
            .join("; ")}`
        : "Needs attention: none flagged",
    ];
    const text = lines.join("\n");
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedAction("highlights");
      setTimeout(() => setCopiedAction(null), 1500);
    }).catch(() => {});
  };

  const copyForAnalysis = () => {
    const analysisGuide = {
      llmDirective:
        "You are a Clash of Clans performance analyst. Interpret the data like a competitive war coach: identify strengths, weaknesses, risk flags, and actionable improvements. Assume the reader understands core CoC mechanics.",
      purpose: "Detailed clan performance export for LLM analysis. Includes raw war/capital metrics plus derived scores.",
      windowDays: daysBack,
      scope: currentOnly ? "current_members_only" : "all_participants",
      notes: [
        "Scores are normalized 0–100 unless noted.",
        "Percent fields represent 0–100 percentage points.",
        "Defense Quality = 100 - average destruction allowed on defense.",
        "Composite blends war and capital (60% war / 40% capital).",
        "If a raw metric is null, data was not captured for the window.",
      ],
      definitions: {
        AEI: AEI_TOOLTIP,
        Consistency: CONSISTENCY_TOOLTIP,
        DefenseQuality: HOLD_TOOLTIP,
        Overall: OVERALL_TOOLTIP,
        Reliability: RELIABILITY_TOOLTIP,
        CapitalOverall: CAPITAL_OVERALL_TOOLTIP,
        CapitalParticipation: CAPITAL_PART_TOOLTIP,
        Composite: COMPOSITE_TOOLTIP,
        TierBands: TIER_TOOLTIP,
        WarEfficiencyInputs: "averageStarsPerAttack, averageDestructionPerAttack, cleanupEfficiency, clutchFactor, targetSelectionQuality, attackTimingScore, failedAttacks",
        ParticipationInputs: "participationRate, consecutiveWarsWithAttacks, totalWars, totalAttacks",
        DefenseInputs: "defensiveHoldRate, averageDestructionAllowed, totalDefenses, totalDefenseDestruction",
        CapitalInputs: "averageLootPerAttack, lootEfficiency, carryScore, bonusAttacksEarned, bonusAttackRate, contributionToTotalLoot, participationRate, averageDestruction, capitalGoldContributed, netContribution, roiScore",
      },
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      clanTag,
      windowDays: daysBack,
      currentOnly,
      totals,
      analysisGuide,
      players: filtered.map((m) => ({
        name: m.name,
        tag: m.tag,
        wars: m.wars,
        aei: m.aei,
        consistency: m.consistency,
        defenseQuality: m.holdRate ?? null,
        overall: m.overall,
        reliability: m.reliability,
        capitalLootPerAttack: m.capitalLoot,
        capitalROI: m.capitalROI,
        capitalParticipation: m.capitalParticipation,
        capitalOverall: m.capitalOverall,
        composite: m.composite,
        tier: m.tier,
        isCurrentMember: (m as any).isCurrentMember ?? null,
        warMetrics: warMetricsByTag.get(normalizeTag(m.tag) || m.tag) ?? null,
        capitalMetrics: capitalMetricsByTag.get(normalizeTag(m.tag) || m.tag) ?? null,
      })),
    };
    const text = JSON.stringify(payload, null, 2);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedAction("analysis");
      setTimeout(() => setCopiedAction(null), 1500);
    }).catch(() => {});
  };

  const focusMember = focusedTag ? profileRows.find((m) => normalizeTag(m.tag) === normalizeTag(focusedTag)) ?? defaultFocusRow ?? profileRows[0] : defaultFocusRow ?? profileRows[0];
  const compareSource = shouldLimitToRoster ? profileRows : scopedRows;
  const focusableRows = useMemo(() => {
    if (!shouldLimitToRoster) return filtered;
    return filtered.filter((row) => rosterTags.has(normalizeTag(row.tag)));
  }, [filtered, rosterTags, shouldLimitToRoster]);
  const comparePool = useMemo(() => {
    const term = normalizeSearch(compareSearch.trim());
    return compareSource
      .filter((m) => !term || normalizeSearch(m.name).includes(term) || normalizeSearch(m.tag).includes(term))
      .sort((a, b) => scoreFor(b.composite) - scoreFor(a.composite));
  }, [compareSearch, compareSource]);
  const focusIndex = focusedTag ? focusableRows.findIndex((row) => normalizeTag(row.tag) === normalizeTag(focusedTag)) : -1;
  const focusByIndex = (nextIndex: number) => {
    if (!focusableRows.length) return;
    const safeIndex = ((nextIndex % focusableRows.length) + focusableRows.length) % focusableRows.length;
    setFocusedTag(focusableRows[safeIndex].tag);
    setHasUserSelected(true);
  };
  const radarSets = useMemo(() => {
    const palette = ["#38bdf8", "#22c55e", "#f97316", "#a855f7"];
    const selected = compareMode && compareTags.length
      ? compareSource.filter((m) => compareTags.includes(m.tag))
      : focusMember
        ? [focusMember]
        : [];
    return selected.slice(0, 4).map((m, idx) => ({
      label: m.name,
      values: radarAxes.map((axis) => Number(m[axis.key] || 0)),
      color: palette[idx],
    }));
  }, [compareMode, compareTags, compareSource, focusMember]);

  const radarBaseline = useMemo(() => {
    if (!profileRows.length) return null;
    const leaders = radarAxes.map((axis) => {
      let best: MemberRow | null = null;
      let bestValue = -Infinity;
      profileRows.forEach((row: MemberRow) => {
        const value = Number(row[axis.key] || 0);
        if (value > bestValue) {
          bestValue = value;
          best = row;
        }
      });
      const name = bestValue > 0 && best ? ((best as MemberRow).name ?? '—') : 'No data';
      return { name, value: Math.max(0, bestValue) };
    });
    return {
      label: "Axis leaders",
      values: leaders.map((entry) => entry.value),
      color: "rgba(148,163,184,0.7)",
      leaders,
    };
  }, [profileRows]);

  const strongestAxis = focusMember
    ? radarAxes
        .map((axis) => ({
          label: axis.label,
          value: Number(focusMember[axis.key] || 0),
        }))
        .sort((a, b) => b.value - a.value)[0]
    : null;
  const weakestAxis = focusMember
    ? radarAxes
        .map((axis) => ({
          label: axis.label,
          value: Number(focusMember[axis.key] || 0),
        }))
        .sort((a, b) => a.value - b.value)[0]
    : null;
  
  // Build real weekly trend data from war intelligence metrics
  const sparklineData = useMemo(() => {
    const maxPoints = 8;
    return scopedRows.reduce((acc, member) => {
      const tagKey = normalizeTag(member.tag) || member.tag;
      const series = warMetricsByTag.get(tagKey)?.weeklySeries ?? [];
      const sorted = [...series].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      const trimmed = sorted.slice(-maxPoints);
      const capitalScore = typeof member.capitalOverall === "number" ? member.capitalOverall : 0;
      const labels = trimmed.map((row) =>
        row.weekStart
          ? new Date(`${row.weekStart}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          : ''
      );
      acc[member.tag] = {
        aei: trimmed.map((row, idx) => ({ value: row.aei, label: labels[idx] })),
        overall: trimmed.map((row, idx) => ({ value: row.overall, label: labels[idx] })),
        composite: trimmed.map((row, idx) => ({ value: Math.round(row.overall * 0.6 + capitalScore * 0.4), label: labels[idx] })),
      };
      return acc;
    }, {} as Record<string, { aei: SparklinePoint[]; overall: SparklinePoint[]; composite: SparklinePoint[] }>);
  }, [scopedRows, warMetricsByTag]);

  return (
    <div className="space-y-6">
      {/* Hero Header Banner */}
      <div 
        className="relative rounded-3xl p-8 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #0a0f1a 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        {/* Animated background gradient */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(56, 189, 248, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 50%)',
          }}
        />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-bold text-white mb-2 tracking-tight">
              Member Performance
            </h1>
            <p className="text-lg text-slate-300">
              Comprehensive analytics across war efficiency, consistency, and defensive impact
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button tone="ghost" className="border border-white/10 hover:border-white/20">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button tone="accentAlt" onClick={copySummary}>
              <Sparkles className="h-4 w-4" />
              {copiedAction === "highlights" ? "Copied" : "Copy highlights"}
            </Button>
            <Button tone="ghost" onClick={copyForAnalysis}>
              {copiedAction === "analysis" ? "Copied" : "Copy for Analysis"}
            </Button>
          </div>
        </div>
      </div>

      {/* Animated Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <GlowStatCard 
          icon={<Users className="h-5 w-5" />} 
          label="Players Tracked" 
          value={scopedRows.length}
          color="#38bdf8"
          trend="stable"
        />
        <GlowStatCard 
          icon={<TrendingUp className="h-5 w-5" />} 
          label="Avg AEI" 
          value={totals.aei != null ? `${totals.aei.toFixed(1)}%` : "—"}
          color="#10b981"
          trend="up"
          info={AEI_TOOLTIP}
        />
        <GlowStatCard 
          icon={<ShieldCheck className="h-5 w-5" />} 
          label="Defense Quality" 
          value={totals.hold == null ? "—" : `${Math.round(totals.hold)}%`}
          color="#f59e0b"
          trend="up"
          info={HOLD_TOOLTIP}
        />
        <GlowStatCard 
          icon={<Target className="h-5 w-5" />} 
          label="Avg Overall" 
          value={totals.overall != null ? `${totals.overall.toFixed(1)}%` : "—"}
          color="#8b5cf6"
          trend="stable"
        />
        <GlowStatCard 
          icon={<Sparkles className="h-5 w-5" />} 
          label="Reliability" 
          value={totals.reliability != null ? `${totals.reliability.toFixed(1)}%` : "—"}
          color="#06b6d4"
          trend="up"
        />
        <GlowStatCard 
          icon={<Flame className="h-5 w-5" />} 
          label="Capital Loot/Atk" 
          value={typeof totals.capitalLoot === "number" ? `${totals.capitalLoot.toFixed(0)}` : "—"}
          color="#ef4444"
          trend="up"
        />
        <GlowStatCard 
          icon={<TrendingUp className="h-5 w-5" />} 
          label="Capital ROI" 
          value={typeof totals.capitalROI === "number" ? `${totals.capitalROI.toFixed(1)}%` : "—"}
          color="#22c55e"
          trend="stable"
        />
        <GlowStatCard 
          icon={<Users className="h-5 w-5" />} 
          label="Capital Part." 
          value={typeof totals.capitalParticipation === "number" ? `${totals.capitalParticipation.toFixed(1)}%` : "—"}
          color="#a855f7"
          trend="down"
        />
      </div>

      <Card surface="panel" className="border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by name or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setCurrentOnly((prev) => !prev)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              currentOnly
                ? "bg-[var(--accent-alt)] text-slate-900"
                : "bg-white/5 text-white hover:bg-white/10"
            }`}
            title="Toggle between current roster only and historical participants"
          >
            {currentOnly ? "Current members" : "All participants"}
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Window:</span>
            {timeRanges.map((days) => (
              <button
                key={days}
                onClick={() => setDaysBack(days)}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  daysBack === days
                    ? "bg-[var(--accent-alt)] text-slate-900 scale-105"
                    : "bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
          <div className="text-xs text-white/60">
            {filtered.length} of {scopedRows.length} players
          </div>
        </div>
        {hideLiveData ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Live metrics unavailable. Sign in as leadership to view production data.
          </div>
        ) : null}
      </Card>

      <Card surface="panel" className="border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white mb-1">Individual Performance Profile</h2>
            {!compareMode && focusMember ? (
              <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-white">{focusMember.name}</div>
                  <TierPill tier={focusMember.tier} />
                    <div className="text-sm text-white/60">{focusMember.tag}</div>
                  </div>
                <div className="h-6 w-px bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/60">Composite</div>
                  <div className="text-xl font-bold text-[var(--accent-alt)]">
                    {focusMember.composite != null ? focusMember.composite : "—"}
                  </div>
                </div>
              </div>
            ) : compareMode ? (
              <p className="text-xs text-white/60 mt-1">Comparing {radarSets.length} players across key metrics</p>
            ) : (
              <p className="text-xs text-white/60 mt-1">Select a player to view their performance profile</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button tone="ghost" className="text-sm" onClick={() => focusByIndex((focusIndex >= 0 ? focusIndex : 0) - 1)} disabled={!focusableRows.length}>
              ← Prev
            </Button>
            <Button tone="ghost" className="text-sm" onClick={() => focusByIndex((focusIndex >= 0 ? focusIndex : 0) + 1)} disabled={!focusableRows.length}>
              Next →
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center justify-center">
            {radarSets.length ? (
              <RadarChart datasets={radarSets} baseline={radarBaseline ?? undefined} />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-xs text-white/60">No data yet.</div>
            )}
          </div>
          <div className="space-y-4">
            {/* Performance Insights */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/60 mb-3">Performance Insights</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-emerald-400">💪</span>
                    <span className="text-emerald-400 font-semibold">Strongest</span>
                  </div>
                  <div className="font-bold text-white text-sm">{strongestAxis?.label ?? "—"}</div>
                  <div className="text-emerald-300 font-mono">{strongestAxis?.value.toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-orange-400/20 bg-orange-500/10 px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-orange-400">📈</span>
                    <span className="text-orange-400 font-semibold">Needs Work</span>
                  </div>
                  <div className="font-bold text-white text-sm">{weakestAxis?.label ?? "—"}</div>
                  <div className="text-orange-300 font-mono">{weakestAxis?.value.toFixed(0)}%</div>
                </div>
              </div>
            </div>
            
            {/* Compare Mode */}
            {compareMode ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Compare players</div>
                  <Button tone="ghost" className="text-sm" onClick={() => setCompareMode(false)}>
                    Focus view
                  </Button>
                </div>
                <div className="mb-3">
                  <Input
                    placeholder="Search players"
                    value={compareSearch}
                    onChange={(e) => setCompareSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {comparePool.map((m) => {
                    const active = compareTags.includes(m.tag);
                    return (
                      <button
                        key={m.tag}
                        onClick={() => {
                          setCompareTags((prev) =>
                            active ? prev.filter((t) => t !== m.tag) : [...prev, m.tag].slice(0, 4)
                          );
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                          active ? "bg-[var(--accent-alt)] text-slate-900 scale-105" : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button tone="ghost" onClick={() => setCompareMode(true)}>
                  Compare 2–4 players
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Additional Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tier Distribution Chart */}
        <Card surface="panel" className="border-white/10">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Performance Distribution</h3>
            <p className="text-xs text-white/60">Player count by performance tier</p>
          </div>
          <div className="space-y-3">
            {[
              { tier: 'S' as Tier, label: 'Elite', color: '#10b981', count: scopedRows.filter(m => m.tier === 'S').length },
              { tier: 'A' as Tier, label: 'Excellent', color: '#06b6d4', count: scopedRows.filter(m => m.tier === 'A').length },
              { tier: 'B' as Tier, label: 'Good', color: '#f59e0b', count: scopedRows.filter(m => m.tier === 'B').length },
              { tier: 'C' as Tier, label: 'Average', color: '#f97316', count: scopedRows.filter(m => m.tier === 'C').length },
              { tier: 'D' as Tier, label: 'Needs Improvement', color: '#6b7280', count: scopedRows.filter(m => m.tier === 'D').length },
            ].map((item) => {
              const percentage = scopedRows.length > 0 ? (item.count / scopedRows.length) * 100 : 0;
              return (
                <div key={item.tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <TierPill tier={item.tier} />
                      <span className="tooltip-trigger tooltip-bottom text-slate-300 font-medium" title={TIER_TOOLTIP}>{item.label}</span>
                    </div>
                    <span className="text-slate-400 font-mono">{item.count} players ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                        boxShadow: `0 0 12px ${item.color}60`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Metrics Leaderboard */}
        <Card surface="panel" className="border-white/10">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Metric Leaders</h3>
            <p className="text-xs text-white/60">Top 3 performers in each category</p>
          </div>
          <div className="space-y-4">
            {[
              { metric: 'AEI', key: 'aei' as keyof MemberRow, icon: <TrendingUp className="h-4 w-4" />, color: '#10b981', tooltip: AEI_TOOLTIP },
              { metric: 'Consistency', key: 'consistency' as keyof MemberRow, icon: <Target className="h-4 w-4" />, color: '#06b6d4', tooltip: CONSISTENCY_TOOLTIP },
              { metric: 'Defense', key: 'holdRate' as keyof MemberRow, icon: <ShieldCheck className="h-4 w-4" />, color: '#f59e0b', tooltip: HOLD_TOOLTIP },
            ].map((category) => {
              const topPlayers = profileRows
                .slice()
                .sort((a, b) => scoreFor(b[category.key] as number | null) - scoreFor(a[category.key] as number | null))
                .slice(0, 3);
              
              return (
                <div key={category.metric} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                    <div style={{ color: category.color }}>{category.icon}</div>
                    <span className="tooltip-trigger tooltip-bottom" title={category.tooltip}>{category.metric}</span>
                  </div>
                  <div className="space-y-1">
                    {topPlayers.map((player, idx) => (
                      <div 
                        key={player.tag}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => {
                          setFocusedTag(player.tag);
                          setHasUserSelected(true);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 w-4">#{idx + 1}</span>
                          <span className="text-sm text-white font-medium truncate">{player.name}</span>
                        </div>
                        <span 
                          className="text-sm font-bold font-mono"
                          style={{ color: category.color }}
                        >
                        {typeof player[category.key] === "number" ? `${player[category.key]}%` : "—"}
                      </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card surface="bg">
        <div className="flex flex-wrap items-center gap-3 pb-3 text-xs text-white/70">
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 flex items-center gap-2">
            <Crown className="h-4 w-4 text-emerald-400" />
            <span>Top AEI: <span className="font-semibold text-white">{topAei?.name ?? "—"}</span></span>
          </div>
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-400" />
            <span>Best reliability: <span className="font-semibold text-white">{topReliability?.name ?? "—"}</span></span>
          </div>
          <div className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span>Top capital: <span className="font-semibold text-white">{topCapital?.name ?? "—"}</span></span>
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Top composite: <span className="font-semibold text-white">{topComposite?.name ?? "—"}</span></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/80">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-3 py-2 text-left">
                  <span className="tooltip-trigger tooltip-bottom" title={PLAYER_TOOLTIP}>Player</span>
                </th>
                <th className="px-3 py-2 text-center">
                  <span className="tooltip-trigger tooltip-bottom" title={BADGES_TOOLTIP}>Badges</span>
                </th>
                <th className="px-3 py-2 text-right"><SortButton column="wars" label="Wars" title={WARS_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="aei" label="AEI" title={AEI_TOOLTIP} /></th>
                <th className="px-3 py-2 text-center">
                  <span className="tooltip-trigger tooltip-bottom" title={AEI_TREND_TOOLTIP}>AEI Trend</span>
                </th>
                <th className="px-3 py-2 text-right"><SortButton column="consistency" label="Consistency" title={CONSISTENCY_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="holdRate" label="Defense" title={HOLD_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="overall" label="Overall" title={OVERALL_TOOLTIP} /></th>
                <th className="px-3 py-2 text-center">
                  <span className="tooltip-trigger tooltip-bottom" title={OVERALL_TREND_TOOLTIP}>Overall Trend</span>
                </th>
                <th className="px-3 py-2 text-right"><SortButton column="reliability" label="Reliability" title={RELIABILITY_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalLoot" label="Cap Loot" title={CAPITAL_OVERALL_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalROI" label="Cap ROI" title={CAPITAL_OVERALL_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalParticipation" label="Cap Part." title={CAPITAL_PART_TOOLTIP} /></th>
                <th className="px-3 py-2 text-right"><SortButton column="composite" label="Composite" title={COMPOSITE_TOOLTIP} /></th>
                <th className="px-3 py-2 text-center">
                  <span className="tooltip-trigger tooltip-bottom" title={COMP_TREND_TOOLTIP}>Comp. Trend</span>
                </th>
                <th className="px-3 py-2 text-center">
                  <span className="tooltip-trigger tooltip-bottom" title={TIER_TOOLTIP}>Tier</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((m, idx) => {
                const badges = [];
                if (typeof m.composite === "number" && m.composite >= 80) badges.push(<AchievementBadge key="mvp" type="mvp" tooltip="MVP Performer (80+ composite)" />);
                if (typeof m.consistency === "number" && m.consistency >= 75) badges.push(<AchievementBadge key="consistent" type="consistent" tooltip="Consistency Champion (75+)" />);
                if (m.holdRate != null && m.holdRate >= 20) badges.push(<AchievementBadge key="defender" type="defender" tooltip="Elite Defender (20+ hold rate)" />);
                if (typeof m.capitalOverall === "number" && m.capitalOverall >= 75) badges.push(<AchievementBadge key="capital" type="capital" tooltip="Capital Star (75+)" />);
                
                const memberSparklines = sparklineData[m.tag] || { aei: [], overall: [], composite: [] };
                const isCurrentMember = !shouldLimitToRoster || rosterTags.has(normalizeTag(m.tag));
                
                return (
                  <tr
                    key={m.tag}
                    className={`group transition-colors ${
                      isCurrentMember ? "hover:bg-white/5 cursor-pointer" : "opacity-60 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (!isCurrentMember) return;
                      setFocusedTag(m.tag);
                      setHasUserSelected(true);
                    }}
                    title={isCurrentMember ? undefined : "Not in current roster"}
                  >
                    <td className="px-3 py-3">
                      <Link 
                        href={`/new/player/${encodeURIComponent(normalizeTag(m.tag) || m.tag)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col hover:text-[var(--accent-alt)] transition-colors"
                      >
                        <span className="font-semibold text-white">{m.name}</span>
                        <span className="text-xs font-mono text-white/60">{m.tag}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {badges}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{m.wars != null ? m.wars : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{m.aei != null ? `${m.aei}%` : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <Sparkline data={memberSparklines.aei} color="#10b981" />
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{m.consistency != null ? `${m.consistency}%` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.holdRate == null ? "—" : `${m.holdRate}%`}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{m.overall != null ? `${m.overall}%` : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <Sparkline data={memberSparklines.overall} color="#8b5cf6" />
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{m.reliability != null ? `${m.reliability}%` : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono">{typeof m.capitalLoot === "number" ? m.capitalLoot : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono">{typeof m.capitalROI === "number" ? `${m.capitalROI}%` : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono">{typeof m.capitalParticipation === "number" ? `${m.capitalParticipation}%` : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-[var(--accent-alt)]">{m.composite != null ? m.composite : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <Sparkline data={memberSparklines.composite} color="#38bdf8" />
                    </td>
                    <td className="px-3 py-3 text-center"><TierPill tier={m.tier} /></td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-6 text-center text-white/60">
                    No data available for this window.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function MemberPerformancePage() {
  return <MemberPerformanceInner />;
}
