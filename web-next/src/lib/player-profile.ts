import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import type { FullClanSnapshot } from './full-snapshot';
import { convertFullSnapshotToDailySnapshot } from './snapshots';
import { calculateActivityScore, calculateRushPercentage } from './business/calculations';
import { HERO_MAX_LEVELS } from '@/types';
import type { HeroCaps } from '@/types';
import { parseRole } from './leadership';
import type { Member as DomainMember } from '@/types';

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
  shortLabel: 'BK' | 'AQ' | 'GW' | 'RC' | 'MP';
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
  activityTrend: Array<{
    period: string;
    playerScore: number;
    clanAverage: number;
  }>;
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
  const normalized = normalizeTag(tag);
  return normalized.replace('#', '');
}

export async function fetchPlayerProfile(tag: string): Promise<PlayerProfileData> {
  const normalizedWithHash = normalizeTag(tag);
  const normalized = normalizePlayerTag(tag);

  try {
    const profile = await buildProfileFromSnapshots(normalizedWithHash);
    if (profile) {
      return profile;
    }
  } catch (error) {
    console.warn('[PlayerProfile] Failed to build player profile from snapshots', error);
  }

  return buildMockProfile(normalized);
}

async function buildProfileFromSnapshots(playerTagWithHash: string): Promise<PlayerProfileData | null> {
  if (!cfg.useSupabase) {
    return null;
  }

  const clanTag = cfg.homeClanTag;
  if (!clanTag) {
    return null;
  }

  const normalizedPlayerTag = normalizeTag(playerTagWithHash);
  const snapshots = await loadRecentFullSnapshots(clanTag, 8);
  if (!snapshots.length) {
    return null;
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  const dailySnapshot = convertFullSnapshotToDailySnapshot(latestSnapshot);

  const member = dailySnapshot.members.find((m) => normalizeTag(m.tag) === normalizedPlayerTag);
  const playerDetail = latestSnapshot.playerDetails?.[normalizedPlayerTag];

  if (!member || !playerDetail) {
    return null;
  }

  const calcMember = mapMemberForCalculations(member);
  const activity = calculateActivityScore(calcMember);
  const rushScore = calculateRushPercentage(calcMember);
  const townHallLevel = calcMember.townHallLevel ?? playerDetail.townHallLevel ?? 0;

  const donationsGiven = calcMember.donations ?? 0;
  const donationsReceived = calcMember.donationsReceived ?? 0;
  const donationNet = donationsGiven - donationsReceived;

  const parsedRole = parseRole(member.role || 'member');
  const roleTone: PlayerRoleTone = parsedRole === 'coLeader' ? 'coleader' : parsedRole;

  const heroProgress = buildHeroProgress(playerDetail, townHallLevel);
  const warPerformance = computeWarPerformance(latestSnapshot);
  const capitalPerformance = computeCapitalPerformance(latestSnapshot, normalizedPlayerTag);
  const activityTrend = buildActivityTrend(snapshots, normalizedPlayerTag);

  const engagementInsights = deriveEngagementInsights({
    donationNet,
    heroProgress,
    capitalPerformance,
    activityTrend,
  });

  const upcomingActions = deriveUpcomingActions({
    donationNet,
    heroProgress,
    capitalPerformance,
    activityTrend,
  });

  return {
    summary: {
      name: member.name,
      tag: normalizedPlayerTag,
      role: roleTone,
      clanName: dailySnapshot.clanName ?? latestSnapshot.clan?.name ?? '',
      clanTag: dailySnapshot.clanTag,
      townHallLevel,
      league: {
        name: playerDetail.league?.name ?? 'Unranked',
        trophies: playerDetail.trophies ?? member.trophies ?? 0,
      },
      activityLevel: activity.level,
      rushScore: Number(rushScore.toFixed(1)),
      donationBalance: {
        given: donationsGiven,
        received: donationsReceived,
        balance: donationNet,
      },
      lastSeen: undefined,
    },
    heroProgress,
    performance: {
      war: warPerformance,
      capital: capitalPerformance,
      activityTrend,
    },
    engagementInsights,
    leadershipNotes: [],
    upcomingActions,
  };
}

async function loadRecentFullSnapshots(clanTag: string, limit: number): Promise<FullClanSnapshot[]> {
  if (!cfg.useSupabase) {
    return [];
  }

  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const safeTag = safeTagForFilename(normalizedClanTag);
    
    const { getSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('clan_snapshots')
      .select('*')
      .eq('clan_tag', safeTag)
      .order('snapshot_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[PlayerProfile] Failed to load snapshots from Supabase:', error);
      return [];
    }

    return (data || []).map((record): FullClanSnapshot => ({
      clanTag: normalizeTag(record.clan_tag),
      fetchedAt: record.fetched_at,
      clan: record.clan,
      memberSummaries: record.member_summaries,
      playerDetails: record.player_details,
      currentWar: record.current_war,
      warLog: record.war_log,
      capitalRaidSeasons: record.capital_seasons,
      metadata: record.metadata,
    }));
  } catch (error) {
    console.warn('[PlayerProfile] Unable to load snapshots from Supabase:', error);
    return [];
  }
}

