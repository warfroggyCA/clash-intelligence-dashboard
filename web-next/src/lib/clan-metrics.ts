// Clan Metrics Calculation Engine
// Pure data analysis - no AI dependency

export interface Member {
  tag: string;
  name: string;
  townHallLevel?: number | null;
  th?: number;
  role?: string;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  warStars?: number;
  attackWins?: number;
  defenseWins?: number;
  lastSeen?: number | string;
  tenure_days?: number;
  tenure?: number;
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
}

export interface ClanHealthMetrics {
  warEfficiency: number | null;
  donationBalance: {
    healthy: number;
    netReceivers: number;
    totalDonated: number;
    totalReceived: number;
  };
  activityScore: number;
  rushIndex: number;
  membershipHealth: {
    total: number;
    active: number;
    inactive: number;
    atRisk: number;
  };
}

export interface TopPerformer {
  tag: string;
  name: string;
  category: 'donations' | 'trophies' | 'war' | 'activity';
  value: number;
  highlight: string;
}

export interface WatchlistMember {
  tag: string;
  name: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  metric: string;
  daysInactive?: number;
}

export interface MomentumIndicator {
  category: 'war' | 'donations' | 'activity' | 'retention';
  trend: 'up' | 'down' | 'flat';
  label: string;
  description: string;
}

// Calculate Town Hall level
export function getTownHallLevel(member: Member): number {
  return member.townHallLevel ?? member.th ?? 0;
}

// Calculate hero deficit percentage (rush indicator)
export function calculateHeroDeficit(member: Member, thCaps: Map<number, any>): number {
  const th = getTownHallLevel(member);
  if (th < 7) return 0;
  
  const caps = thCaps.get(th);
  if (!caps) return 0;
  
  const heroKeys = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;
  const applicableHeroes = heroKeys.filter(k => caps[k] && caps[k] > 0);
  
  if (applicableHeroes.length === 0) return 0;
  
  let totalDeficit = 0;
  for (const key of applicableHeroes) {
    const current = member[key] ?? 0;
    const cap = caps[key];
    const deficit = Math.max(0, cap - current);
    totalDeficit += deficit / cap;
  }
  
  return Math.round((totalDeficit / applicableHeroes.length) * 100);
}

// Calculate TH caps from member data
export function calculateThCaps(members: Member[]): Map<number, any> {
  const caps = new Map();
  
  for (const member of members) {
    const th = getTownHallLevel(member);
    if (th < 7) continue;
    
    const entry = caps.get(th) || {};
    
    for (const key of ['bk', 'aq', 'gw', 'rc', 'mp'] as const) {
      const value = member[key];
      if (typeof value === 'number' && value > 0) {
        entry[key] = Math.max(entry[key] || 0, value);
      }
    }
    
    caps.set(th, entry);
  }
  
  return caps;
}

// Calculate overall clan health metrics
export function calculateClanHealth(members: Member[]): ClanHealthMetrics {
  if (!members || members.length === 0) {
    return {
      warEfficiency: null,
      donationBalance: { healthy: 0, netReceivers: 0, totalDonated: 0, totalReceived: 0 },
      activityScore: 0,
      rushIndex: 0,
      membershipHealth: { total: 0, active: 0, inactive: 0, atRisk: 0 }
    };
  }

  // Donation balance analysis
  const totalDonated = members.reduce((sum, m) => sum + (m.donations || 0), 0);
  const totalReceived = members.reduce((sum, m) => sum + (m.donationsReceived || 0), 0);
  const avgDonations = totalDonated / members.length;
  
  const donationStats = members.map(m => ({
    tag: m.tag,
    donated: m.donations || 0,
    received: m.donationsReceived || 0,
    balance: (m.donationsReceived || 0) - (m.donations || 0)
  }));
  
  const healthyCount = donationStats.filter(s => 
    s.balance < avgDonations * 0.5 && s.donated > avgDonations * 0.3
  ).length;
  
  const netReceivers = donationStats.filter(s => s.balance > 500).length;

  // Activity score (0-100)
  const activeMembers = members.filter(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    return lastSeen <= 3;
  });
  const activityScore = Math.round((activeMembers.length / members.length) * 100);

  // Rush index
  const thCaps = calculateThCaps(members);
  const highTHMembers = members.filter(m => getTownHallLevel(m) >= 13);
  const rushedCount = highTHMembers.filter(m => calculateHeroDeficit(m, thCaps) > 50).length;
  const rushIndex = highTHMembers.length > 0 
    ? Math.round((rushedCount / highTHMembers.length) * 100)
    : 0;

  // Membership health
  const inactiveMembers = members.filter(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    return lastSeen > 7;
  });
  
  const atRiskMembers = members.filter(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    return lastSeen >= 3 && lastSeen <= 7;
  });

  return {
    warEfficiency: null, // Will be calculated from war data
    donationBalance: {
      healthy: healthyCount,
      netReceivers,
      totalDonated,
      totalReceived
    },
    activityScore,
    rushIndex,
    membershipHealth: {
      total: members.length,
      active: activeMembers.length,
      inactive: inactiveMembers.length,
      atRisk: atRiskMembers.length
    }
  };
}

