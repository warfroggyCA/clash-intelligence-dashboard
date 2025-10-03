// War Metrics Calculation Engine
// Analyzes war performance data for strategic insights

import type { Member } from './clan-metrics';

export interface WarData {
  currentWar?: {
    state: string;
    teamSize: number;
    opponent?: {
      name: string;
      tag: string;
    };
    attacksPerMember?: number;
    startTime?: string;
    endTime?: string;
  };
  warLog?: Array<{
    result: string;
    opponent: {
      name: string;
      tag: string;
    };
    endTime: string;
    teamSize: number;
    attacksPerMember: number;
  }>;
}

export interface WarMetrics {
  currentWar: {
    active: boolean;
    state: string;
    opponent: string | null;
    teamSize: number;
    timeRemaining: string | null;
  };
  recentPerformance: {
    last10Wars: {
      wins: number;
      losses: number;
      draws: number;
      winRate: number;
    };
    trend: 'improving' | 'declining' | 'stable';
  };
  memberPerformance: MemberWarPerformance[];
}

export interface MemberWarPerformance {
  tag: string;
  name: string;
  warStars: number;
  estimatedAttacks: number;
  estimatedStarsPerAttack: number;
  performance: 'excellent' | 'good' | 'average' | 'poor';
  needsCoaching: boolean;
}

export interface WarAlert {
  type: 'current_war' | 'performance_decline' | 'low_performers' | 'win_rate';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric?: string;
}

// Calculate time remaining in war
export function calculateTimeRemaining(endTime?: string): string | null {
  if (!endTime) return null;
  
  try {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'War ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    
    return `${hours}h ${minutes}m remaining`;
  } catch (error) {
    return null;
  }
}

// Calculate war win rate and trend
export function calculateWarPerformance(warLog?: Array<any>): {
  last10Wars: { wins: number; losses: number; draws: number; winRate: number };
  trend: 'improving' | 'declining' | 'stable';
} {
  if (!warLog || warLog.length === 0) {
    return {
      last10Wars: { wins: 0, losses: 0, draws: 0, winRate: 0 },
      trend: 'stable'
    };
  }

  const last10 = warLog.slice(0, 10);
  
  const wins = last10.filter(w => w.result === 'win').length;
  const losses = last10.filter(w => w.result === 'lose').length;
  const draws = last10.filter(w => w.result === 'draw' || w.result === 'tie').length;
  const winRate = last10.length > 0 ? Math.round((wins / last10.length) * 100) : 0;

  // Calculate trend (compare first 5 vs last 5)
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (last10.length >= 10) {
    const recent5 = last10.slice(0, 5);
    const older5 = last10.slice(5, 10);
    
    const recentWins = recent5.filter(w => w.result === 'win').length;
    const olderWins = older5.filter(w => w.result === 'win').length;
    
    const recentWinRate = recentWins / 5;
    const olderWinRate = olderWins / 5;
    
    if (recentWinRate > olderWinRate + 0.2) trend = 'improving';
    else if (recentWinRate < olderWinRate - 0.2) trend = 'declining';
  }

  return {
    last10Wars: { wins, losses, draws, winRate },
    trend
  };
}

// Analyze member war performance
export function analyzeMemberWarPerformance(
  members: Member[],
  teamSize: number = 50
): MemberWarPerformance[] {
  // Estimate typical attacks per member (usually 2 in regular wars)
  const estimatedAttacksPerMember = 2;
  
  const performance: MemberWarPerformance[] = members.map(member => {
    const warStars = member.warStars || 0;
    const estimatedAttacks = estimatedAttacksPerMember;
    const starsPerAttack = estimatedAttacks > 0 ? warStars / estimatedAttacks : 0;
    
    // Classify performance
    let performanceLevel: 'excellent' | 'good' | 'average' | 'poor';
    let needsCoaching = false;
    
    if (starsPerAttack >= 2.5) {
      performanceLevel = 'excellent';
    } else if (starsPerAttack >= 2.0) {
      performanceLevel = 'good';
    } else if (starsPerAttack >= 1.5) {
      performanceLevel = 'average';
    } else {
      performanceLevel = 'poor';
      needsCoaching = true;
    }
    
    return {
      tag: member.tag,
      name: member.name,
      warStars,
      estimatedAttacks,
      estimatedStarsPerAttack: Math.round(starsPerAttack * 100) / 100,
      performance: performanceLevel,
      needsCoaching
    };
  });
  
  // Sort by stars per attack (best first)
  return performance.sort((a, b) => b.estimatedStarsPerAttack - a.estimatedStarsPerAttack);
}