function buildHeroProgress(playerDetail: any, townHallLevel: number): PlayerHeroProgressItem[] {
  const heroOrder: Array<{ key: keyof HeroCaps; label: PlayerHeroProgressItem['hero']; short: PlayerHeroProgressItem['shortLabel'] }> = [
    { key: 'bk', label: 'Barbarian King', short: 'BK' },
    { key: 'aq', label: 'Archer Queen', short: 'AQ' },
    { key: 'gw', label: 'Grand Warden', short: 'GW' },
    { key: 'rc', label: 'Royal Champion', short: 'RC' },
    { key: 'mp', label: 'Minion Prince', short: 'MP' },
  ];

  const heroLevels = Array.isArray(playerDetail?.heroes) ? playerDetail.heroes : [];
  const caps = HERO_MAX_LEVELS[townHallLevel] || {};

  return heroOrder
    .map(({ key, label, short }) => {
      const detail = heroLevels.find((h: any) => typeof h?.name === 'string' && h.name.toLowerCase().includes(label.toLowerCase()));
      const level = detail?.level ?? detail?.currentLevel ?? 0;
      const maxLevel = caps[key] || detail?.maxLevel || 0;

      return {
        hero: label,
        shortLabel: short,
        level,
        maxLevel,
      } as PlayerHeroProgressItem;
    })
    .filter((entry) => entry.maxLevel > 0);
}

function mapMemberForCalculations(member: import('./snapshots').Member): DomainMember {
  const { bk, aq, gw, rc, mp, ...rest } = member;
  return {
    ...rest,
    bk: bk ?? undefined,
    aq: aq ?? undefined,
    gw: gw ?? undefined,
    rc: rc ?? undefined,
    mp: mp ?? undefined,
  } as DomainMember;
}

function computeWarPerformance(snapshot: FullClanSnapshot): PlayerPerformanceOverviewData['war'] {
  const warLog = Array.isArray(snapshot.warLog) ? snapshot.warLog.slice(0, 5) : [];

  let totalAttacks = 0;
  let totalStars = 0;

  const recentWars = warLog.map((war, index) => {
    const clanStats = war.clan || {};
    const opponentStats = war.opponent || {};
    const attacks = typeof clanStats.attacks === 'number' ? clanStats.attacks : 0;
    const stars = typeof clanStats.stars === 'number' ? clanStats.stars : 0;
    const opponentStars = typeof opponentStats.stars === 'number' ? opponentStats.stars : 0;

    totalAttacks += attacks;
    totalStars += stars;

    let result = typeof war.result === 'string' ? war.result.toUpperCase() : '';
    if (!result) {
      result = stars > opponentStars ? 'WIN' : stars < opponentStars ? 'LOSE' : 'TIE';
    }

    return {
      id: war.endTime ?? `${opponentStats.name || 'opponent'}-${index}`,
      opponent: opponentStats.name || 'Unknown Opponent',
      result: (result === 'WIN' || result === 'LOSE' || result === 'TIE') ? result : 'TIE',
      stars,
      teamSize: war.teamSize ?? 0,
      delta: stars - opponentStars,
    };
  });

  const hitRate = totalAttacks > 0 ? Number(((totalStars / (totalAttacks * 3)) * 100).toFixed(1)) : 0;
  const starsPerAttack = totalAttacks > 0 ? Number((totalStars / totalAttacks).toFixed(2)) : 0;

  return {
    hitRate,
    starsPerAttack,
    recentWars,
  };
}

