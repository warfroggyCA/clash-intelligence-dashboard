import type { RosterData, RosterMember } from '@/types/roster';
import { resolveTrophies as resolveTrophiesSSOT } from '@/lib/roster-derivations';

export type DashboardAlertType = 'inactive' | 'donation' | 'vip_drop' | 'new_joiner';

export interface DashboardAlert {
  type: DashboardAlertType;
  member: RosterMember;
  message: string;
}

export interface DashboardMetrics {
  totalMembers: number;
  avgVipScore: number | null;
  avgTrophies: number | null;
  avgDonationsGiven: number | null;
  avgDonationsReceived: number | null;
  avgActivityScore: number | null;
  activeMembers: number;
  totalDonations: number | null;
  totalDonationsReceived: number | null;
  newJoiners: number;
  topDonors: RosterMember[];
  topTrophyGainers: RosterMember[];
  topPerformers: RosterMember[];
  thDistribution: Record<number, number>;
  vipKing: RosterMember | null;
  mostImproved: RosterMember | null;
  donationKing: RosterMember | null;
  trophyKing: RosterMember | null;
  momentumScore: number;
  warReadiness: {
    ready: number;
    moderate: number;
    low: number;
    inactive: number;
  };
  alerts: DashboardAlert[];
  activityBreakdown: Record<string, number>;
}

const EMPTY_METRICS: DashboardMetrics = {
  totalMembers: 0,
  avgVipScore: null,
  avgTrophies: null,
  avgDonationsGiven: null,
  avgDonationsReceived: null,
  avgActivityScore: null,
  activeMembers: 0,
  totalDonations: null,
  totalDonationsReceived: null,
  newJoiners: 0,
  topDonors: [],
  topTrophyGainers: [],
  topPerformers: [],
  thDistribution: {},
  vipKing: null,
  mostImproved: null,
  donationKing: null,
  trophyKing: null,
  momentumScore: 0,
  warReadiness: {
    ready: 0,
    moderate: 0,
    low: 0,
    inactive: 0,
  },
  alerts: [],
  activityBreakdown: {
    'Very Active': 0,
    Active: 0,
    Moderate: 0,
    Low: 0,
    Inactive: 0,
  },
};

const sumIfComplete = (values: Array<number | null | undefined>): number | null => {
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

const averageIfPresent = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
};

