/**
 * Unit tests for dashboard metrics aggregation.
 *
 * @jest-environment node
 */

import type { RosterData, RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import { buildDashboardMetrics } from '@/lib/dashboard/metrics';

const makeMember = (overrides: Partial<RosterMember>): RosterMember => ({
  name: 'Member',
  tag: '#TAG',
  townHallLevel: 15,
  role: 'member',
  trophies: 5000,
  donations: 0,
  donationsReceived: 0,
  warStars: 0,
  clanCapitalContributions: 0,
  rankedLeagueId: 1,
  rankedLeagueName: 'Legend League',
  rushPercent: null,
  rankedTrophies: 5000,
  lastWeekTrophies: null,
  seasonTotalTrophies: null,
  bk: null,
  aq: null,
  gw: null,
  rc: null,
  mp: null,
  activity: { level: 'Moderate', score: 50 },
  activityScore: 50,
  activityBand: null,
  activityTone: null,
  resolvedTrophies: null,
  resolvedLeague: null,
  heroPower: null,
  tenure_days: null,
  tenureDays: null,
  tenure_as_of: null,
  tenureAsOf: null,
  extras: null,
  metrics: undefined,
  leagueId: null,
  leagueName: null,
  leagueTrophies: null,
  leagueIconSmall: null,
  leagueIconMedium: null,
  battleModeTrophies: null,
  rankedModifier: null,
  seasonResetAt: null,
  recentClans: undefined,
  enriched: null,
  vip: null,
  ...overrides,
});

const makeRoster = (members: RosterMember[]): RosterData => ({
  members,
  clanName: 'Test Clan',
  clanTag: '#TEST',
  date: '2026-01-15',
});

describe('buildDashboardMetrics', () => {
  it('computes top performers, spotlights, and activity totals', () => {
    const roster = makeRoster([
      makeMember({
        name: 'Alpha',
        tag: '#A',
        vip: { score: 80, rank: 2, competitive_score: 40, support_score: 25, development_score: 15, trend: 'up', last_week_score: 70 },
        donations: 120,
        donationsReceived: 50,
        tenureDays: 3,
        activity: { level: 'Active', score: 65 },
        rankedTrophies: 5100,
      }),
      makeMember({
        name: 'Bravo',
        tag: '#B',
        vip: { score: 92, rank: 1, competitive_score: 50, support_score: 30, development_score: 12, trend: 'stable', last_week_score: 90 },
        donations: 200,
        donationsReceived: 75,
        activity: { level: 'Very Active', score: 80 },
        rankedTrophies: 5400,
      }),
      makeMember({
        name: 'Charlie',
        tag: '#C',
        vip: { score: 60, rank: 3, competitive_score: 30, support_score: 20, development_score: 10, trend: 'down', last_week_score: 80 },
        donations: 5,
        donationsReceived: 300,
        tenureDays: 40,
        activity: { level: 'Inactive', score: 5 },
        rankedTrophies: 4800,
      }),
    ]);

    const metrics = buildDashboardMetrics(roster);

    expect(metrics.totalMembers).toBe(3);
    expect(metrics.avgVipScore).toBe(77);
    expect(metrics.activeMembers).toBe(2);
    expect(metrics.newJoiners).toBe(1);
    expect(metrics.vipKing?.name).toBe('Bravo');
    expect(metrics.mostImproved?.name).toBe('Alpha');
    expect(metrics.donationKing?.name).toBe('Bravo');
    expect(metrics.trophyKing?.name).toBe('Bravo');
    expect(metrics.topPerformers.map((m) => m.name)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(metrics.activityBreakdown['Very Active']).toBe(1);
    expect(metrics.activityBreakdown['Inactive']).toBe(1);
    expect(metrics.warReadiness.ready).toBe(2);
    expect(metrics.warReadiness.inactive).toBe(1);
  });

  it('returns null total donations when any donation value is missing', () => {
    const roster = makeRoster([
      makeMember({ donations: 50 }),
      makeMember({ donations: null }),
    ]);

    const metrics = buildDashboardMetrics(roster);
    expect(metrics.totalDonations).toBeNull();
  });

  it('sums total donations when all values are present', () => {
    const roster = makeRoster([
      makeMember({ donations: 50 }),
      makeMember({ donations: 75 }),
    ]);

    const metrics = buildDashboardMetrics(roster);
    expect(metrics.totalDonations).toBe(125);
  });
});
