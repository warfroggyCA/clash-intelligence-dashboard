import type { RosterMember } from './types';
import type { Member } from '@/types';
import { mapActivityToBand, resolveLeagueDisplay, resolveTrophies as resolveTrophiesSSOT } from '@/lib/roster-derivations';

export type RoleKey = 'leader' | 'coleader' | 'elder' | 'member';

export const normalizeRole = (role?: string | null): RoleKey => {
  const value = (role || '').toLowerCase();
  if (value.includes('co')) return 'coleader';
  if (value.includes('elder')) return 'elder';
  if (value.includes('leader')) return 'leader';
  return 'member';
};

export const resolveTownHall = (member?: RosterMember | null): number | null =>
  member ? (member.townHallLevel ?? (member as any).th ?? null) : null;

export const resolveTrophies = (member?: RosterMember | null): number | null => {
  if (!member) return null;
  return member.resolvedTrophies ?? resolveTrophiesSSOT(member);
};

export const resolveLeague = (member?: RosterMember | null): { league: string; tier?: string | number } => {
  if (!member) return { league: 'No League' };
  if (member.resolvedLeague?.name) {
    return { league: member.resolvedLeague.name, tier: member.resolvedLeague.tier ?? undefined };
  }
  const resolved = resolveLeagueDisplay(member, { allowProfileFallback: false });
  return { league: resolved.league, tier: resolved.tier ?? undefined };
};

export const resolveLeagueBadgeText = (league?: string | null, tier?: string | number) => {
  if (tier != null) return String(tier);
  if (!league) return undefined;
  const match = /\b([IV]{1,3})\b/.exec(league);
  if (match?.[1]) return match[1];
  const lower = league.toLowerCase();
  if (lower.includes('legend')) return 'L';
  if (lower.includes('titan')) return 'T';
  if (lower.includes('champion')) return 'C';
  if (lower.includes('master')) return 'M';
  if (lower.includes('crystal')) return 'CR';
  if (lower.includes('gold')) return 'G';
  if (lower.includes('silver')) return 'S';
  if (lower.includes('bronze')) return 'B';
  return undefined;
};

export const rosterLeagueSort = (members: RosterMember[]) => {
  const leagueOrder = [
    'Legend League',
    'Titan League',
    'Champion League',
    'Master League',
    'Crystal League',
    'Gold League',
    'Silver League',
    'Bronze League',
    'No League',
  ];

  const leagueScore = (league?: string, tier?: string | number) => {
    const index = leagueOrder.indexOf(league || 'No League');
    const base = index === -1 ? -1 : leagueOrder.length - index;
    const tierValue =
      typeof tier === 'number'
        ? tier
        : tier
          ? Number.isFinite(Number(tier))
            ? Number(tier)
            : null
          : null;
    const tierScore = tierValue ? Math.max(0, 4 - tierValue) : 0;
    return base * 10 + tierScore;
  };

  const isLeagueMember = (league?: string) => {
    if (!league) return false;
    const normalized = league.toLowerCase();
    if (normalized === 'no league') return false;
    if (normalized.includes('unranked')) return false;
    return true;
  };

  return [...members].sort((a, b) => {
    const leagueA = resolveLeague(a);
    const leagueB = resolveLeague(b);
    const hasLeagueA = isLeagueMember(leagueA.league);
    const hasLeagueB = isLeagueMember(leagueB.league);
    if (hasLeagueA !== hasLeagueB) return hasLeagueB ? 1 : -1;

    const thA = resolveTownHall(a) ?? -1;
    const thB = resolveTownHall(b) ?? -1;
    const trophiesA = resolveTrophies(a) ?? 0;
    const trophiesB = resolveTrophies(b) ?? 0;

    if (hasLeagueA && hasLeagueB) {
      const leagueScoreA = leagueScore(leagueA.league, leagueA.tier);
      const leagueScoreB = leagueScore(leagueB.league, leagueB.tier);
      if (leagueScoreB !== leagueScoreA) return leagueScoreB - leagueScoreA;
      if (thB !== thA) return thB - thA;
      return trophiesB - trophiesA;
    }

    if (thB !== thA) return thB - thA;
    return trophiesB - trophiesA;
  });
};

export const resolveRushPercent = (member: RosterMember | null | undefined): number | null => {
  if (!member) return null;
  return typeof member.rushPercent === 'number' ? member.rushPercent : null;
};

export const rushTone = (value?: number | null) => {
  const num = typeof value === 'number' ? value : 0;
  if (num < 10) return 'var(--success)';
  if (num < 20) return 'var(--warning)';
  return 'var(--danger)';
};

export const formatRush = (value?: number | null) =>
  typeof value === 'number' ? `${value.toFixed(1)}%` : '—';

export const resolveActivity = (member: RosterMember) => {
  const evidence = member.activity ?? null;
  const resolved = mapActivityToBand(evidence);
  const score = evidence?.score ?? null;

  // Some UIs still expect a human-readable "level" string.
  const bandToLevel = (band: string) => {
    if (band === 'High') return 'Very Active';
    if (band === 'Medium') return 'Moderate';
    if (band === 'Low') return 'Low';
    return 'Unknown';
  };

  const level = evidence?.level ?? bandToLevel(resolved.band);

  return { band: resolved.band, tone: resolved.tone, score, evidence, level };
};
