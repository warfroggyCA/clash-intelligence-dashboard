import type { PlayerTimelinePoint } from '@/types/player-profile-supabase';
import type { HeroCaps, PlayerActivityTimelineEvent } from '@/types';

export const DEFAULT_SEASON_START_ISO = '2025-10-01T00:00:00Z';

export interface PlayerDayTimelineRow {
  date: string;
  clan_tag: string;
  player_tag: string;
  th: number | null;
  league: string | null;
  trophies: number | null;
  donations: number | null;
  donations_rcv: number | null;
  war_stars: number | null;
  attack_wins: number | null;
  defense_wins: number | null;
  capital_contrib: number | null;
  legend_attacks: number | null;
  builder_hall_level: number | null;
  builder_battle_wins: number | null;
  builder_trophies: number | null;
  hero_levels: Record<string, unknown> | null;
  equipment_levels: Record<string, number> | null;
  pets: Record<string, number> | null;
  super_troops_active: string[] | null;
  achievements: { count?: number | null; score?: number | null } | null;
  rush_percent: number | null;
  exp_level: number | null;
  deltas: Record<string, number> | null;
  events: string[] | null;
  notability: number | null;
}

export interface TimelineComputation {
  timeline: PlayerTimelinePoint[];
  lastWeekTrophies: number | null;
  seasonTotalTrophies: number | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceDeltaMap(point: PlayerTimelinePoint): Record<string, number> {
  if (!point || typeof point !== 'object' || !point.deltas) return {};
  const raw = point.deltas as Record<string, unknown>;
  return Object.entries(raw).reduce<Record<string, number>>((acc, [key, value]) => {
    const numeric = toNumber(value);
    if (numeric !== null) {
      acc[key] = numeric;
    }
    return acc;
  }, {});
}

function extractDeltaValue(deltas: Record<string, number>, ...keys: string[]): number {
  for (const key of keys) {
    if (key in deltas) {
      return deltas[key];
    }
  }
  return 0;
}

export function buildTimelineFromPlayerDay(
  rows: PlayerDayTimelineRow[],
  seasonStartIso: string = DEFAULT_SEASON_START_ISO,
): TimelineComputation {
  if (!rows.length) {
    return { timeline: [], lastWeekTrophies: null, seasonTotalTrophies: null };
  }

  const chronological = [...rows].sort((a, b) => {
    const aMs = new Date(`${a.date}T00:00:00Z`).getTime();
    const bMs = new Date(`${b.date}T00:00:00Z`).getTime();
    return aMs - bMs;
  });

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const seasonStart = new Date(seasonStartIso);
  const mondayKeys = new Set<string>();

  let lastWeekTrophies: number | null = null;
  let seasonTotal = 0;

  const timeline: PlayerTimelinePoint[] = chronological.map((row) => {
    const dateIso = row.date ?? null;
    const dateObj = dateIso ? new Date(`${dateIso}T00:00:00Z`) : null;
    const trophies = row.trophies ?? null;

    if (dateObj) {
      if (!lastWeekTrophies && dateObj >= fourteenDaysAgo && dateObj < sevenDaysAgo) {
        lastWeekTrophies = trophies ?? null;
      }

      if (dateObj >= seasonStart && dateObj.getUTCDay() === 1 && dateIso) {
        const key = `${row.player_tag}|${dateIso}`;
        if (!mondayKeys.has(key)) {
          seasonTotal += trophies ?? 0;
          mondayKeys.add(key);
        }
      }
    }

    const achievements = row.achievements || {};

    return {
      snapshotDate: dateIso,
      trophies,
      rankedTrophies: trophies,
      donations: row.donations ?? null,
      donationsReceived: row.donations_rcv ?? null,
      activityScore: null,
      heroLevels: row.hero_levels ?? null,
      warStars: row.war_stars ?? null,
      attackWins: row.attack_wins ?? null,
      defenseWins: row.defense_wins ?? null,
      capitalContributions: row.capital_contrib ?? null,
      builderHallLevel: row.builder_hall_level ?? null,
      builderTrophies: row.builder_trophies ?? null,
      builderBattleWins: row.builder_battle_wins ?? null,
      bestTrophies: null,
      bestVersusTrophies: null,
      leagueName: row.league ?? null,
      leagueTrophies: null,
      leagueId: null,
      rankedLeagueId: null,
      rankedLeagueName: null,
      superTroopsActive: row.super_troops_active ?? null,
      petLevels: row.pets ?? null,
      equipmentLevels: row.equipment_levels ?? null,
      achievementCount: typeof achievements.count === 'number' ? achievements.count : null,
      achievementScore: typeof achievements.score === 'number' ? achievements.score : null,
      expLevel: row.exp_level ?? null,
      rushPercent: row.rush_percent ?? null,
      events: Array.isArray(row.events) ? row.events : [],
      notability: row.notability ?? 0,
      deltas: (row.deltas as Record<string, number> | null) ?? null,
    } satisfies PlayerTimelinePoint;
  });

  const latest = chronological[chronological.length - 1];
  if (latest?.trophies != null) {
    seasonTotal += latest.trophies;
  }

  return {
    timeline,
    lastWeekTrophies,
    seasonTotalTrophies: Number.isFinite(seasonTotal) ? seasonTotal : null,
  };
}

export function mapTimelinePointsToActivityEvents(
  points: PlayerTimelinePoint[],
): PlayerActivityTimelineEvent[] {
  if (!points.length) return [];

  const events: PlayerActivityTimelineEvent[] = [];
  let previous: PlayerTimelinePoint | null = null;

  for (const point of points) {
    const deltas = coerceDeltaMap(point);
    const prevHeroLevels =
      (previous?.heroLevels as Record<string, unknown> | null | undefined) ?? null;
    const currentHeroLevels =
      (point.heroLevels as Record<string, unknown> | null | undefined) ?? null;

    const heroUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('hero_') && value > 0)
      .map(([key, value]) => {
        const shortKey = key.replace('hero_', '');
        const heroKey = shortKey as keyof HeroCaps;
        const previousLevel = prevHeroLevels ? toNumber(prevHeroLevels[shortKey]) : null;
        const currentLevel = currentHeroLevels ? toNumber(currentHeroLevels[shortKey]) : null;
        const delta = value;
        const from = previousLevel;
        const to =
          currentLevel ??
          (from !== null ? from + delta : delta);
        return {
          hero: heroKey,
          from,
          to,
        };
      })
      .filter((upgrade) => typeof upgrade.to === 'number');

    const petUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('pet_') && value > 0)
      .map(([key, value]) => {
        const petKey = key.replace('pet_', '');
        const previousLevel =
          previous && previous.petLevels && petKey in previous.petLevels
            ? toNumber((previous.petLevels as Record<string, unknown>)[petKey])
            : null;
        const currentLevel =
          point.petLevels && petKey in point.petLevels
            ? toNumber((point.petLevels as Record<string, unknown>)[petKey])
            : null;
        const delta = value;
        const to =
          currentLevel ??
          (previousLevel !== null ? previousLevel + delta : delta);
        return {
          pet: petKey,
          from: previousLevel,
          to,
        };
      })
      .filter((upgrade) => typeof upgrade.to === 'number');

