"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import type { RosterMember } from './roster/types';
import { formatDistanceToNow } from 'date-fns';
import { normalizeTag } from '@/lib/tags';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { ClanHealthSummary, DashboardData, LeaderReviewSummary } from '@/lib/dashboard/dashboard-data';
import type { DashboardMetrics } from '@/lib/dashboard/metrics';
import { buildWarChatBlurb, type WarSummary } from '@/lib/dashboard/war-summary';
import { getNextCronAt } from '@/lib/dashboard/cron';
import DataFreshness from '@/components/new-ui/DataFreshness';
import IngestionRefreshButton from '@/components/new-ui/IngestionRefreshButton';
import IngestionStatusCard from '@/components/new-ui/IngestionStatusCard';
import { formatWeeklySummaryForDiscord } from '@/lib/export-utils';
import {
  Users,
  Swords,
  TrendingUp,
  TrendingDown,
  Gift,
  UserPlus,
  AlertTriangle,
  ChevronRight,
  Activity,
  Crown,
  Shield,
  Clock,
  Zap,
  Star,
  Target,
  Flame,
  Trophy,
  Heart,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Info,
} from 'lucide-react';

interface DashboardClientProps {
  initialData: DashboardData;
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface KPITileProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  href?: string;
}

// Tooltip content definitions
const TOOLTIP_CONTENT = {
  members: 'Total number of players currently in the clan. Active members are those with Very Active or Active status based on recent donations, war participation, and capital raids.',
  avgVipScore: 'Average VIP (Very Important Player) Score across all clan members. VIP Score (0-100) measures overall contribution: 50% Competitive (Ranked + War), 30% Support (Donations + Capital), 20% Development (Base Quality + Activity). Higher is better.',
  donations: 'Total troops donated by all clan members this season. This resets at the start of each season. High donation totals indicate strong clan support and activity.',
  newJoiners: 'Number of players who joined the clan in the last 7 days. New joiners may need welcome messages and evaluation before participating in wars.',
  vipKing: 'Player with the highest VIP Score this week. VIP Score measures overall contribution across competitive play, support activities, and base development.',
  mostImproved: 'Player with the biggest increase in VIP Score compared to last week. Shows who is actively improving their contribution to the clan.',
  donationKing: 'Player who has donated the most troops this season. High donations show strong support for clan members.',
  trophyLeader: 'Player with the highest ranked battle trophies this season. Ranked battles are the competitive mode that resets weekly.',
  momentum: 'Clan momentum measures whether more members are improving (rising) or declining. Calculated from VIP score trends across all members. Rising = more members improving, Declining = more members dropping, Stable = balanced.',
  warReadiness: 'Activity-based war readiness. Ready = Very Active/Active, Moderate = Moderate activity, Low = Low activity, Inactive = not participating. This does not track hero upgrade timers.',
  topPerformers: 'Top 5 players ranked by VIP Score. VIP Score combines competitive performance (ranked battles + wars), support activities (donations + capital), and development (base quality + activity).',
  activityBreakdown: 'Distribution of clan members by activity level. Very Active = high engagement across all metrics, Active = good participation, Moderate = average, Low = below average, Inactive = minimal or no activity.',
};

interface TooltipLabelProps {
  children: React.ReactNode;
  tooltipKey: keyof typeof TOOLTIP_CONTENT;
}

function TooltipLabel({ children, tooltipKey }: TooltipLabelProps) {
  return (
    <Tooltip content={TOOLTIP_CONTENT[tooltipKey]} maxWidthPx={420}>
      <div className="inline-flex items-center gap-1 cursor-help">
        {children}
        <Info className="w-3 h-3 text-slate-500" />
      </div>
    </Tooltip>
  );
}

