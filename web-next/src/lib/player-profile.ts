export type PlayerRoleTone = 'leader' | 'coleader' | 'elder' | 'member';

export interface PlayerProfileSummary {
  name: string;
  tag: string;
  role: PlayerRoleTone;
  clanName: string;
  clanTag: string;
  townHallLevel: number;
  league: {
    name: string;
    trophies: number;
  };
  joinDate?: string;
  activityLevel: 'Very Active' | 'Active' | 'Moderate' | 'Low' | 'Inactive';
  rushScore: number;
  donationBalance: {
    given: number;
    received: number;
    balance: number;
  };
  lastSeen?: string;
}

export interface PlayerHeroProgressItem {
  hero: 'Barbarian King' | 'Archer Queen' | 'Grand Warden' | 'Royal Champion' | 'Minion Prince';
  shortLabel: string;
  level: number;
  maxLevel: number;
  upgrading?: {
    targetLevel: number;
    completeAt?: string;
  };
}

export interface PlayerPerformanceOverviewData {
  war: {
    hitRate: number;
    starsPerAttack: number;
    recentWars: Array<{
      id: string;
      opponent: string;
      result: 'WIN' | 'LOSE' | 'TIE';
      stars: number;
      teamSize: number;
      delta: number;
    }>;
  };
  capital: {
    totalLoot: number;
    carryScore: number;
    participationRate: number;
  };
  activityTrend: number[];
}

export interface PlayerEngagementInsight {
  id: string;
  title: string;
  description: string;
  tone?: 'positive' | 'warning' | 'neutral';
}

export interface PlayerNoteItem {
  id: string;
  author: string;
  createdAt: string;
  content: string;
  tags?: string[];
}

export interface PlayerProfileData {
  summary: PlayerProfileSummary;
  heroProgress: PlayerHeroProgressItem[];
  performance: PlayerPerformanceOverviewData;
  engagementInsights: PlayerEngagementInsight[];
  leadershipNotes: PlayerNoteItem[];
  upcomingActions: Array<{
    id: string;
    label: string;
    description?: string;
    dueAt?: string;
  }>;
}

export function normalizePlayerTag(tag: string): string {
  const cleaned = tag.trim();
  return cleaned.startsWith('#') ? cleaned.slice(1).toUpperCase() : cleaned.toUpperCase();
}

export async function fetchPlayerProfile(tag: string): Promise<PlayerProfileData> {
  const normalized = normalizePlayerTag(tag);

  // TODO: Replace this mocked payload with real data once the player endpoints are ready.
  return {
    summary: {
      name: 'DoubleD',
      tag: `#${normalized}`,
      role: 'coleader',
      clanName: 'Heck Yeah',
      clanTag: '#2PR8R8V8P',
      townHallLevel: 13,
      league: {
        name: 'Champion League',
        trophies: 2577,
      },
      joinDate: '2024-02-16T00:00:00.000Z',
      activityLevel: 'Very Active',
      rushScore: 22.5,
      donationBalance: {
        given: 3312,
        received: 1980,
        balance: 1332,
      },
      lastSeen: '2025-09-29T14:20:00.000Z',
    },
    heroProgress: [
      { hero: 'Barbarian King', shortLabel: 'BK', level: 75, maxLevel: 80 },
      { hero: 'Archer Queen', shortLabel: 'AQ', level: 78, maxLevel: 80 },
      { hero: 'Grand Warden', shortLabel: 'GW', level: 53, maxLevel: 55 },
      { hero: 'Royal Champion', shortLabel: 'RC', level: 30, maxLevel: 30, upgrading: { targetLevel: 31, completeAt: '2025-10-03T18:00:00.000Z' } },
      { hero: 'Minion Prince', shortLabel: 'MP', level: 36, maxLevel: 40 },
    ],
    performance: {
      war: {
        hitRate: 82,
        starsPerAttack: 2.6,
        recentWars: [
          { id: 'war-1', opponent: 'Red Dusk', result: 'WIN', stars: 27, teamSize: 15, delta: +5 },
          { id: 'war-2', opponent: 'Shadow Kings', result: 'LOSE', stars: 24, teamSize: 15, delta: -3 },
          { id: 'war-3', opponent: 'Nova Rising', result: 'WIN', stars: 29, teamSize: 30, delta: +7 },
        ],
      },
      capital: {
        totalLoot: 318400,
        carryScore: 84,
        participationRate: 96,
      },
      activityTrend: [88, 92, 95, 97, 93, 96, 99],
    },
    engagementInsights: [
      {
        id: 'insight-1',
        title: 'Consistent Top Donator',
        description: 'Has exceeded 3,000 donations every season for the past 3 months.',
        tone: 'positive',
      },
      {
        id: 'insight-2',
        title: 'Cleanup Specialist',
        description: 'Secured 4 cleanup triples in the last 6 wars. Consider assigning second-wave targets.',
        tone: 'neutral',
      },
      {
        id: 'insight-3',
        title: 'Hero Upgrade Opportunity',
        description: 'Royal Champion reaches max in 4 days. Queue Grand Warden next to keep upgrade cadence.',
        tone: 'warning',
      },
    ],
    leadershipNotes: [
      {
        id: 'note-1',
        author: 'MD.Soudhos$',
        createdAt: '2025-09-12T08:45:00.000Z',
        content: 'Delivered strong cleanups in the last CWL. Keep them on the second wave assignments.',
        tags: ['cwl', 'cleanup'],
      },
      {
        id: 'note-2',
        author: 'Tigress',
        createdAt: '2025-09-01T22:13:00.000Z',
        content: 'Mentioned job travel first week of October. Schedule bench slot for upcoming war.',
        tags: ['availability'],
      },
    ],
    upcomingActions: [
      {
        id: 'action-1',
        label: 'Confirm travel schedule',
        description: 'Double-check October availability before CWL roster lock.',
        dueAt: '2025-10-01T00:00:00.000Z',
      },
      {
        id: 'action-2',
        label: 'Prep next hero upgrade plan',
      },
    ],
  };
}
