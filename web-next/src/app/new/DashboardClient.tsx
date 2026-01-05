"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import type { RosterData, RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import { formatDistanceToNow } from 'date-fns';
import { normalizeTag } from '@/lib/tags';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
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
  initialRoster: RosterData | null;
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
  position?: 'top' | 'bottom' | 'left' | 'right';
}

function TooltipLabel({ children, tooltipKey, position = 'top' }: TooltipLabelProps) {
  return (
    <Tooltip content={TOOLTIP_CONTENT[tooltipKey]} position={position} maxWidth="max-w-md">
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
  if (!lastUpdated) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        <span>No data available</span>
      </div>
    );
  }

  const date = new Date(lastUpdated);
  const isRecent = Date.now() - date.getTime() < 24 * 60 * 60 * 1000;

  return (
    <div className={`flex items-center gap-2 text-xs ${isRecent ? 'text-emerald-400' : 'text-amber-400'}`}>
      <div className={`w-2 h-2 rounded-full ${isRecent ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
      <span>Data as of {formatDistanceToNow(date, { addSuffix: true })}</span>
    </div>
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

  return (
    <div className="space-y-3">
      {/* Visual Bar */}
      <div className="flex h-4 rounded-full overflow-hidden">
        {segments.map((seg, idx) => (
          seg.count > 0 && (
            <div
              key={idx}
              className={`${seg.color} transition-all`}
              style={{ width: `${(seg.count / total) * 100}%` }}
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

// Danger Alert Component
interface DangerAlertProps {
  type: 'inactive' | 'donation' | 'vip_drop' | 'new_joiner';
  member: RosterMember;
  message: string;
}

function DangerAlert({ type, member, message }: DangerAlertProps) {
  const config = {
    inactive: { icon: <Clock className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    donation: { icon: <Gift className="w-4 h-4" />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    vip_drop: { icon: <TrendingDown className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    new_joiner: { icon: <UserPlus className="w-4 h-4" />, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  };
  
  const c = config[type];
  
  return (
    <Link 
      href={`/new/player/${encodeURIComponent(member.tag)}`}
      className={`flex items-start gap-3 p-3 rounded-lg border ${c.bg} ${c.border} hover:bg-white/5 transition-colors`}
    >
      <div className={c.color}>{c.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">{member.name}</div>
        <div className="text-xs text-slate-400">{message}</div>
      </div>
    </Link>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardClient({ initialRoster }: DashboardClientProps) {
  const roster = initialRoster;
  const currentUser = useDashboardStore((state) => state.currentUser);
  const userRoles = useDashboardStore((state) => state.userRoles);

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

  const welcomeName = currentMember?.name || currentUser?.name || currentUser?.email?.split('@')[0] || 'there';
  const roleLabel = roleForClan?.role ? roleForClan.role.replace('coleader', 'co-leader') : 'member';
  const currentActivity = currentMember?.activity ?? null;

  // Calculate all dashboard metrics
  const metrics = useMemo(() => {
    if (!roster?.members?.length) {
      return {
        totalMembers: 0,
        avgVipScore: 0,
        activeMembers: 0,
        totalDonations: 0,
        newJoiners: 0,
        topPerformers: [] as RosterMember[],
        thDistribution: {} as Record<number, number>,
        // Spotlights
        vipKing: null as RosterMember | null,
        mostImproved: null as RosterMember | null,
        donationKing: null as RosterMember | null,
        trophyKing: null as RosterMember | null,
        // Momentum
        momentumScore: 0,
        // War Readiness
        warReady: 0,
        warModerate: 0,
        warLow: 0,
        warInactive: 0,
        // Alerts
        alerts: [] as DangerAlertProps[],
        // Activity breakdown
        activityBreakdown: {} as Record<string, number>,
      };
    }

    const members = roster.members;
    const membersWithActivity = members.map((member) => {
      const activity = member.activity ?? null;
      return {
        member,
        activity,
        level: activity?.level ?? 'Unknown',
      };
    });
    const totalMembers = members.length;

    // Average VIP score
    const membersWithVip = members.filter(m => m.vip?.score != null);
    const avgVipScore = membersWithVip.length > 0
      ? Math.round(membersWithVip.reduce((sum, m) => sum + (m.vip?.score ?? 0), 0) / membersWithVip.length)
      : null;

    // Active members
    const activeMembers = membersWithActivity.filter(({ level }) => (
      level === 'Very Active' || level === 'Active'
    )).length;

    // Total donations
    const sumIfComplete = (values: Array<number | null | undefined>) => {
      let sum = 0;
      let hasValue = false;
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          hasValue = true;
        } else {
          return null;
        }
      }
      return hasValue ? sum : null;
    };
    const totalDonations = sumIfComplete(members.map((m) => m.donations ?? null));

    // New joiners (tenure < 7 days)
    const newJoinersList = members.filter(m => {
      const tenure = m.tenureDays ?? m.tenure_days;
      return tenure != null && tenure <= 7;
    });
    const newJoiners = newJoinersList.length;

    // Top performers by VIP
    const topPerformers = [...members]
      .filter(m => m.vip?.score != null)
      .sort((a, b) => (b.vip?.score || 0) - (a.vip?.score || 0))
      .slice(0, 5);

    // TH distribution
    const thDistribution: Record<number, number> = {};
    members.forEach(m => {
      const th = m.townHallLevel;
      if (typeof th !== 'number' || !Number.isFinite(th)) return;
      thDistribution[th] = (thDistribution[th] || 0) + 1;
    });

    // ========== SPOTLIGHTS ==========
    // VIP King - highest VIP score
    const vipKing = [...members]
      .filter(m => m.vip?.score != null)
      .sort((a, b) => (b.vip?.score || 0) - (a.vip?.score || 0))[0] || null;

    // Most Improved - biggest VIP increase (if we have last_week_score)
    const mostImproved = [...members]
      .filter(m => m.vip?.score != null && m.vip?.last_week_score != null)
      .map(m => ({ member: m, improvement: (m.vip?.score || 0) - (m.vip?.last_week_score || 0) }))
      .filter(x => x.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)[0]?.member || null;

    // Donation King - highest donations
    const donationKing = [...members]
      .filter(m => typeof m.donations === 'number' && m.donations > 0)
      .sort((a, b) => (b.donations ?? 0) - (a.donations ?? 0))[0] || null;

    // Trophy King - highest ranked trophies this season
    const trophyKing = [...members]
      .map((m) => ({
        member: m,
        trophies: m.resolvedTrophies ?? m.seasonTotalTrophies ?? m.rankedTrophies ?? null,
      }))
      .filter((entry) => typeof entry.trophies === 'number' && Number.isFinite(entry.trophies))
      .sort((a, b) => (b.trophies ?? 0) - (a.trophies ?? 0))[0]?.member || null;

    // ========== MOMENTUM ==========
    // Calculate momentum based on VIP trends
    let upTrending = 0;
    let downTrending = 0;
    members.forEach(m => {
      if (m.vip?.trend === 'up') upTrending++;
      if (m.vip?.trend === 'down') downTrending++;
    });
    
    // Momentum score: -100 to +100
    const trendingMembers = upTrending + downTrending;
    const momentumScore = trendingMembers > 0 
      ? Math.round(((upTrending - downTrending) / totalMembers) * 100)
      : 0;

    // ========== WAR READINESS ==========
    // Simplified: based on activity and hero levels
    // In a real implementation, we'd check hero upgrade status
    const warReady = membersWithActivity.filter(({ level }) => (
      level === 'Very Active' || level === 'Active'
    )).length;
    const warModerate = membersWithActivity.filter(({ level }) => level === 'Moderate').length;
    const warLow = membersWithActivity.filter(({ level }) => level === 'Low').length;
    const warInactive = membersWithActivity.filter(({ level }) => level === 'Inactive').length;

    // ========== DANGER ALERTS ==========
    const alerts: DangerAlertProps[] = [];
    
    // Inactive warnings
    membersWithActivity
      .filter(({ level }) => level === 'Inactive')
      .slice(0, 3)
      .forEach(({ member }) => {
        const tenure =
          typeof member.tenureDays === 'number'
            ? member.tenureDays
            : typeof member.tenure_days === 'number'
              ? member.tenure_days
              : null;
        alerts.push({
          type: 'inactive',
          member,
          message: tenure != null && tenure > 30 ? 'Long-term member gone quiet' : 'Hasn\'t been active recently',
        });
      });
    
    // Donation leechers
    members
      .filter(m => {
        const received = m.donationsReceived;
        const given = m.donations;
        if (typeof received !== 'number' || typeof given !== 'number') return false;
        return received > 100 && given < 20 && received > given * 10;
      })
      .slice(0, 2)
      .forEach(m => {
        alerts.push({
          type: 'donation',
          member: m,
          message: `Received ${m.donationsReceived?.toLocaleString()}, donated ${m.donations?.toLocaleString()}`,
        });
      });
    
    // VIP drops
    members
      .filter(m => m.vip?.trend === 'down' && m.vip?.last_week_score)
      .map(m => ({ 
        member: m, 
        drop: (m.vip?.last_week_score || 0) - (m.vip?.score || 0) 
      }))
      .filter(x => x.drop > 10)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 2)
      .forEach(({ member: m, drop }) => {
        alerts.push({
          type: 'vip_drop',
          member: m,
          message: `VIP dropped ${drop} points this week`,
        });
      });
    
    // New joiners needing review
    newJoinersList.slice(0, 2).forEach(m => {
      const tenure =
        typeof m.tenureDays === 'number'
          ? m.tenureDays
          : typeof m.tenure_days === 'number'
            ? m.tenure_days
            : null;
      alerts.push({
        type: 'new_joiner',
        member: m,
        message: tenure != null ? `Joined ${tenure} days ago - needs welcome` : 'Needs welcome review',
      });
    });

    // ========== ACTIVITY BREAKDOWN ==========
    const activityBreakdown: Record<string, number> = {
      'Very Active': 0,
      'Active': 0,
      'Moderate': 0,
      'Low': 0,
      'Inactive': 0,
    };
    membersWithActivity.forEach(({ level }) => {
      if (level in activityBreakdown) {
        activityBreakdown[level]++;
      }
    });

    return {
      totalMembers,
      avgVipScore,
      activeMembers,
      totalDonations,
      newJoiners,
      topPerformers,
      thDistribution,
      vipKing,
      mostImproved,
      donationKing,
      trophyKing,
      momentumScore,
      warReady,
      warModerate,
      warLow,
      warInactive,
      alerts,
      activityBreakdown,
    };
  }, [roster]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{roster.clanName}</h1>
          <p className="text-slate-400 mt-1">
            <span className="font-mono text-sm">{roster.clanTag}</span>
          </p>
        </div>
        <DataFreshnessIndicator lastUpdated={roster.lastUpdated ?? roster.date} />
      </div>

      {/* Welcome + Your Stats + Next Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Welcome back</div>
              <div className="text-2xl font-semibold text-white mt-1">{welcomeName}</div>
              <div className="text-sm text-slate-400 mt-1">
                Role: <span className="capitalize text-slate-200">{roleLabel}</span> ·{' '}
                Clan: <span className="text-slate-200">{roster.clanName}</span>
              </div>
            </div>
            {currentMember ? (
              <Link href={`/new/player/${encodeURIComponent(currentMember.tag)}`}>
                <Button tone="primary">View your profile</Button>
              </Link>
            ) : (
              <Link href="/new/roster">
                <Button tone="ghost">Find your profile</Button>
              </Link>
            )}
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-widest text-slate-500">Your Stats</div>
          {currentMember ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">VIP Score</span>
                <span className="text-white font-semibold">{currentMember.vip?.score?.toFixed(1) ?? '–'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Activity</span>
                <span className="text-white font-semibold">{currentActivity?.level ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Donations</span>
                <span className="text-white font-semibold">{currentMember.donations != null ? currentMember.donations.toLocaleString() : '—'}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">
              We couldn’t match your account to a roster member yet.
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Your Next Action</div>
            <div className="text-lg font-semibold text-white mt-1">
              {roleLabel === 'leader' || roleLabel === 'coleader'
                ? 'Review roster health'
                : 'Check your current standing'}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {roleLabel === 'leader' || roleLabel === 'coleader'
                ? 'Scan donations, activity, and VIP trends before the next war.'
                : 'See how your VIP score and activity stack up this week.'}
            </div>
          </div>
          <div>
            {roleLabel === 'leader' || roleLabel === 'coleader' ? (
              <Link href="/new/roster">
                <Button tone="primary">Open roster</Button>
              </Link>
            ) : currentMember ? (
              <Link href={`/new/player/${encodeURIComponent(currentMember.tag)}`}>
                <Button tone="primary">View your stats</Button>
              </Link>
            ) : (
              <Link href="/new/roster">
                <Button tone="ghost">Go to roster</Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

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
          subtext={`${metrics.activeMembers} active`}
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
              ready={metrics.warReady}
              moderate={metrics.warModerate}
              low={metrics.warLow}
              inactive={metrics.warInactive}
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
              <QuickAction
                label="War Planning"
                description="Plan upcoming wars"
                icon={<Swords className="w-5 h-5 text-red-400" />}
                href="/new/war/cwl/setup"
              />
              <QuickAction
                label="Member Performance"
                description="VIP scores & analytics"
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                href="/new/member-performance"
              />
              <QuickAction
                label="Player Database"
                description="Notes & warnings"
                icon={<Shield className="w-5 h-5 text-purple-400" />}
                href="/new/player-database"
              />
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
