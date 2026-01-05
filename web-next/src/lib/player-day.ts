import crypto from 'crypto';
import { compareRankedLeagues } from '@/lib/league-tiers';

type HeroKeys = 'bk' | 'aq' | 'gw' | 'rc' | 'mp';

export type HeroLevels = Partial<Record<HeroKeys, number | null>>;

export interface CanonicalPlayerState {
  date: string;
  clanTag: string;
  playerTag: string;
  th?: number | null;
  league?: string | null;
  trophies?: number | null;
  donations?: number | null;
  donationsReceived?: number | null;
  warStars?: number | null;
  attackWins?: number | null;
  defenseWins?: number | null;
  capitalContrib?: number | null;
  legendAttacks?: number | null;
  builderHallLevel?: number | null;
  builderWins?: number | null;
  builderTrophies?: number | null;
  heroLevels?: HeroLevels | null;
  equipmentLevels?: Record<string, number> | null;
  pets?: Record<string, number> | null;
  superTroopsActive?: string[] | null;
  achievements?: { count: number | null; score: number | null } | null;
  rushPercent?: number | null;
  expLevel?: number | null;
}

export interface PlayerDayRow {
  playerTag: string;
  clanTag: string;
  date: string;
  th: number | null;
  league: string | null;
  trophies: number | null;
  donations: number | null;
  donationsReceived: number | null;
  warStars: number | null;
  attackWins: number | null;
  defenseWins: number | null;
  capitalContrib: number | null;
  legendAttacks: number | null;
  builderHallLevel: number | null;
  builderBattleWins: number | null;
  builderTrophies: number | null;
  heroLevels: HeroLevels | null;
  equipmentLevels: Record<string, number> | null;
  pets: Record<string, number> | null;
  superTroopsActive: string[] | null;
  achievements: { count: number | null; score: number | null } | null;
  rushPercent: number | null;
  expLevel: number | null;
  deltas: Record<string, number>;
  events: string[];
  notability: number;
  snapshotHash: string;
}

const TROPHY_DELTA_THRESHOLD = 100;
const DONATION_THRESHOLD = 50;
const WAR_STAR_THRESHOLD = 4;
const LEGEND_REENTRY = 'Legend League';
const BUILDER_WIN_STREAK_THRESHOLD = 3;
const BUILDER_TROPHY_THRESHOLD = 30;

const EVENT_CATEGORY: Record<string, string> = {
  th_level_up: 'upgrade',
  hero_level_up: 'upgrade',
  pet_level_up: 'companions',
  equipment_upgrade: 'companions',
  league_change: 'league',
  league_promotion: 'league',
  league_demotion: 'league',
  legend_reentry: 'league',
  trophies_big_delta: 'trophies',
  war_perf_day: 'war',
  war_activity: 'war',
  capital_activity: 'capital',
  donations_threshold: 'donations',
  legend_activity: 'activity',
  builder_activity: 'builder',
};

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function diffNumber(prev?: number | null, curr?: number | null): number | null {
  if (typeof prev !== 'number' || typeof curr !== 'number') return null;
  const delta = curr - prev;
  return delta !== 0 ? delta : null;
}

function diffHero(prev?: HeroLevels | null, curr?: HeroLevels | null): Record<string, number> {
  const keys: HeroKeys[] = ['bk', 'aq', 'gw', 'rc', 'mp'];
  const changes: Record<string, number> = {};
  for (const key of keys) {
    const before = typeof prev?.[key] === 'number' ? prev![key]! : null;
    const after = typeof curr?.[key] === 'number' ? curr![key]! : null;
    if (before !== null && after !== null && after !== before) {
      changes[key] = after - before;
    }
  }
  return changes;
}

function jsonChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