    const equipmentUpgrades = Object.entries(deltas)
      .filter(([key, value]) => key.startsWith('equipment_') && value > 0)
      .map(([key, value]) => {
        const equipmentKey = key.replace('equipment_', '');
        const previousLevel =
          previous && previous.equipmentLevels && equipmentKey in previous.equipmentLevels
            ? toNumber((previous.equipmentLevels as Record<string, unknown>)[equipmentKey])
            : null;
        const currentLevel =
          point.equipmentLevels && equipmentKey in point.equipmentLevels
            ? toNumber((point.equipmentLevels as Record<string, unknown>)[equipmentKey])
            : null;
        const delta = value;
        const to =
          currentLevel ??
          (previousLevel !== null ? previousLevel + delta : delta);
        return {
          equipment: equipmentKey,
          from: previousLevel,
          to,
        };
      })
      .filter((upgrade) => typeof upgrade.to === 'number');

    const previousSuperTroops = new Set(previous?.superTroopsActive ?? []);
    const currentSuperTroops = new Set(point.superTroopsActive ?? []);
    const superTroopsActivated = Array.from(currentSuperTroops).filter(
      (troop) => !previousSuperTroops.has(troop),
    );
    const superTroopsDeactivated = Array.from(previousSuperTroops).filter(
      (troop) => !currentSuperTroops.has(troop),
    );

    events.push({
      date: point.snapshotDate ?? null,
      trophies: point.trophies ?? previous?.trophies ?? 0,
      rankedTrophies: point.rankedTrophies ?? null,
      donations: point.donations ?? previous?.donations ?? 0,
      donationsReceived: point.donationsReceived ?? previous?.donationsReceived ?? 0,
      activityScore: point.activityScore ?? null,
      trophyDelta: extractDeltaValue(deltas, 'trophies', 'trophy_delta', 'ranked_trophies'),
      rankedTrophyDelta: extractDeltaValue(deltas, 'ranked_trophies'),
      donationsDelta: extractDeltaValue(deltas, 'donations'),
      donationsReceivedDelta: extractDeltaValue(deltas, 'donations_rcv', 'donations_received'),
      heroUpgrades,
      petUpgrades,
      equipmentUpgrades,
      superTroopsActivated,
      superTroopsDeactivated,
      warStars: point.warStars ?? previous?.warStars ?? 0,
      warStarsDelta: extractDeltaValue(deltas, 'war_stars'),
      attackWins: point.attackWins ?? previous?.attackWins ?? 0,
      attackWinsDelta: extractDeltaValue(deltas, 'attack_wins'),
      defenseWins: point.defenseWins ?? previous?.defenseWins ?? 0,
      defenseWinsDelta: extractDeltaValue(deltas, 'defense_wins'),
      capitalContributions: point.capitalContributions ?? previous?.capitalContributions ?? 0,
      capitalContributionDelta: extractDeltaValue(deltas, 'capital_contrib', 'capital_contribution'),
      builderHallLevel: point.builderHallLevel ?? previous?.builderHallLevel ?? null,
      builderHallDelta: extractDeltaValue(deltas, 'builder_hall', 'builder_hall_level', 'bh'),
      versusBattleWins: point.builderBattleWins ?? previous?.builderBattleWins ?? 0,
      versusBattleWinsDelta: extractDeltaValue(
        deltas,
        'builder_battle_wins',
        'versus_battle_wins',
      ),
      maxTroopCount: null,
      maxTroopDelta: extractDeltaValue(deltas, 'max_troop_count'),
      maxSpellCount: null,
      maxSpellDelta: extractDeltaValue(deltas, 'max_spell_count'),
      achievementCount: point.achievementCount ?? previous?.achievementCount ?? null,
      achievementDelta: extractDeltaValue(deltas, 'achievement_count'),
      expLevel: point.expLevel ?? previous?.expLevel ?? null,
      expLevelDelta: extractDeltaValue(deltas, 'exp_level'),
      summary: '',
    });

    previous = point;
  }

  return events;
}
