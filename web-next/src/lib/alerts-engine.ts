// Alert Detection Engine
// Generates prioritized actionable alerts for leadership

import type { Member } from './clan-metrics';
import { getTownHallLevel, calculateHeroDeficit, calculateThCaps } from './clan-metrics';
import { calculateWarMetrics, generateWarAlerts, type WarData } from './war-metrics';
import { calculateCapitalMetrics, generateCapitalAlerts } from './capital-metrics';

export type AlertPriority = 'high' | 'medium' | 'low';
export type AlertCategory = 'inactivity' | 'performance' | 'war' | 'donations' | 'promotion' | 'retention' | 'capital';

export interface Alert {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  description: string;
  affectedMembers: string[]; // player tags
  actionable: string; // What to do about it
  metric?: string;
  timestamp: string;
}

interface AlertThresholds {
  inactivityDays: number;
  lowDonations: number;
  capitalContributionMin: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  inactivityDays: 3,
  lowDonations: 50,
  capitalContributionMin: 500,
};

interface AlertContext {
  members: Member[];
  avgDonations: number;
  thCaps: Map<number, any>;
  warData?: WarData;
  capitalData?: any;
  thresholds: AlertThresholds;
}

// Generate all alerts for the clan
export function generateAlerts(members: Member[], warData?: WarData, capitalData?: any, customThresholds?: Partial<AlertThresholds>): Alert[] {
  if (!members || members.length === 0) return [];

  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };

  const context: AlertContext = {
    members,
    avgDonations: members.reduce((sum, m) => sum + (m.donations || 0), 0) / members.length,
    thCaps: calculateThCaps(members),
    warData,
    capitalData,
    thresholds
  };

  const alerts: Alert[] = [];

  // War alerts (if war data available)
  if (warData) {
    alerts.push(...detectWarAlerts(context));
  }

  // Capital alerts (if capital data available)
  if (capitalData) {
    const capMetrics = calculateCapitalMetrics(members, capitalData);
    const capAlerts = generateCapitalAlerts(capMetrics, thresholds);
    alerts.push(...capAlerts.map(a => ({
      id: `capital-${a.type}-${Date.now()}`,
      priority: a.severity as AlertPriority,
      category: 'capital' as AlertCategory,
      title: a.title,
      description: a.description,
      affectedMembers: [],
      actionable: 'Review Capital Raid contributions in the dashboard.',
      metric: a.metric,
      timestamp: new Date().toISOString()
    })));
  }

  // High priority alerts
  alerts.push(...detectInactiveMembers(context));
  alerts.push(...detectDonationImbalance(context));
  alerts.push(...detectRushedMembers(context));

  // Medium priority alerts
  alerts.push(...detectPromotionOpportunities(context));
  alerts.push(...detectAtRiskMembers(context));
  alerts.push(...detectZeroDonators(context));

  // Low priority alerts
  alerts.push(...detectNewMemberWelcome(context));

  return alerts.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Detect members inactive for 7+ days