function KPITile({ label, value, subtext, icon, trend, href }: KPITileProps) {
  // Map label to tooltip key
  const tooltipKey = label === 'Members' ? 'members' :
                     label === 'Avg VIP Score' ? 'avgVipScore' :
                     label === 'Donations' ? 'donations' :
                     label === 'New Joiners' ? 'newJoiners' : null;

  const labelContent = tooltipKey ? (
    <TooltipLabel tooltipKey={tooltipKey as keyof typeof TOOLTIP_CONTENT}>
      <span>{label}</span>
    </TooltipLabel>
  ) : label;

  const content = (
    <div className="flex items-start gap-3">
      <div className="rounded-xl p-2.5 shadow-lg" style={{ background: 'var(--panel)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{labelContent}</div>
        <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
          {value}
          {trend && (
            <span className={`text-sm ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </span>
          )}
        </div>
        {subtext && <div className="text-xs text-slate-500 mt-1 font-medium">{subtext}</div>}
      </div>
      {href && <ChevronRight className="w-4 h-4 text-slate-500 self-center" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="hover:border-cyan-500/30 transition-colors cursor-pointer">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}

interface QuickActionProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  tone?: 'primary' | 'ghost';
}

function QuickAction({ label, description, icon, href, tone = 'ghost' }: QuickActionProps) {
  return (
    <Link href={href}>
      <Button tone={tone} className="w-full justify-start text-left h-auto py-3 px-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs opacity-70 font-normal">{description}</div>
          </div>
        </div>
      </Button>
    </Link>
  );
}

function DataFreshnessIndicator({ lastUpdated }: { lastUpdated: string | null }) {
  const nextCron = getNextCronAt(new Date());
  const nextCronText = nextCron.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' UTC';

  return (
    <DataFreshness
      at={lastUpdated}
      modeLabel="Data as of"
      subline={`Next cron: ${nextCronText}`}
      className=""
    />
  );
}

// Spotlight Card Component
interface SpotlightCardProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  member: RosterMember | null;
  stat: string;
  statLabel: string;
  tooltipKey?: keyof typeof TOOLTIP_CONTENT;
}

function SpotlightCard({ title, icon, iconBg, member, stat, statLabel, tooltipKey }: SpotlightCardProps) {
  if (!member) return null;
  
  const titleContent = tooltipKey ? (
    <TooltipLabel tooltipKey={tooltipKey}>
      <span>{title}</span>
    </TooltipLabel>
  ) : title;
  
  return (
    <Link href={`/new/player/${encodeURIComponent(member.tag)}`} className="block group">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.15] bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 shadow-lg transition-all hover:border-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-500/20 hover:scale-[1.02]">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40" style={{ background: iconBg }} />
        
        <div className="relative space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="rounded-xl p-2" style={{ background: iconBg }}>
              {icon}
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{titleContent}</span>
          </div>
          
          {/* Content */}
          <div className="space-y-3">
            {/* Player Info */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-base truncate" title={member.name}>{member.name}</div>
                <div className="text-xs text-slate-500 font-medium">Town Hall {member.townHallLevel}</div>
              </div>
            </div>
            
            {/* Stat Display */}
            <div className="flex items-baseline gap-2 pt-2 border-t border-white/5">
              <div className="text-3xl font-bold text-white" style={{ 
                background: iconBg,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{stat}</div>
              <div className="text-sm text-slate-400 font-medium">{statLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Momentum Meter Component
interface MomentumMeterProps {
  score: number; // -100 to 100
  label: string;
  description: string;
}

function MomentumMeter({ score, label, description }: MomentumMeterProps) {
  const normalizedScore = Math.max(-100, Math.min(100, score));
  const percentage = ((normalizedScore + 100) / 200) * 100;
  
  const getColor = () => {
    if (normalizedScore > 20) return { bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/50' };
    if (normalizedScore > -20) return { bg: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/50' };
    return { bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/50' };
  };
  
  const colors = getColor();
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {normalizedScore > 20 ? (
            <TrendingUp className={`w-5 h-5 ${colors.text}`} />
          ) : normalizedScore < -20 ? (
            <TrendingDown className={`w-5 h-5 ${colors.text}`} />
          ) : (
            <Activity className={`w-5 h-5 ${colors.text}`} />
          )}
          <span className={`font-bold ${colors.text}`}>{label}</span>
        </div>
        <span className="text-xs text-slate-400">{description}</span>
      </div>
      
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500 z-10" />
        
        {/* Fill from center */}
        <div 
          className={`absolute top-0 bottom-0 ${colors.bg} transition-all duration-500`}
          style={{
            left: normalizedScore >= 0 ? '50%' : `${percentage}%`,
            width: `${Math.abs(normalizedScore) / 2}%`,
          }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-slate-500">
        <span>Declining</span>
        <span>Stable</span>
        <span>Rising</span>
      </div>
    </div>
  );
}

// War Readiness Component
interface WarReadinessProps {
  ready: number;
  moderate: number;
  low: number;
  inactive: number;
  total: number;
}

function WarReadiness({ ready, moderate, low, inactive, total }: WarReadinessProps) {
  const segments = [
    { count: ready, color: 'bg-emerald-500', label: 'Ready', icon: <CheckCircle className="w-3 h-3" /> },
    { count: moderate, color: 'bg-amber-500', label: 'Moderate', icon: <AlertCircle className="w-3 h-3" /> },
    { count: low, color: 'bg-orange-500', label: 'Low', icon: <AlertTriangle className="w-3 h-3" /> },
    { count: inactive, color: 'bg-red-500', label: 'Inactive', icon: <XCircle className="w-3 h-3" /> },
  ];
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="space-y-3">
      {/* Visual Bar */}
      <div className="flex h-4 rounded-full overflow-hidden">
        {segments.map((seg, idx) => (
          seg.count > 0 && (
            <div
              key={idx}
              className={`${seg.color} transition-all`}
              style={{ width: `${(seg.count / safeTotal) * 100}%` }}
            />
          )
        ))}
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${seg.color} flex items-center justify-center text-white`}>
              {seg.icon}
            </div>
            <span className="text-xs text-slate-400">{seg.label}</span>
            <span className="text-xs font-bold text-white ml-auto">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const formatNumber = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—'
);

const formatPercent = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—'
);

function ActiveWarCard({ warSummary, isLeader }: { warSummary: WarSummary; isLeader: boolean }) {
  const activeWar = warSummary.activeWar;
  const hasActiveWar = Boolean(activeWar);
  const isPlanning = activeWar?.state === 'preparation';
  const [copied, setCopied] = useState(false);

  const ctaLabel = hasActiveWar
    ? isPlanning && isLeader ? 'Open war planner' : 'View war'
    : isLeader ? 'Open war planner' : 'View war results';
  const ctaHref = hasActiveWar
    ? (isPlanning && isLeader ? '/new/war/planning' : '/new/war/active')
    : isLeader ? '/new/war/planning' : '/new/war/results';

  const handleCopy = async () => {
    if (!activeWar || typeof navigator === 'undefined') return;
    const text = buildWarChatBlurb(activeWar);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Active War</div>
          {hasActiveWar ? (
            <>
              <div className="text-lg font-semibold text-white mt-1">
                {activeWar?.opponentName ? `vs ${activeWar.opponentName}` : 'Opponent pending'}
                {activeWar?.teamSize ? ` (${activeWar.teamSize}v${activeWar.teamSize})` : ''}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Status: <span className="text-slate-200">{activeWar?.stateLabel}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold text-white mt-1">No active war</div>
              <div className="text-sm text-slate-400 mt-1">
                Get the next matchup ready or review the latest results.
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveWar && isLeader && (
            <Button tone="ghost" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy chat blurb'}
            </Button>
          )}
          <Link href={ctaHref}>
            <Button tone="primary">{ctaLabel}</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function WhileYouWereAway({ review }: { review: LeaderReviewSummary | null }) {
  if (!review) return null;

  const joiners = review.joiners.slice(0, 4);
  const departures = review.departures.slice(0, 4);
  const isEmpty = joiners.length === 0 && departures.length === 0;
  
  return (
    <Card title={`While you were away (last ${review.timeframeDays} days)`}>
      {isEmpty ? (
        <div className="text-sm text-slate-400">No new joiners or departures logged.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
              New Joiners {review.joiners.length ? `(${review.joiners.length})` : ''}
            </div>
            {joiners.length ? (
              <div className="space-y-2">
                {joiners.map((item) => (
                  <div key={item.tag} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="mt-0.5 text-emerald-400">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                      <div className="text-xs text-slate-400">
                        {item.occurredAt
                          ? `Joined ${formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}`
                          : item.detail ?? 'Joined recently'}
                      </div>
                      {item.flags?.nameChanged && item.flags?.previousName ? (
                        <div className="text-xs text-slate-500">Previous: {item.flags.previousName}</div>
                      ) : null}
                      <div className="text-xs text-slate-500 font-mono">{item.tag}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
                      {item.flags?.returning ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">Returning</span>
                      ) : null}
                      {item.flags?.warnings ? (
                        <span className="inline-flex items-center gap-1 text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          {item.flags.warnings}
                        </span>
                      ) : null}
                      {item.flags?.notes ? <span className="text-amber-300">{item.flags.notes} notes</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No new joiners.</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
              Departures {review.departures.length ? `(${review.departures.length})` : ''}
            </div>
            {departures.length ? (
              <div className="space-y-2">
                {departures.map((item) => (
                  <div key={item.tag} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="mt-0.5 text-rose-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                      <div className="text-xs text-slate-400">
                        {item.occurredAt
                          ? `Departed ${formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}`
                          : item.detail ?? 'Departure logged'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{item.tag}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No departures in range.</div>
            )}
          </div>
        </div>
      )}
      <div className="mt-4">
        <Link href="/new/leadership/dashboard">
          <Button tone="ghost">Review leadership queue</Button>
        </Link>
      </div>
    </Card>
  );
}

function LeadershipAlerts({ metrics }: { metrics: DashboardMetrics }) {
  if (!metrics.alerts.length) return null;

  const iconFor = (type: DashboardMetrics['alerts'][number]['type']) => {
    switch (type) {
      case 'donation':
        return <Gift className="w-4 h-4 text-purple-400" />;
      case 'vip_drop':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'new_joiner':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <Card title="Leadership Alerts">
      <div className="space-y-2">
        {metrics.alerts.slice(0, 4).map((alert) => (
          <Link
            key={`${alert.type}-${alert.member.tag}`}
            href={`/new/player/${encodeURIComponent(alert.member.tag)}`}
            className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/5 p-3 hover:bg-white/10 transition-colors"
          >
            <div className="mt-0.5">{iconFor(alert.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{alert.member.name}</div>
              <div className="text-xs text-slate-400">{alert.message}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function ClanHealthSnapshot({ summary }: { summary: ClanHealthSummary }) {
  const recordLabel = summary.warRecord
    ? `${summary.warRecord.wins}-${summary.warRecord.losses}-${summary.warRecord.ties}`
    : '—';
  const avgStars = summary.averageStarsPerAttack != null ? summary.averageStarsPerAttack.toFixed(2) : '—';
  const donationsGiven = summary.donationsGiven != null ? summary.donationsGiven.toLocaleString() : '—';
  const donationsReceived = summary.donationsReceived != null ? summary.donationsReceived.toLocaleString() : '—';
  const activeShare = summary.totalMembers > 0
    ? Math.round((summary.activeMembers / summary.totalMembers) * 100)
    : null;

  return (
    <Card title="Clan Health Snapshot">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500">War Record (last 10)</div>
          <div className="text-lg font-semibold text-white mt-1">{recordLabel}</div>
          <div className="text-xs text-slate-400 mt-1">Avg stars/attack: {avgStars}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500">Donations</div>
          <div className="text-lg font-semibold text-white mt-1">
            {donationsGiven} / {donationsReceived}
          </div>
          <div className="text-xs text-slate-400 mt-1">Given vs received (season)</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500">Live Participation</div>
          <div className="text-lg font-semibold text-white mt-1">
            {summary.activeMembers} / {summary.totalMembers}
          </div>
          <div className="text-xs text-slate-400 mt-1">Contributing members: {formatPercent(activeShare)}</div>
        </div>
      </div>
    </Card>
  );
}

function MySnapshotCard({ member }: { member: RosterMember | null }) {
  if (!member) {
    return (
      <Card title="My Snapshot">
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-400 italic">
            You aren&apos;t linked to a Clash player yet.
          </div>
          <Link href="/new/roster">
            <Button tone="ghost" size="sm" className="w-full">
              Find my name
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const heroLines = [
    member.bk != null ? `BK ${member.bk}` : null,
    member.aq != null ? `AQ ${member.aq}` : null,
    member.gw != null ? `GW ${member.gw}` : null,
    member.rc != null ? `RC ${member.rc}` : null,
    member.mp != null ? `MP ${member.mp}` : null,
  ].filter(Boolean) as string[];

  const heroAverages = (member as any)._clanHeroAverages || {};

  return (
    <Card title="My Snapshot">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">VIP Score</span>
          <span className="text-white font-semibold">{member.vip?.score?.toFixed(1) ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Activity</span>
          <span className="text-white font-semibold">{member.activity?.level ?? 'Unknown'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Donations</span>
          <span className="text-white font-semibold">{member.donations != null ? member.donations.toLocaleString() : '—'}</span>
        </div>
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Hero Levels vs Clan Avg</div>
          <div className="grid grid-cols-5 gap-1">
            {['bk', 'aq', 'gw', 'rc', 'mp'].map((h) => {
              const val = (member as any)[h];
              const avgData = (heroAverages as any)?.[h];
              const avg = typeof avgData === 'object' ? avgData.average : avgData;
              if (val == null && !avg) return null;
              return (
                <div key={h} className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase">{h}</div>
                  <div className="text-xs font-bold text-white">{val ?? '—'}</div>
                  {avg && <div className="text-[9px] text-slate-600">avg {Math.round(avg)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ComparisonCard({ member, metrics }: { member: RosterMember | null; metrics: DashboardMetrics }) {
  const memberVip = member?.vip?.score ?? null;
  const memberDonations = member?.donations ?? null;
  const memberActivity = member?.activity?.score ?? null;

  return (
    <Card title="You vs Clan Average">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">VIP Score</span>
          <span className="text-white font-semibold">
            {memberVip != null ? memberVip.toFixed(1) : '—'} / {metrics.avgVipScore != null ? metrics.avgVipScore.toFixed(1) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Donations</span>
          <span className="text-white font-semibold">
            {formatNumber(memberDonations)} / {metrics.avgDonationsGiven != null ? metrics.avgDonationsGiven.toFixed(0) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Activity Score</span>
          <span className="text-white font-semibold">
            {formatNumber(memberActivity)} / {metrics.avgActivityScore != null ? metrics.avgActivityScore.toFixed(0) : '—'}
          </span>
        </div>
      </div>
    </Card>
  );
}

interface ActivityBreakdownProps {
  breakdown: Record<string, number>;
  total: number;
}

function ActivityBreakdownChart({ breakdown, total }: ActivityBreakdownProps) {
  const categories = [
    { label: 'Very Active', key: 'Very Active', color: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
    { label: 'Active', key: 'Active', color: 'bg-cyan-500', glow: 'shadow-cyan-500/20' },
    { label: 'Moderate', key: 'Moderate', color: 'bg-amber-500', glow: 'shadow-amber-500/20' },
    { label: 'Low', key: 'Low', color: 'bg-orange-500', glow: 'shadow-orange-500/20' },
    { label: 'Inactive', key: 'Inactive', color: 'bg-red-500', glow: 'shadow-red-500/20' },
  ];

  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {categories.map((cat) => {
          const count = breakdown[cat.key] || 0;
          if (count === 0) return null;
          return (
            <div
              key={cat.key}
              className={`${cat.color} transition-all duration-500`}
              style={{ width: `${(count / safeTotal) * 100}%` }}
            />
          );
        })}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {categories.map((cat) => {
          const count = breakdown[cat.key] || 0;
          return (
            <div key={cat.key} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${cat.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-[10px] font-medium text-slate-400 truncate">{cat.label}</span>
                  <span className="text-xs font-bold text-white">{count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const roster = initialData.roster;
  const metrics = initialData.metrics;
  const warSummary = initialData.warSummary;
  const clanHealth = initialData.clanHealth;
  const leaderReview = initialData.leaderReview;
  const currentUser = useDashboardStore((state) => state.currentUser);
  const userRoles = useDashboardStore((state) => state.userRoles);
  const canManageClanData = useDashboardStore((state) => state.canManageClanData());
  const canSeeLeadership = useDashboardStore((state) => state.canSeeLeadershipFeatures());
  const hydrateSession = useDashboardStore((state) => state.hydrateSession);

  const currentClanTag = roster?.clanTag ? normalizeTag(roster.clanTag) : null;
  const roleForClan = useMemo(() => {
    if (!currentClanTag) return null;
    return userRoles.find((role) => role.clan_tag === currentClanTag) || null;
  }, [currentClanTag, userRoles]);

  const currentPlayerTag = roleForClan?.player_tag ? normalizeTag(roleForClan.player_tag) : null;
  const currentMember = useMemo(() => {
    if (!roster?.members?.length) return null;
    if (currentPlayerTag) {
      return roster.members.find((member) => normalizeTag(member.tag) === currentPlayerTag) ?? null;
    }
    if (currentUser?.name) {
      const normalizedName = currentUser.name.trim().toLowerCase();
      return roster.members.find((member) => member.name?.trim().toLowerCase() === normalizedName) ?? null;
    }
    return null;
  }, [currentPlayerTag, currentUser?.name, roster?.members]);

  const welcomeName = currentMember?.name || currentUser?.name || currentUser?.email?.split('@')[0] || (currentPlayerTag ? 'Chief' : 'Link your profile');
  const roleValue = roleForClan?.role ?? 'member';
  const roleLabel = roleValue.replace('coleader', 'co-leader');
  const isLeader = roleValue === 'leader' || roleValue === 'coleader';
  const canShareSummary = metrics.avgTrophies != null && metrics.totalDonations != null;
  const [summaryCopied, setSummaryCopied] = useState(false);

  const [cocHealth, setCocHealth] = useState<null | {
    success: boolean;
    error?: string;
    data?: { clanTag: string; status: 'ok' | 'invalid_ip' | 'error'; httpStatus?: number | null };
  }>(null);

  // Profile linking is handled via /join (search by name → token verify).

  useEffect(() => {
    const controller = new AbortController();
    const clanParam = currentClanTag ? `?clanTag=${encodeURIComponent(currentClanTag)}` : '';

    fetch(`/api/coc/health${clanParam}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setCocHealth(json))
      .catch(() => {
        // Ignore (offline / aborted). We only use this for dashboard visibility.
      });

    return () => controller.abort();
  }, [currentClanTag]);

  // (Linking UI moved to /join)

  // Empty state
  if (!roster) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome to Clash Intelligence</p>
        </div>
        
        <Card>
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Clan Data Available</h3>
            <p className="text-slate-400 text-sm mb-4">
              Data will be available after the next ingestion run.
            </p>
            <Link href="/new/roster">
              <Button tone="primary">View Roster</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const momentumLabel = metrics.momentumScore > 20 ? 'Rising' 
    : metrics.momentumScore < -20 ? 'Declining' 
    : 'Stable';
  
  const momentumDesc = metrics.momentumScore > 20 ? 'Clan is on the upswing!' 
    : metrics.momentumScore < -20 ? 'Needs attention' 
    : 'Holding steady';

  return (
    <div className="space-y-6">
      {cocHealth && cocHealth.success === false && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">Clash of Clans API connectivity issue</div>
              <div className="text-sm text-slate-300 mt-1">
                {cocHealth.data?.status === 'invalid_ip'
                  ? 'The CoC API key is blocked from this server IP (allowlist mismatch). Ingestion may write incorrect zeros until the IPs are updated or Fixie fallback is enabled.'
                  : 'The server could not reach the CoC API. Ingestion may be stale or incomplete.'}
              </div>
              {cocHealth.error && (
                <div className="text-xs text-slate-400 mt-2 font-mono break-words">
                  {cocHealth.error}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{roster.clanName}</h1>
          <p className="text-slate-400 mt-1">
            <span className="font-mono text-sm">{roster.clanTag}</span>
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <DataFreshnessIndicator lastUpdated={roster.lastUpdated ?? roster.date} />
          {isLeader && canManageClanData && roster.clanTag ? (
            <IngestionRefreshButton
              clanTag={roster.clanTag}
              enabled={true}
              onCompleted={() => {
                // Reload the dashboard page to refresh server-loaded SSOT data
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Active War */}
      <ActiveWarCard warSummary={warSummary} isLeader={isLeader} />

      {/* Welcome + Your Stats + Next Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  {currentPlayerTag ? 'Welcome back' : 'First time here?'}
                </div>
                <div className="text-2xl font-semibold text-white mt-1">{welcomeName}</div>
                <div className="text-sm text-slate-400 mt-1">
                  {currentPlayerTag ? (
                    <>Role: <span className="capitalize text-slate-200">{roleLabel}</span> ·{' '}</>
                  ) : (
                    <span className="text-cyan-300">Unlock your personal dashboard in two steps:</span>
                  )}
                  Clan: <span className="text-slate-200">{roster.clanName}</span>
                </div>
              </div>
              {currentMember ? (
                <Link href={`/new/player/${encodeURIComponent(currentMember.tag)}`}>
                  <Button tone="primary">View your profile</Button>
                </Link>
              ) : (
                <div className="hidden sm:block">
                  <Link href="/new/roster">
                    <Button tone="ghost" size="sm">Find my name</Button>
                  </Link>
                </div>
              )}
            </div>

            {!currentPlayerTag ? (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-24 h-24 text-cyan-400 rotate-12" />
                </div>

                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-cyan-400">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-lg">Link your profile</div>
                    <div className="text-sm text-slate-300 mt-1 leading-relaxed">
                      Use the login flow to find your account by <span className="text-white font-medium">in-game name</span>,
                      then verify ownership with your <span className="text-white font-medium">API Token</span>.
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <Link href="/join">
                        <Button tone="primary">Go to login</Button>
                      </Link>
                      <Link href="/new/roster">
                        <Button tone="ghost">Browse roster</Button>
                      </Link>
                    </div>
                    <div className="mt-3 text-xs text-slate-400 italic">
                      Token is only used once to prove you own the account.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <MySnapshotCard member={currentMember} />
      </div>

      {!isLeader && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ComparisonCard member={currentMember} metrics={metrics} />
        <Card>
            <div className="text-xs uppercase tracking-widest text-slate-500">Your Next Action</div>
            <div className="text-lg font-semibold text-white mt-1">Check your current standing</div>
            <div className="text-sm text-slate-400 mt-1">
              See how your VIP score and activity stack up this week.
              </div>
            <div className="mt-4">
              {currentMember ? (
                <Link href={`/new/player/${encodeURIComponent(currentMember.tag)}`}>
                  <Button tone="primary">View your stats</Button>
                </Link>
              ) : (
                <Link href="/new/roster">
                  <Button tone="ghost">Go to roster</Button>
                </Link>
              )}
            </div>
        </Card>
      </div>
      )}

      {isLeader && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WhileYouWereAway review={leaderReview ?? { timeframeDays: 7, joiners: [], departures: [] }} />
          <ClanHealthSnapshot summary={clanHealth} />
        </div>
      )}

      {isLeader && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadershipAlerts metrics={metrics} />
          <IngestionStatusCard clanTag={roster.clanTag} />
        </div>
      )}

      {isLeader && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Share Weekly Summary">
            <div className="text-sm text-slate-400">
              Generate a Discord-ready clan summary using the latest roster snapshot.
            </div>
            <div className="mt-4">
              <Button
                tone="ghost"
                disabled={!canShareSummary}
                onClick={async () => {
                  if (!canShareSummary || typeof navigator === 'undefined') return;
                  const payload = formatWeeklySummaryForDiscord({
                    totalMembers: metrics.totalMembers,
                    activeMembers: metrics.activeMembers,
                    totalDonations: metrics.totalDonations ?? 0,
                    avgTrophies: metrics.avgTrophies ?? 0,
                    warWins: warSummary.record?.wins,
                    warLosses: warSummary.record?.losses,
                    topDonors: metrics.topDonors,
                    topTrophyGainers: metrics.topTrophyGainers,
                  });
                  try {
                    await navigator.clipboard.writeText(payload);
                    setSummaryCopied(true);
                    window.setTimeout(() => setSummaryCopied(false), 2000);
                  } catch {
                    setSummaryCopied(false);
                  }
                }}
              >
                {summaryCopied ? 'Summary copied' : 'Copy Discord summary'}
              </Button>
              {!canShareSummary && (
                <div className="text-xs text-slate-500 mt-2">
                  Summary is unavailable until trophies and donations are populated.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {isLeader && (
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Your Next Action</div>
              <div className="text-lg font-semibold text-white mt-1">Review roster health</div>
            <div className="text-sm text-slate-400 mt-1">
                Scan donations, activity, and VIP trends before the next war.
            </div>
          </div>
          <div>
              <Link href="/new/roster">
                <Button tone="primary">Open roster</Button>
              </Link>
          </div>
        </div>
      </Card>
      )}

      {/* ========== PLAYER SPOTLIGHTS ========== */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Player Spotlights</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SpotlightCard
            title="VIP of the Week"
            icon={<Crown className="w-4 h-4 text-amber-900" />}
            iconBg="linear-gradient(135deg, #fbbf24, #f59e0b)"
            member={metrics.vipKing}
            stat={metrics.vipKing?.vip?.score?.toFixed(1) ?? '–'}
            statLabel="VIP Score"
            tooltipKey="vipKing"
          />
          <SpotlightCard
            title="Most Improved"
            icon={<TrendingUp className="w-4 h-4 text-emerald-900" />}
            iconBg="linear-gradient(135deg, #34d399, #10b981)"
            member={metrics.mostImproved}
            stat={metrics.mostImproved?.vip ? `+${(metrics.mostImproved.vip.score - (metrics.mostImproved.vip.last_week_score ?? 0)).toFixed(1)}` : '–'}
            statLabel="This Week"
            tooltipKey="mostImproved"
          />
          <SpotlightCard
            title="Donation King"
            icon={<Gift className="w-4 h-4 text-purple-900" />}
            iconBg="linear-gradient(135deg, #a78bfa, #8b5cf6)"
            member={metrics.donationKing}
            stat={metrics.donationKing?.donations != null ? metrics.donationKing.donations.toLocaleString() : '–'}
            statLabel="Donated"
            tooltipKey="donationKing"
          />
          <SpotlightCard
            title="Trophy Leader"
            icon={<Trophy className="w-4 h-4 text-cyan-900" />}
            iconBg="linear-gradient(135deg, #22d3ee, #06b6d4)"
            member={metrics.trophyKing}
            stat={(metrics.trophyKing?.resolvedTrophies ?? metrics.trophyKing?.seasonTotalTrophies ?? metrics.trophyKing?.rankedTrophies)?.toLocaleString() ?? '–'}
            statLabel="Trophies"
            tooltipKey="trophyLeader"
          />
        </div>
      </div>

      {/* ========== KPI TILES ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          label="Members"
          value={metrics.totalMembers}
          subtext={`${metrics.activeMembers} very active`}
          icon={<Users className="w-5 h-5 text-cyan-400" />}
          href="/new/roster"
        />
        <KPITile
          label="Avg VIP Score"
          value={metrics.avgVipScore ?? '—'}
          subtext="Clan average"
          icon={<Zap className="w-5 h-5 text-amber-400" />}
          href="/new/member-performance"
        />
        <KPITile
          label="Donations"
          value={metrics.totalDonations != null ? metrics.totalDonations.toLocaleString() : '—'}
          subtext="This season"
          icon={<Gift className="w-5 h-5 text-emerald-400" />}
        />
        <KPITile
          label="New Joiners"
          value={metrics.newJoiners}
          subtext="Last 7 days"
          icon={<UserPlus className="w-5 h-5 text-purple-400" />}
          href="/new/roster?filter=new-joiners"
        />
      </div>

      {/* ========== MAIN GRID ========== */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Momentum Meter */}
          <Card title={
            <TooltipLabel tooltipKey="momentum">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Clan Momentum</span>
              </div>
            </TooltipLabel>
          }>
            <MomentumMeter
              score={metrics.momentumScore}
              label={momentumLabel}
              description={momentumDesc}
            />
          </Card>

          {/* War Readiness */}
          <Card title={
            <TooltipLabel tooltipKey="warReadiness">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-red-400" />
                <span>War Readiness</span>
              </div>
            </TooltipLabel>
          }>
            <WarReadiness
              ready={metrics.warReadiness.ready}
              moderate={metrics.warReadiness.moderate}
              low={metrics.warReadiness.low}
              inactive={metrics.warReadiness.inactive}
              total={metrics.totalMembers}
            />
          </Card>

          {/* Town Hall Distribution */}
          <Card title="Town Hall Distribution">
            <div className="flex items-end gap-1 h-32 pt-4">
              {Object.entries(metrics.thDistribution)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([th, count]) => (
                  <div key={th} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full relative flex flex-col justify-end h-full">
                      <div 
                        className="bg-cyan-500/40 border-t-2 border-cyan-400 rounded-t-sm w-full transition-all group-hover:bg-cyan-500/60"
                        style={{ height: `${(count / metrics.totalMembers) * 100}%` }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap z-10">
                          {count} players
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">TH{th}</span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Activity Breakdown */}
          <Card title={
            <TooltipLabel tooltipKey="activityBreakdown">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Clan Activity Breakdown</span>
              </div>
            </TooltipLabel>
          }>
            <ActivityBreakdownChart 
              breakdown={metrics.activityBreakdown} 
              total={metrics.totalMembers} 
            />
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="grid sm:grid-cols-2 gap-3">
              <QuickAction
                label="View Roster"
                description="See all clan members"
                icon={<Users className="w-5 h-5 text-cyan-400" />}
                href="/new/roster"
                tone="primary"
              />
              {isLeader && canManageClanData && (
                <QuickAction
                  label="War Planning"
                  description="Plan upcoming wars"
                  icon={<Swords className="w-5 h-5 text-red-400" />}
                  href="/new/war/planning"
                />
              )}
              <QuickAction
                label="Member Performance"
                description="VIP scores & analytics"
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                href="/new/member-performance"
              />
              {canSeeLeadership && (
                <QuickAction
                  label="Player Database"
                  description="Notes & warnings"
                  icon={<Shield className="w-5 h-5 text-purple-400" />}
                  href="/new/player-database"
                />
              )}
              {isLeader && canSeeLeadership && (
                <QuickAction
                  label="Review Leadership Queue"
                  description="Joiners, departures, warnings"
                  icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
                  href="/new/leadership/dashboard"
                />
              )}
            </div>
          </Card>

          {/* Top Performers */}
          <Card title={
            <TooltipLabel tooltipKey="topPerformers">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Top Performers</span>
              </div>
            </TooltipLabel>
          }>
            {metrics.topPerformers.length > 0 ? (
              <div className="space-y-2">
                {metrics.topPerformers.map((member, idx) => (
                  <Link
                    key={member.tag}
                    href={`/new/player/${encodeURIComponent(member.tag)}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500 text-black' :
                      idx === 1 ? 'bg-slate-300 text-black' :
                      idx === 2 ? 'bg-amber-700 text-white' :
                      'bg-slate-600 text-white'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{member.name}</div>
                      <div className="text-xs text-slate-500">TH{member.townHallLevel}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-cyan-400">{member.vip?.score ?? '–'}</div>
                      <div className="text-xs text-slate-500">
                        {member.vip?.trend === 'up' && <span className="text-emerald-400">↑</span>}
                        {member.vip?.trend === 'down' && <span className="text-red-400">↓</span>}
                        {member.vip?.trend === 'stable' && <span className="text-slate-400">→</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No VIP scores available yet.</p>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Clan Composition */}
          <Card title="Clan Composition">
            <div className="space-y-2">
              {Object.entries(metrics.thDistribution)
                .sort(([a], [b]) => Number(b) - Number(a))
                .slice(0, 6)
                .map(([th, count]) => (
                  <div key={th} className="flex items-center gap-3">
                    <div className="w-8 text-xs font-mono text-slate-400">TH{th}</div>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                        style={{ width: `${(count / metrics.totalMembers) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-right text-slate-400">{count}</div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Activity Summary */}
          <Card title={
            <TooltipLabel tooltipKey="activityBreakdown">
              <span>Activity Breakdown</span>
            </TooltipLabel>
          }>
            <div className="space-y-3">
              {['Very Active', 'Active', 'Moderate', 'Low', 'Inactive'].map((level) => {
                const count = metrics.activityBreakdown[level] || 0;
                const percentage = metrics.totalMembers > 0 ? Math.round((count / metrics.totalMembers) * 100) : 0;
                const color = level === 'Very Active' ? 'bg-emerald-500' :
                              level === 'Active' ? 'bg-cyan-500' :
                              level === 'Moderate' ? 'bg-amber-500' :
                              level === 'Low' ? 'bg-orange-500' : 'bg-red-500';
                
                return (
                  <div key={level} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <div className="flex-1 text-sm text-slate-300">{level}</div>
                    <div className="text-sm font-medium text-white">{count}</div>
                    <div className="text-xs text-slate-500 w-8 text-right">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
