import type { Member } from '@/types';

export interface ResolvedLeagueInfo {
  name: string;
  trophies?: number;
}

function deriveLeagueNameFromTrophies(trophies?: number): string | undefined {
  if (trophies == null) return undefined;
  if (trophies >= 5000) return 'Legend';
  if (trophies >= 4000) return 'Titan';
  if (trophies >= 3000) return 'Champion';
  if (trophies >= 2000) return 'Master';
  if (trophies >= 1400) return 'Crystal';
  if (trophies >= 800) return 'Gold';
  if (trophies >= 400) return 'Silver';
  if (trophies > 0) return 'Bronze';
  return undefined;
}

export function resolveMemberLeague(member: Member): ResolvedLeagueInfo {
  const rawName = member.leagueName
    ?? (typeof member.league === 'string' ? member.league : member.league?.name)
    ?? '';
  const trimmed = rawName.trim();
  const leagueTrophies = member.leagueTrophies
    ?? (typeof member.league === 'object' && member.league !== null && typeof member.league.trophies === 'number'
      ? member.league.trophies
      : undefined);
  const trophies = leagueTrophies ?? member.trophies ?? undefined;

  const derivedName = deriveLeagueNameFromTrophies(trophies);
  const name = trimmed.length
    ? trimmed
    : 'Unranked';

  return { name, trophies };
}