function detectInactiveMembers(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
    const inactivityThreshold = context.thresholds.inactivityDays || 3;
    const inactiveMembers = context.members.filter(m => {
      const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
      return lastSeen >= inactivityThreshold;
    });

  if (inactiveMembers.length > 0) {
    const highRisk = inactiveMembers.filter(m => {
      const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
      return lastSeen >= 14;
    });

    if (highRisk.length > 0) {
      alerts.push({
        id: `inactive-high-${Date.now()}`,
        priority: 'high',
        category: 'inactivity',
        title: `${highRisk.length} Member${highRisk.length > 1 ? 's' : ''} Inactive 7+ Days`,
        description: `${highRisk.map(m => m.name).join(', ')} ${highRisk.length > 1 ? 'have' : 'has'} been inactive for a week+. High risk of departure.`,
        affectedMembers: highRisk.map(m => m.tag),
        actionable: 'Consider reaching out via in-game chat or removing from clan if unresponsive.',
        metric: `Inactive: ${Math.max(...highRisk.map(m => typeof m.lastSeen === 'number' ? m.lastSeen : 0))} days`,
        timestamp: new Date().toISOString()
      });
    }

    const moderateThreshold = Math.max(1, inactivityThreshold);
    const moderateRisk = inactiveMembers.filter(m => {
      const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
      return lastSeen >= moderateThreshold && lastSeen < 7;
    });

    if (moderateRisk.length > 0) {
      alerts.push({
        id: `inactive-medium-${Date.now()}`,
        priority: 'medium',
        category: 'inactivity',
        title: `${moderateRisk.length} Member${moderateRisk.length > 1 ? 's' : ''} Inactive ${moderateThreshold}+ Days`,
        description: `${moderateRisk.map(m => m.name).join(', ')} ${moderateRisk.length > 1 ? 'have' : 'has'} been inactive for over ${moderateThreshold} days.`,
        affectedMembers: moderateRisk.map(m => m.tag),
        actionable: 'Send a friendly check-in message to re-engage them.',
        timestamp: new Date().toISOString()
      });
    }
  }

  return alerts;
}