// Generate comprehensive war metrics
export function calculateWarMetrics(
  members: Member[],
  warData?: WarData
): WarMetrics {
  const currentWar = warData?.currentWar;
  const warLog = warData?.warLog;
  
  return {
    currentWar: {
      active: currentWar?.state === 'inWar' || currentWar?.state === 'preparation',
      state: currentWar?.state || 'notInWar',
      opponent: currentWar?.opponent?.name || null,
      teamSize: currentWar?.teamSize || 0,
      timeRemaining: calculateTimeRemaining(currentWar?.endTime)
    },
    recentPerformance: calculateWarPerformance(warLog),
    memberPerformance: analyzeMemberWarPerformance(members, currentWar?.teamSize)
  };
}

// Generate war-specific alerts
export function generateWarAlerts(
  warMetrics: WarMetrics,
  members: Member[]
): WarAlert[] {
  const alerts: WarAlert[] = [];

  // Alert: Current war active
  if (warMetrics.currentWar.active) {
    alerts.push({
      type: 'current_war',
      severity: 'high',
      title: `War Active: vs ${warMetrics.currentWar.opponent}`,
      description: `${warMetrics.currentWar.teamSize}v${warMetrics.currentWar.teamSize} war ${warMetrics.currentWar.state}. ${warMetrics.currentWar.timeRemaining || 'Time unknown'}`,
      metric: warMetrics.currentWar.timeRemaining || undefined
    });
  }

  // Alert: Win rate declining
  const { last10Wars, trend } = warMetrics.recentPerformance;
  if (trend === 'declining' && last10Wars.winRate < 50) {
    alerts.push({
      type: 'performance_decline',
      severity: 'high',
      title: 'War Win Rate Declining',
      description: `Win rate has dropped to ${last10Wars.winRate}% in last 10 wars. Recent performance is worse than earlier wars.`,
      metric: `${last10Wars.wins}W-${last10Wars.losses}L-${last10Wars.draws}D`
    });
  }

  // Alert: Low win rate (even if stable)
  if (last10Wars.winRate < 40 && last10Wars.wins + last10Wars.losses > 0) {
    alerts.push({
      type: 'win_rate',
      severity: 'medium',
      title: 'Low War Win Rate',
      description: `Only ${last10Wars.winRate}% win rate in last 10 wars (${last10Wars.wins}W-${last10Wars.losses}L-${last10Wars.draws}D).`,
      metric: `${last10Wars.winRate}% win rate`
    });
  }

  // Alert: Multiple poor performers
  const poorPerformers = warMetrics.memberPerformance.filter(m => m.needsCoaching);
  if (poorPerformers.length >= 3) {
    alerts.push({
      type: 'low_performers',
      severity: poorPerformers.length >= 5 ? 'high' : 'medium',
      title: `${poorPerformers.length} Members Need War Coaching`,
      description: `${poorPerformers.slice(0, 3).map(p => p.name).join(', ')}${poorPerformers.length > 3 ? ` and ${poorPerformers.length - 3} more` : ''} have low attack efficiency (<1.5 stars/attack).`,
      metric: `Avg: ${Math.round(poorPerformers.reduce((sum, p) => sum + p.estimatedStarsPerAttack, 0) / poorPerformers.length * 10) / 10} stars/attack`
    });
  }

  return alerts;
}

// Get top war performers
export function getTopWarPerformers(
  memberPerformance: MemberWarPerformance[],
  limit: number = 5
): MemberWarPerformance[] {
  return memberPerformance
    .filter(m => m.warStars > 0)
    .slice(0, limit);
}

// Get members needing coaching
export function getMembersNeedingCoaching(
  memberPerformance: MemberWarPerformance[]
): MemberWarPerformance[] {
  return memberPerformance.filter(m => m.needsCoaching);
}
