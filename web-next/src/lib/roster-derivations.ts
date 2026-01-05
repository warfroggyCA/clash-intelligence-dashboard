import type { ActivityEvidence, ActivityLevel, Member } from '@/types';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';

export type TrophySource = {
  rankedTrophies?: number | null;
  trophies?: number | null;
  leagueTrophies?: number | null;
  battleModeTrophies?: number | null;
  ranked_trophies?: number | null;
  league_trophies?: number | null;
  battle_mode_trophies?: number | null;
};

export type LeagueSource = {
  rankedLeagueName?: string | null;
  leagueName?: string | null;
  ranked_league_name?: string | null;
  league_name?: string | null;
  rankedLeague?: { name?: string | null; tier?: number | string | null } | null;
  rankedModifier?: { tier?: number | string | null } | null;
};

export type HeroSource = {
  heroLevels?: Record<string, number | null | undefined> | null;
  hero_levels?: Record<string, number | null | undefined> | null;
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
};

export type ActivityBand = 'High' | 'Medium' | 'Low';

const HERO_KEYS = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickFirstNumber = (...values: Array<unknown>): number | null => {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

const normalizeRankedTrophies = (value: unknown): number | null => {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  return numeric > 0 ? numeric : null;
};

export const resolveTrophies = (source?: TrophySource | null): number | null => {
  if (!source) return null;
  const ranked = normalizeRankedTrophies(source.rankedTrophies ?? source.ranked_trophies);
  return (
    ranked ??
    pickFirstNumber(source.trophies, source.leagueTrophies, source.league_trophies, source.battleModeTrophies, source.battle_mode_trophies)
  );
};

export const resolveLeagueName = (
  source?: LeagueSource | null,
  options?: { allowProfileFallback?: boolean }
): string | null => {
  if (!source) return null;
  const primary =
    source.rankedLeagueName ??
    source.ranked_league_name ??
    source.leagueName ??
    source.league_name ??
    null;
  if (primary) return primary;
  if (options?.allowProfileFallback) {
    return source.rankedLeague?.name ?? null;
  }
  return null;
};

const romanToNumber = (value?: string | number | null): number | null => {
  if (typeof value === 'number') return value;
  if (!value) return null;
  const normalized = String(value).toUpperCase().trim();
  if (normalized === 'I') return 1;
  if (normalized === 'II') return 2;
  if (normalized === 'III') return 3;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

export const resolveLeagueDisplay = (
  source?: LeagueSource | null,
  options?: { allowProfileFallback?: boolean }
): { league: string; tier?: string | number; hasLeague: boolean } => {
  const name = resolveLeagueName(source, options);
  const tier =
    source?.rankedModifier?.tier ??
    source?.rankedLeague?.tier ??
    null;
  const match = name ? name.match(/^(.*?)(?:\s+([IVX]+|\d+))?$/) : null;
  const base = match?.[1]?.trim() || name?.trim() || 'No League';
  const tierValue = tier ?? match?.[2] ?? null;
  const isLeagueMember = (() => {
    const normalized = base.toLowerCase();
    if (normalized === 'no league') return false;
    if (normalized.includes('unranked')) return false;
    return Boolean(name);
  })();
  return {
    league: base,
    tier: tierValue ?? undefined,
    hasLeague: isLeagueMember,
  };
};

export const resolveHeroPower = (source?: HeroSource | null): number | null => {
  if (!source) return null;
  const levels = source.heroLevels ?? source.hero_levels ?? {};
  let total = 0;
  let hasAny = false;
  for (const key of HERO_KEYS) {
    const raw = (source as Record<string, unknown>)[key] ?? (levels as Record<string, unknown>)[key];
    const numeric = toNumber(raw);
    if (numeric !== null) {
      total += numeric;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
};

export const resolveActivityEvidence = (member: Member): ActivityEvidence => {
  return resolveMemberActivity(member);
};

export const mapActivityToBand = (activity: ActivityEvidence | null | undefined): {
  band: ActivityBand;
  tone: string;
} => {
  const level = activity?.level ?? 'Inactive';
  let band: ActivityBand;
  if (level === 'Very Active' || level === 'Active') band = 'High';
  else if (level === 'Moderate') band = 'Medium';
  else band = 'Low';
  const tone = band === 'High' ? 'var(--success)' : band === 'Medium' ? 'var(--warning)' : 'var(--danger)';
  return { band, tone };
};

export const mapActivityLevel = (level?: ActivityLevel | null): ActivityLevel => {
  if (!level) return 'Inactive';
  return level;
};