// Detect donation imbalance
function detectDonationImbalance(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const imbalanceThreshold = (context.thresholds.lowDonations || 50) * 10;
  const heavyReceivers = context.members.filter(m => {
    const balance = (m.donationsReceived || 0) - (m.donations || 0);
    return balance > imbalanceThreshold && (m.donations || 0) < context.avgDonations * 0.3;
  });

  if (heavyReceivers.length >= 3) {
    alerts.push({
      id: `donation-imbalance-${Date.now()}`,
      priority: 'high',
      category: 'donations',
      title: `${heavyReceivers.length} Members with Severe Donation Imbalance`,
      description: `${heavyReceivers.map(m => m.name).join(', ')} ${heavyReceivers.length > 1 ? 'are' : 'is'} receiving ${imbalanceThreshold}+ more than donating.`,
      affectedMembers: heavyReceivers.map(m => m.tag),
      actionable: 'Address donation expectations via clan announcement or individual messages.',
      metric: `Avg balance: +${Math.round(heavyReceivers.reduce((sum, m) => sum + ((m.donationsReceived || 0) - (m.donations || 0)), 0) / heavyReceivers.length)}`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect rushed members (TH13+)
function detectRushedMembers(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const highTHMembers = context.members.filter(m => getTownHallLevel(m) >= 13);
  
  const veryRushedMembers = highTHMembers.filter(m => 
    calculateHeroDeficit(m, context.thCaps) > 60
  );

  if (veryRushedMembers.length >= 2) {
    alerts.push({
      id: `rushed-bases-${Date.now()}`,
      priority: 'high',
      category: 'war',
      title: `${veryRushedMembers.length} Very Rushed High-Level Bases`,
      description: `${veryRushedMembers.map(m => `${m.name} (TH${getTownHallLevel(m)})`).join(', ')} ${veryRushedMembers.length > 1 ? 'have' : 'has'} significant hero deficits (60%+ rushed).`,
      affectedMembers: veryRushedMembers.map(m => m.tag),
      actionable: 'Consider removing from war lineup until heroes are upgraded. Provide upgrade guidance.',
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect Elder promotion opportunities
function detectPromotionOpportunities(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const candidates = context.members.filter(m => {
    const role = (m.role || '').toLowerCase();
    if (role === 'leader' || role === 'coleader' || role === 'elder') return false;

    const donations = m.donations || 0;
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 999;
    const tenure = m.tenure_days || m.tenure || 0;

    return lastSeen <= 2 && donations >= 300 && tenure >= 14;
  });

  if (candidates.length >= 3) {
    const topCandidates = candidates
      .sort((a, b) => (b.donations || 0) - (a.donations || 0))
      .slice(0, 3);

    alerts.push({
      id: `promotion-ready-${Date.now()}`,
      priority: 'medium',
      category: 'promotion',
      title: `${topCandidates.length} Members Eligible for Elder Promotion`,
      description: `${topCandidates.map(m => m.name).join(', ')} ${topCandidates.length > 1 ? 'have' : 'has'} shown consistent activity and contributions.`,
      affectedMembers: topCandidates.map(m => m.tag),
      actionable: 'Review performance and consider promoting to Elder to encourage continued engagement.',
      metric: `Top donations: ${topCandidates[0].donations}`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect at-risk members (3-6 days inactive)
function detectAtRiskMembers(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const atRisk = context.members.filter(m => {
    const lastSeen = typeof m.lastSeen === 'number' ? m.lastSeen : 0;
    return lastSeen >= 3 && lastSeen < 7;
  });

  if (atRisk.length >= 3) {
    alerts.push({
      id: `at-risk-${Date.now()}`,
      priority: 'medium',
      category: 'retention',
      title: `${atRisk.length} Members Showing Early Inactivity`,
      description: `${atRisk.map(m => m.name).join(', ')} ${atRisk.length > 1 ? 'have' : 'has'} been inactive for 3-6 days.`,
      affectedMembers: atRisk.map(m => m.tag),
      actionable: 'Proactively engage with a friendly message to prevent extended inactivity.',
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect zero donation members
function detectZeroDonators(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const lowThreshold = context.thresholds.lowDonations || 50;
  const zeroDonators = context.members.filter(m => (m.donations || 0) < lowThreshold);

  if (zeroDonators.length >= 5) {
    alerts.push({
      id: `zero-donations-${Date.now()}`,
      priority: 'medium',
      category: 'donations',
      title: `${zeroDonators.length} Members with Low/Zero Donations`,
      description: `${zeroDonators.length} members have donated less than ${lowThreshold} this season.`,
      affectedMembers: zeroDonators.map(m => m.tag),
      actionable: 'Send clan-wide reminder about donation expectations and benefits.',
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect new members needing welcome
function detectNewMemberWelcome(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const newMembers = context.members.filter(m => (m.tenure_days || m.tenure || 999) < 3);

  if (newMembers.length > 0) {
    alerts.push({
      id: `new-members-${Date.now()}`,
      priority: 'low',
      category: 'retention',
      title: `${newMembers.length} New Member${newMembers.length > 1 ? 's' : ''} to Welcome`,
      description: `${newMembers.map(m => m.name).join(', ')} joined within the last 3 days.`,
      affectedMembers: newMembers.map(m => m.tag),
      actionable: 'Send welcoming message and clan guidelines to help them integrate.',
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Detect war-related alerts
function detectWarAlerts(context: AlertContext): Alert[] {
  if (!context.warData) return [];
  
  const alerts: Alert[] = [];
  const warMetrics = calculateWarMetrics(context.members, context.warData);
  const warAlerts = generateWarAlerts(warMetrics, context.members);
  
  // Convert war alerts to standard alert format
  for (const warAlert of warAlerts) {
    const priority: AlertPriority = warAlert.severity;
    
    alerts.push({
      id: `war-${warAlert.type}-${Date.now()}`,
      priority,
      category: 'war',
      title: warAlert.title,
      description: warAlert.description,
      affectedMembers: [], // War alerts typically don't target specific members
      actionable: getWarActionable(warAlert.type),
      metric: warAlert.metric,
      timestamp: new Date().toISOString()
    });
  }
  
  return alerts;
}

function getWarActionable(alertType: string): string {
  switch (alertType) {
    case 'current_war':
      return 'Monitor war progress and ensure all members attack. Check Command Center for performance insights.';
    case 'performance_decline':
      return 'Review recent war strategies and attack plans. Consider coaching sessions or strategy adjustments.';
    case 'win_rate':
      return 'Analyze war matchups and member performance. May need to adjust war lineup or provide attack guidance.';
    case 'low_performers':
      return 'Provide coaching to struggling members. Share base attack strategies and practice attack plans.';
    default:
      return 'Review war performance and take appropriate action.';
  }
}