export function buildDashboardMetrics(roster: RosterData | null): DashboardMetrics {
  if (!roster?.members?.length) {
    return { ...EMPTY_METRICS };
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

  const membersWithVip = members.filter((member) => member.vip?.score != null);
  const avgVipScore = membersWithVip.length
    ? Math.round(membersWithVip.reduce((sum, member) => sum + (member.vip?.score ?? 0), 0) / membersWithVip.length)
    : null;

  const avgDonationsGiven = averageIfPresent(members.map((member) => member.donations));
  const avgDonationsReceived = averageIfPresent(members.map((member) => member.donationsReceived));
  const avgActivityScore = averageIfPresent(
    members.map((member) => (typeof member.activity?.score === 'number' ? member.activity.score : null))
  );
  const resolvedTrophiesList = members.map((member) => {
    if (typeof member.resolvedTrophies === 'number') {
      return member.resolvedTrophies;
    }
    return resolveTrophiesSSOT(member);
  });
  const avgTrophies = averageIfPresent(resolvedTrophiesList);

  const activeMembers = membersWithActivity.filter(({ level }) => (
    level === 'Very Active' || level === 'Active'
  )).length;

  const totalDonations = sumIfComplete(members.map((member) => member.donations ?? null));
  const totalDonationsReceived = sumIfComplete(members.map((member) => member.donationsReceived ?? null));

  const newJoinersList = members.filter((member) => {
    const tenure = member.tenureDays ?? member.tenure_days;
    return tenure != null && tenure <= 7;
  });
  const newJoiners = newJoinersList.length;

  const topPerformers = [...members]
    .filter((member) => member.vip?.score != null)
    .sort((a, b) => (b.vip?.score || 0) - (a.vip?.score || 0))
    .slice(0, 5);

  const thDistribution: Record<number, number> = {};
  members.forEach((member) => {
    const th = member.townHallLevel;
    if (typeof th !== 'number' || !Number.isFinite(th)) return;
    thDistribution[th] = (thDistribution[th] || 0) + 1;
  });

  const vipKing = [...members]
    .filter((member) => member.vip?.score != null)
    .sort((a, b) => (b.vip?.score || 0) - (a.vip?.score || 0))[0] || null;

  const mostImproved = [...members]
    .filter((member) => member.vip?.score != null && member.vip?.last_week_score != null)
    .map((member) => ({
      member,
      improvement: (member.vip?.score || 0) - (member.vip?.last_week_score || 0),
    }))
    .filter((entry) => entry.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)[0]?.member || null;

  const donationValue = (member: RosterMember): number => {
    // Prefer recent contribution window when available (7-day donation delta)
    const delta = (member as any).donationDelta;
    if (typeof delta === 'number' && Number.isFinite(delta) && delta > 0) return delta;
    const given = member.donations;
    return typeof given === 'number' && Number.isFinite(given) ? given : 0;
  };

  const donationKing = [...members]
    .filter((member) => donationValue(member) > 0)
    .sort((a, b) => donationValue(b) - donationValue(a))[0] || null;

  const topDonors = [...members]
    .sort((a, b) => donationValue(b) - donationValue(a))
    .slice(0, 5);

  const topTrophyGainers = [...members]
    .map((member) => ({
      member,
      gain: member.activity?.metrics?.trophyDelta ?? 0,
    }))
    .sort((a, b) => b.gain - a.gain)
    .map((entry) => entry.member)
    .slice(0, 5);

  const trophyKing = [...members]
    .map((member) => ({
      member,
      trophies: member.resolvedTrophies ?? resolveTrophiesSSOT(member) ?? member.seasonTotalTrophies ?? member.rankedTrophies ?? null,
    }))
    .filter((entry) => typeof entry.trophies === 'number' && Number.isFinite(entry.trophies))
    .sort((a, b) => (b.trophies ?? 0) - (a.trophies ?? 0))[0]?.member || null;

  let upTrending = 0;
  let downTrending = 0;
  members.forEach((member) => {
    if (member.vip?.trend === 'up') upTrending += 1;
    if (member.vip?.trend === 'down') downTrending += 1;
  });
  const trendingMembers = upTrending + downTrending;
  const momentumScore = trendingMembers > 0
    ? Math.round(((upTrending - downTrending) / totalMembers) * 100)
    : 0;

  const warReadiness = {
    ready: membersWithActivity.filter(({ level }) => level === 'Very Active' || level === 'Active').length,
    moderate: membersWithActivity.filter(({ level }) => level === 'Moderate').length,
    low: membersWithActivity.filter(({ level }) => level === 'Low').length,
    inactive: membersWithActivity.filter(({ level }) => level === 'Inactive').length,
  };

  const alerts: DashboardAlert[] = [];
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
        message: tenure != null && tenure > 30 ? 'Long-term member gone quiet' : "Hasn't been active recently",
      });
    });

  members
    .filter((member) => {
      const receivedDelta = (member as any).donationReceivedDelta;
      const givenDelta = (member as any).donationDelta;
      // Use 7-day deltas when available to avoid season timing quirks
      if (typeof receivedDelta === 'number' && typeof givenDelta === 'number') {
        return receivedDelta > 200 && givenDelta < 10;
      }

      // Fallback to season totals
      const received = member.donationsReceived;
      const given = member.donations;
      if (typeof received !== 'number' || typeof given !== 'number') return false;
      return received > 100 && given < 20 && received > given * 10;
    })
    .slice(0, 2)
    .forEach((member) => {
      const receivedDelta = (member as any).donationReceivedDelta;
      const givenDelta = (member as any).donationDelta;
      if (typeof receivedDelta === 'number' && typeof givenDelta === 'number') {
        alerts.push({
          type: 'donation',
          member,
          message: `Last 7d: received ${receivedDelta.toLocaleString()}, donated ${givenDelta.toLocaleString()}`,
        });
        return;
      }

      alerts.push({
        type: 'donation',
        member,
        message: `Received ${member.donationsReceived?.toLocaleString()}, donated ${member.donations?.toLocaleString()}`,
      });
    });

  members
    .filter((member) => {
      const givenDelta = (member as any).donationDelta;
      return typeof givenDelta === 'number' && Number.isFinite(givenDelta) && givenDelta >= 500;
    })
    .sort((a, b) => ((b as any).donationDelta ?? 0) - ((a as any).donationDelta ?? 0))
    .slice(0, 1)
    .forEach((member) => {
      alerts.push({
        type: 'donation',
        member,
        message: `Big helper: donated ${(member as any).donationDelta.toLocaleString()} in the last 7 days`,
      });
    });

  members
    .filter((member) => member.vip?.trend === 'down' && member.vip?.last_week_score != null)
    .map((member) => ({
      member,
      drop: (member.vip?.last_week_score || 0) - (member.vip?.score || 0),
    }))
    .filter((entry) => entry.drop > 10)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 2)
    .forEach(({ member, drop }) => {
      alerts.push({
        type: 'vip_drop',
        member,
        message: `VIP dropped ${drop} points this week`,
      });
    });

  newJoinersList.slice(0, 2).forEach((member) => {
    const tenure =
      typeof member.tenureDays === 'number'
        ? member.tenureDays
        : typeof member.tenure_days === 'number'
          ? member.tenure_days
          : null;
    alerts.push({
      type: 'new_joiner',
      member,
      message: tenure != null ? `Joined ${tenure} days ago - needs welcome` : 'Needs welcome review',
    });
  });

  const activityBreakdown = { ...EMPTY_METRICS.activityBreakdown };
  membersWithActivity.forEach(({ level }) => {
    if (level in activityBreakdown) {
      activityBreakdown[level] += 1;
    }
  });

  return {
    totalMembers,
    avgVipScore,
    avgTrophies,
    avgDonationsGiven,
    avgDonationsReceived,
    avgActivityScore,
    activeMembers,
    totalDonations,
    totalDonationsReceived,
    newJoiners,
    topDonors,
    topTrophyGainers,
    topPerformers,
    thDistribution,
    vipKing,
    mostImproved,
    donationKing,
    trophyKing,
    momentumScore,
    warReadiness,
    alerts,
    activityBreakdown,
  };
}
