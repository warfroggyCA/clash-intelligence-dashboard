import type { RosterData, RosterMember } from '@/types/roster';
import { buildDashboardMetrics } from '../metrics';

const makeRoster = (members: RosterMember[]): RosterData => ({
  members,
  clanName: 'Test Clan',
  clanTag: '#TEST',
  date: '2026-01-15',
});

describe('buildDashboardMetrics', () => {
  it('computes avg trophies from resolved trophies and ranks top trophy gainers from trophy deltas', () => {
    const roster = makeRoster([
      { tag: '#A', name: 'Alpha', resolvedTrophies: 1200, activity: { metrics: { trophyDelta: 10 } } },
      { tag: '#B', name: 'Bravo', resolvedTrophies: 1800, activity: { metrics: { trophyDelta: 50 } } },
      { tag: '#C', name: 'Charlie', resolvedTrophies: 1500, activity: { metrics: { trophyDelta: 20 } } },
    ] as RosterMember[]);

    const metrics = buildDashboardMetrics(roster);
    expect(metrics.avgTrophies).toBe(1500);
    expect(metrics.topTrophyGainers.map((m) => m.name)).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });

  it('computes top donors from donation totals', () => {
    const roster = makeRoster([
      { tag: '#A', name: 'Alpha', donations: 220 },
      { tag: '#B', name: 'Bravo', donations: 510 },
      { tag: '#C', name: 'Charlie', donations: 140 },
    ] as RosterMember[]);

    const metrics = buildDashboardMetrics(roster);
    expect(metrics.topDonors.map((m) => m.name)).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });
});
