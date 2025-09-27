import { calculateAceScores, createAceInputsFromRoster, type AcePlayerInput } from '@/lib/ace-score';
import type { Roster } from '@/types';

describe('ACE score calculation', () => {
  it('ranks players by ACE using detailed component inputs', () => {
    const inputs: AcePlayerInput[] = [
      {
        tag: '#ACE',
        name: 'Clutch Cleaner',
        townHallLevel: 16,
        attacks: [
          { attackerTownHall: 16, defenderTownHall: 16, prevStars: 0, newStars: 3, warsAgo: 0, attackOrder: 3 },
          { attackerTownHall: 16, defenderTownHall: 15, prevStars: 1, newStars: 2, warsAgo: 1, attackOrder: 5 },
        ],
        defenses: [
          { attackerTownHall: 16, defenderTownHall: 16, starsConceded: 1, warsAgo: 0 },
          { attackerTownHall: 16, defenderTownHall: 16, starsConceded: 0, warsAgo: 1 },
        ],
        participation: {
          warAttacksUsed: 2,
          warAttacksAvailable: 2,
          capitalAttacksUsed: 6,
          capitalAttacksAvailable: 6,
          fullWarStreak: 8,
          warsConsidered: 8,
          daysActiveLast30: 26,
        },
        capital: {
          capitalLoot: 4200,
          capitalAttacks: 8,
          finisherRate: 0.55,
          oneHitRate: 0.25,
        },
        donations: {
          donations: 600,
          received: 200,
        },
      },
      {
        tag: '#AVERAGE',
        name: 'Average Joe',
        townHallLevel: 15,
        attacks: [
          { attackerTownHall: 15, defenderTownHall: 16, prevStars: 0, newStars: 1, warsAgo: 0, attackOrder: 10 },
          { attackerTownHall: 15, defenderTownHall: 15, prevStars: 1, newStars: 1, warsAgo: 1, attackOrder: 9 },
        ],
        defenses: [
          { attackerTownHall: 15, defenderTownHall: 15, starsConceded: 3, warsAgo: 0 },
        ],
        participation: {
          warAttacksUsed: 1,
          warAttacksAvailable: 2,
          capitalAttacksUsed: 2,
          capitalAttacksAvailable: 6,
          fullWarStreak: 3,
          warsConsidered: 8,
          daysActiveLast30: 12,
        },
        capital: {
          capitalLoot: 1200,
          capitalAttacks: 6,
          finisherRate: 0.2,
          oneHitRate: 0.05,
        },
        donations: {
          donations: 150,
          received: 220,
        },
      },
    ];

    const scores = calculateAceScores(inputs);

    expect(scores).toHaveLength(2);
    expect(scores[0].tag).toBe('#ACE');
    expect(scores[0].ace).toBeGreaterThan(scores[1].ace);
    expect(scores[0].breakdown.ova.sampleSize).toBe(2);
    expect(scores[1].breakdown.ova.sampleSize).toBe(2);
    expect(scores[0].availability).toBeGreaterThan(scores[1].availability);
  });

  it('derives inputs from roster snapshots and produces a leaderboard', () => {
    const roster: Roster = {
      source: 'snapshot',
      clanName: 'Test Clan',
      clanTag: '#ROSTER',
      members: [
        {
          tag: '#TOP',
          name: 'Top Donor',
          townHallLevel: 16,
          donations: 800,
          donationsReceived: 200,
          trophies: 4200,
        },
        {
          tag: '#CASUAL',
          name: 'Casual',
          townHallLevel: 13,
          donations: 50,
          donationsReceived: 150,
          trophies: 3000,
        },
      ],
    };

    const inputs = createAceInputsFromRoster(roster);
    expect(inputs).toHaveLength(2);

    const scores = calculateAceScores(inputs);
    expect(scores).toHaveLength(2);
    expect(scores[0].name).toBe('Top Donor');
    expect(scores[0].ace).toBeGreaterThan(scores[1].ace);
  });
});