export function generatePlayerDayRow(
  prev: CanonicalPlayerState | null | undefined,
  curr: CanonicalPlayerState,
): PlayerDayRow {
  const deltas: Record<string, number> = {};
  const events: string[] = [];

  const trophyDelta = diffNumber(prev?.trophies ?? null, curr.trophies ?? null);
  if (trophyDelta !== null) {
    deltas.trophies = trophyDelta;
    if (Math.abs(trophyDelta) >= TROPHY_DELTA_THRESHOLD) {
      events.push('trophies_big_delta');
    }
  }

  const donationDelta = diffNumber(prev?.donations ?? null, curr.donations ?? null);
  if (donationDelta !== null) {
    deltas.donations = donationDelta;
  }

  const donationRecvDelta = diffNumber(prev?.donationsReceived ?? null, curr.donationsReceived ?? null);
  if (donationRecvDelta !== null) {
    deltas.donations_rcv = donationRecvDelta;
  }

  const warStarsDelta = diffNumber(prev?.warStars ?? null, curr.warStars ?? null);
  if (warStarsDelta !== null) {
    deltas.war_stars = warStarsDelta;
  }

  const attackWinsDelta = diffNumber(prev?.attackWins ?? null, curr.attackWins ?? null);
  if (attackWinsDelta !== null) {
    deltas.attack_wins = attackWinsDelta;
  }

  const defenseWinsDelta = diffNumber(prev?.defenseWins ?? null, curr.defenseWins ?? null);
  if (defenseWinsDelta !== null) {
    deltas.defense_wins = defenseWinsDelta;
  }

  const capitalDelta = diffNumber(prev?.capitalContrib ?? null, curr.capitalContrib ?? null);
  if (capitalDelta !== null) {
    deltas.capital_contrib = capitalDelta;
  }

  const legendAttackDelta = diffNumber(prev?.legendAttacks ?? null, curr.legendAttacks ?? null);
  if (legendAttackDelta !== null) {
    deltas.legend_attacks = legendAttackDelta;
  }

  const builderHallDelta = diffNumber(prev?.builderHallLevel ?? null, curr.builderHallLevel ?? null);
  if (builderHallDelta !== null) {
    deltas.builder_hall = builderHallDelta;
  }

  const builderWinsDelta = diffNumber(prev?.builderWins ?? null, curr.builderWins ?? null);
  if (builderWinsDelta !== null) {
    deltas.builder_battle_wins = builderWinsDelta;
  }

  const builderTrophiesDelta = diffNumber(prev?.builderTrophies ?? null, curr.builderTrophies ?? null);
  if (builderTrophiesDelta !== null) {
    deltas.builder_trophies = builderTrophiesDelta;
  }

  if (typeof prev?.th === 'number' && typeof curr.th === 'number' && curr.th !== prev.th) {
    deltas.th = curr.th - prev.th;
    events.push('th_level_up');
  }

  if (prev?.league && curr.league && prev.league !== curr.league) {
    events.push('league_change');
    const leagueDelta = compareRankedLeagues(curr.league, prev.league);
    if (leagueDelta > 0) {
      events.push('league_promotion');
      deltas.league_rank = leagueDelta;
    } else if (leagueDelta < 0) {
      events.push('league_demotion');
      deltas.league_rank = leagueDelta;
    }
  }

  if (curr.league === LEGEND_REENTRY && prev?.league !== LEGEND_REENTRY) {
    events.push('legend_reentry');
  }

  const heroDiffs = diffHero(prev?.heroLevels ?? null, curr.heroLevels ?? null);
  if (Object.keys(heroDiffs).length > 0) {
    for (const [hero, diff] of Object.entries(heroDiffs)) {
      deltas[`hero_${hero}`] = diff;
    }
    events.push('hero_level_up');
  }

  if (jsonChanged(prev?.pets, curr.pets)) {
    events.push('pet_level_up');
  }

  if (jsonChanged(prev?.equipmentLevels, curr.equipmentLevels)) {
    events.push('equipment_upgrade');
  }

  if (typeof curr.donations === 'number' && curr.donations >= DONATION_THRESHOLD) {
    events.push('donations_threshold');
  }

  if (typeof curr.warStars === 'number' && curr.warStars >= WAR_STAR_THRESHOLD) {
    events.push('war_perf_day');
  }

  if ((warStarsDelta ?? 0) > 0 || (attackWinsDelta ?? 0) > 0 || (defenseWinsDelta ?? 0) > 0) {
    if (!events.includes('war_activity')) {
      events.push('war_activity');
    }
  }

  if (typeof curr.capitalContrib === 'number' && curr.capitalContrib > 0) {
    events.push('capital_activity');
  }

  if (typeof curr.legendAttacks === 'number' && curr.legendAttacks > 0) {
    events.push('legend_activity');
  }

  const builderEventTriggered =
    (builderHallDelta ?? 0) > 0 ||
    (builderWinsDelta ?? 0) >= BUILDER_WIN_STREAK_THRESHOLD ||
    Math.abs(builderTrophiesDelta ?? 0) >= BUILDER_TROPHY_THRESHOLD;

  if (builderEventTriggered) {
    if (!events.includes('builder_activity')) {
      events.push('builder_activity');
    }
  }

  const categories = new Set<string>();
  for (const event of events) {
    categories.add(EVENT_CATEGORY[event] ?? event);
  }
  const notability = categories.size;

  const coreForHash = {
    th: curr.th ?? null,
    league: curr.league ?? null,
    trophies: curr.trophies ?? null,
    donations: curr.donations ?? null,
    donations_rcv: curr.donationsReceived ?? null,
    war_stars: curr.warStars ?? null,
    attack_wins: curr.attackWins ?? null,
    defense_wins: curr.defenseWins ?? null,
    capital_contrib: curr.capitalContrib ?? null,
    legend_attacks: curr.legendAttacks ?? null,
    builder_hall_level: curr.builderHallLevel ?? null,
    builder_battle_wins: curr.builderWins ?? null,
    builder_trophies: curr.builderTrophies ?? null,
    hero_levels: curr.heroLevels ?? null,
    equipment_levels: curr.equipmentLevels ?? null,
    pets: curr.pets ?? null,
    super_troops_active: curr.superTroopsActive ?? null,
    achievements: curr.achievements ?? null,
    rush_percent: curr.rushPercent ?? null,
    exp_level: curr.expLevel ?? null,
  };

  const snapshotHash = md5(JSON.stringify(coreForHash));

  return {
    playerTag: curr.playerTag,
    clanTag: curr.clanTag,
    date: curr.date,
    th: curr.th ?? null,
    league: curr.league ?? null,
    trophies: curr.trophies ?? null,
    donations: curr.donations ?? null,
    donationsReceived: curr.donationsReceived ?? null,
    warStars: curr.warStars ?? null,
    attackWins: curr.attackWins ?? null,
    defenseWins: curr.defenseWins ?? null,
    capitalContrib: curr.capitalContrib ?? null,
    legendAttacks: curr.legendAttacks ?? null,
    builderHallLevel: curr.builderHallLevel ?? null,
    builderBattleWins: curr.builderWins ?? null,
    builderTrophies: curr.builderTrophies ?? null,
    heroLevels: curr.heroLevels ?? null,
    equipmentLevels: curr.equipmentLevels ?? null,
    pets: curr.pets ?? null,
    superTroopsActive: curr.superTroopsActive ?? null,
    achievements: curr.achievements ?? null,
    rushPercent: curr.rushPercent ?? null,
    expLevel: curr.expLevel ?? null,
    deltas,
    events: Array.from(new Set(events)),
    notability,
    snapshotHash,
  };
}