function computeCapitalPerformance(snapshot: FullClanSnapshot, playerTag: string): PlayerPerformanceOverviewData['capital'] {
  const seasons = Array.isArray(snapshot.capitalRaidSeasons) ? snapshot.capitalRaidSeasons.slice(0, 4) : [];

  let totalLoot = 0;
  let totalAttacks = 0;
  let participationCount = 0;

  for (const season of seasons) {
    const members = Array.isArray(season?.members) ? season.members : [];
    const entry = members.find((m: any) => normalizeTag(m.tag) === playerTag);
    if (!entry) continue;

    participationCount += 1;
    totalLoot += entry.capitalResourcesLooted ?? 0;
    totalAttacks += entry.attacks ?? 0;
  }

  const participationRate = seasons.length > 0 ? Math.round((participationCount / seasons.length) * 100) : 0;
  const carryScore = totalAttacks > 0 ? Math.round(totalLoot / totalAttacks) : totalLoot > 0 ? totalLoot : 0;

  return {
    totalLoot,
    carryScore,
    participationRate,
  };
}

function buildActivityTrend(snapshots: FullClanSnapshot[], playerTag: string): PlayerPerformanceOverviewData['activityTrend'] {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

  return snapshots
    .map((snapshot) => {
      const daily = convertFullSnapshotToDailySnapshot(snapshot);
      const member = daily.members.find((m) => normalizeTag(m.tag) === playerTag);
      if (!member) return null;

      const playerScore = calculateActivityScore(mapMemberForCalculations(member)).score;
      const clanScores = daily.members.map((m) => calculateActivityScore(mapMemberForCalculations(m)).score);
      const clanAverage = clanScores.length > 0 ? clanScores.reduce((sum, value) => sum + value, 0) / clanScores.length : 0;

      return {
        period: formatter.format(new Date(snapshot.fetchedAt)),
        playerScore: Number(playerScore.toFixed(1)),
        clanAverage: Number(clanAverage.toFixed(1)),
      };
    })
    .filter((entry): entry is PlayerPerformanceOverviewData['activityTrend'][number] => Boolean(entry));
}

interface InsightContext {
  donationNet: number;
  heroProgress: PlayerHeroProgressItem[];
  capitalPerformance: PlayerPerformanceOverviewData['capital'];
  activityTrend: PlayerPerformanceOverviewData['activityTrend'];
}