// Identify top performers
export function getTopPerformers(members: Member[], limit: number = 3): TopPerformer[] {
  const performers: TopPerformer[] = [];

  // Top donators
  const topDonators = [...members]
    .filter(m => (m.donations || 0) > 0)
    .sort((a, b) => (b.donations || 0) - (a.donations || 0))
    .slice(0, limit);
  
  topDonators.forEach(m => {
    performers.push({
      tag: m.tag,
      name: m.name,
      category: 'donations',
      value: m.donations || 0,
      highlight: `${(m.donations || 0).toLocaleString()} donations`
    });
  });

  // High trophy players
  const topTrophies = [...members]
    .filter(m => (m.trophies || 0) > 2500)
    .sort((a, b) => (b.trophies || 0) - (a.trophies || 0))
    .slice(0, limit);
  
  topTrophies.forEach(m => {
    performers.push({
      tag: m.tag,
      name: m.name,
      category: 'trophies',
      value: m.trophies || 0,
      highlight: `${(m.trophies || 0).toLocaleString()} trophies`
    });
  });

  // Most active (low lastSeen)
  const mostActive = [...members]
    .filter(m => typeof m.lastSeen === 'number')
    .sort((a, b) => {
      const aLastSeen = typeof a.lastSeen === 'number' ? a.lastSeen : 999;
      const bLastSeen = typeof b.lastSeen === 'number' ? b.lastSeen : 999;
      return aLastSeen - bLastSeen;
    })
    .slice(0, limit);
  
  mostActive.forEach(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    if (lastSeen <= 1) {
      performers.push({
        tag: m.tag,
        name: m.name,
        category: 'activity',
        value: lastSeen,
        highlight: lastSeen === 0 ? 'Online now' : 'Last seen today'
      });
    }
  });

  return performers;
}

// Generate watchlist (members needing attention)
export function generateWatchlist(members: Member[]): WatchlistMember[] {
  const watchlist: WatchlistMember[] = [];
  const avgDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0) / members.length;

  members.forEach(member => {
    const lastSeen = typeof member.lastSeen === 'number' ? member.lastSeen : 0;
    const donations = member.donations || 0;
    const donationsReceived = member.donationsReceived || 0;
    const donationBalance = donationsReceived - donations;

    // Inactive members (high priority)
    if (lastSeen >= 7) {
      watchlist.push({
        tag: member.tag,
        name: member.name,
        reason: `Inactive for ${lastSeen} days`,
        severity: lastSeen >= 14 ? 'high' : 'medium',
        metric: `Last seen: ${lastSeen} days ago`,
        daysInactive: lastSeen
      });
    }

    // Zero donations
    if (donations === 0 && members.length >= 10) {
      watchlist.push({
        tag: member.tag,
        name: member.name,
        reason: 'Zero donations this season',
        severity: 'medium',
        metric: '0 donations'
      });
    }

    // Heavy net receivers
    if (donationBalance > 1000 && donations < avgDonations * 0.3) {
      watchlist.push({
        tag: member.tag,
        name: member.name,
        reason: 'Heavy net receiver',
        severity: 'medium',
        metric: `Balance: +${donationBalance}`
      });
    }

    // At-risk members (3-7 days inactive)
    if (lastSeen >= 3 && lastSeen < 7) {
      watchlist.push({
        tag: member.tag,
        name: member.name,
        reason: 'At risk of leaving',
        severity: 'low',
        metric: `Last seen: ${lastSeen} days ago`,
        daysInactive: lastSeen
      });
    }
  });

  // Remove duplicates and sort by severity
  const uniqueWatchlist = Array.from(
    new Map(watchlist.map(item => [item.tag, item])).values()
  );

  return uniqueWatchlist.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

// Calculate momentum indicators
export function calculateMomentum(
  currentMembers: Member[],
  previousMembers?: Member[]
): MomentumIndicator[] {
  const indicators: MomentumIndicator[] = [];

  // Activity momentum
  const currentActivity = currentMembers.filter(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    return lastSeen <= 3;
  }).length;
  
  const activityRate = currentActivity / currentMembers.length;
  
  indicators.push({
    category: 'activity',
    trend: activityRate > 0.7 ? 'up' : activityRate > 0.5 ? 'flat' : 'down',
    label: 'Activity Level',
    description: `${Math.round(activityRate * 100)}% members active (last 3 days)`
  });

  // Donation momentum
  const avgDonations = currentMembers.reduce((sum, m) => sum + (m.donations || 0), 0) / currentMembers.length;
  
  indicators.push({
    category: 'donations',
    trend: avgDonations > 500 ? 'up' : avgDonations > 200 ? 'flat' : 'down',
    label: 'Donation Activity',
    description: `${Math.round(avgDonations)} avg donations per member`
  });

  // Membership retention
  const newMembers = currentMembers.filter(m => (m.tenure_days || m.tenure || 999) < 7);
  
  indicators.push({
    category: 'retention',
    trend: newMembers.length > 3 ? 'up' : newMembers.length > 0 ? 'flat' : 'down',
    label: 'New Member Growth',
    description: `${newMembers.length} new members this week`
  });

  return indicators;
}

// Get Elder promotion candidates
export function getElderPromotionCandidates(members: Member[]): Member[] {
  const candidates = members.filter(member => {
    const role = (member.role || '').toLowerCase();
    if (role === 'leader' || role === 'coleader' || role === 'elder') return false;

    const donations = member.donations || 0;
    const lastSeen = typeof member.lastSeen === 'number' ? member.lastSeen : 999;
    const tenure = member.tenure_days || member.tenure || 0;

    // Criteria: Active (seen within 2 days), decent donations, tenure > 14 days
    return lastSeen <= 2 && donations >= 200 && tenure >= 14;
  });

  return candidates.sort((a, b) => (b.donations || 0) - (a.donations || 0)).slice(0, 5);
}