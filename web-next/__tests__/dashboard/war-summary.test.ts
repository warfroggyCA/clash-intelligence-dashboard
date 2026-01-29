/**
 * Unit tests for war summary aggregation.
 *
 * @jest-environment node
 */

import { buildWarSummary } from '@/lib/dashboard/war-summary';

describe('buildWarSummary', () => {
  it('builds active war headline data from current war', () => {
    const summary = buildWarSummary({
      currentWar: {
        state: 'preparation',
        opponent: { name: 'Night Owls' },
        teamSize: 20,
      },
      warLog: [],
    });

    expect(summary.activeWar?.stateLabel).toBe('Planning');
    expect(summary.activeWar?.opponentName).toBe('Night Owls');
    expect(summary.activeWar?.teamSize).toBe(20);
    expect(summary.activeWar?.isActive).toBe(true);
  });

  it('computes war record and average stars per attack', () => {
    const summary = buildWarSummary({
      currentWar: null,
      warLog: [
        {
          result: 'win',
          clan: { stars: 30, attacks: 40 },
          opponent: { stars: 28, name: 'Opp A' },
          teamSize: 20,
        },
        {
          result: 'lose',
          clan: { stars: 24, attacks: 40 },
          opponent: { stars: 30, name: 'Opp B' },
          teamSize: 20,
        },
        {
          result: 'tie',
          clan: { stars: 25, attacks: 50 },
          opponent: { stars: 25, name: 'Opp C' },
          teamSize: 25,
        },
        {
          clan: { stars: 28, attacks: 40 },
          opponent: { stars: 26, name: 'Opp D' },
          teamSize: 20,
        },
      ],
    });

    expect(summary.record).toEqual({ wins: 2, losses: 1, ties: 1, total: 4 });
    expect(summary.averageStarsPerAttack).toBeCloseTo(0.63, 2);
  });
});