function deriveEngagementInsights(context: InsightContext): PlayerEngagementInsight[] {
  const insights: PlayerEngagementInsight[] = [];
  const { donationNet, heroProgress, capitalPerformance, activityTrend } = context;

  if (donationNet > 0) {
    insights.push({
      id: 'insight-donations-positive',
      title: 'Donation Leader',
      description: `Giving ${donationNet.toLocaleString()} more troops than received this season. Keep the generosity flowing!`,
      tone: 'positive',
    });
  } else if (donationNet < 0) {
    insights.push({
      id: 'insight-donations-negative',
      title: 'Donation Deficit',
      description: `Receiving ${Math.abs(donationNet).toLocaleString()} more capacity than given. Aim to balance donations this week.`,
      tone: 'warning',
    });
  }

  const lowestHero = heroProgress
    .map((hero) => ({
      hero,
      ratio: hero.maxLevel > 0 ? hero.level / hero.maxLevel : 1,
    }))
    .sort((a, b) => a.ratio - b.ratio)[0];

  if (lowestHero && lowestHero.hero.maxLevel > 0 && lowestHero.ratio < 0.65) {
    insights.push({
      id: 'insight-hero-upgrade',
      title: `${lowestHero.hero.hero} Needs Attention`,
      description: `${lowestHero.hero.hero} is at ${Math.round(lowestHero.ratio * 100)}% of the Town Hall cap. Prioritize upgrades to close the gap.`,
      tone: 'warning',
    });
  }

  const latestTrend = activityTrend[activityTrend.length - 1];
  if (latestTrend) {
    if (latestTrend.playerScore >= latestTrend.clanAverage + 5) {
      insights.push({
        id: 'insight-activity-positive',
        title: 'Pacing the Clan',
        description: `Activity index sits ${Math.round(latestTrend.playerScore - latestTrend.clanAverage)} points above clan average. Momentum looks great.`,
        tone: 'positive',
      });
    } else if (latestTrend.playerScore + 5 <= latestTrend.clanAverage) {
      insights.push({
        id: 'insight-activity-warning',
        title: 'Below Clan Tempo',
        description: `Activity has dipped ${Math.round(latestTrend.clanAverage - latestTrend.playerScore)} points below the clan average. Re-engage with raids and donations.`,
        tone: 'warning',
      });
    }
  }

  if (capitalPerformance.participationRate < 60) {
    insights.push({
      id: 'insight-capital-participation',
      title: 'Capital Participation Opportunity',
      description: `Participated in ${capitalPerformance.participationRate}% of recent raid weekends. Scheduling a full six attacks would boost the clan's carry potential.`,
      tone: 'neutral',
    });
  }

  return insights;
}

function deriveUpcomingActions(context: InsightContext): PlayerProfileData['upcomingActions'] {
  const actions: PlayerProfileData['upcomingActions'] = [];
  const { donationNet, heroProgress, capitalPerformance, activityTrend } = context;

  if (donationNet < 0) {
    actions.push({
      id: 'action-balance-donations',
      label: 'Balance donation ledger',
      description: 'Aim for a positive donation balance before the weekend war prep phase.',
    });
  }

  const lowestHero = heroProgress
    .map((hero) => ({
      hero,
      ratio: hero.maxLevel > 0 ? hero.level / hero.maxLevel : 1,
    }))
    .sort((a, b) => a.ratio - b.ratio)[0];

  if (lowestHero && lowestHero.hero.maxLevel > 0 && lowestHero.ratio < 0.65) {
    actions.push({
      id: `action-upgrade-${lowestHero.hero.shortLabel.toLowerCase()}`,
      label: `Upgrade ${lowestHero.hero.hero}`,
      description: `Queue the next upgrade to push ${lowestHero.hero.hero} beyond ${Math.round(lowestHero.ratio * 100)}% of cap.`,
    });
  }

  const latestTrend = activityTrend[activityTrend.length - 1];
  if (latestTrend && latestTrend.playerScore < latestTrend.clanAverage) {
    actions.push({
      id: 'action-boost-activity',
      label: 'Lock in daily activity',
      description: 'Schedule attacks and donations this week to lift the activity index back above clan pace.',
    });
  }

  if (capitalPerformance.participationRate < 60) {
    actions.push({
      id: 'action-capital-focus',
      label: 'Commit full capital attacks',
      description: 'Plan for six raids next weekend to maximize capital loot and maintain carry score.',
    });
  }

  return actions;
}

function buildMockProfile(normalized: string): PlayerProfileData {
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
      activityTrend: [
        { period: 'Mar 10', playerScore: 88, clanAverage: 74 },
        { period: 'Mar 17', playerScore: 92, clanAverage: 76 },
        { period: 'Mar 24', playerScore: 95, clanAverage: 78 },
        { period: 'Mar 31', playerScore: 97, clanAverage: 80 },
        { period: 'Apr 07', playerScore: 93, clanAverage: 77 },
        { period: 'Apr 14', playerScore: 96, clanAverage: 79 },
        { period: 'Apr 21', playerScore: 99, clanAverage: 81 },
      ],
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
