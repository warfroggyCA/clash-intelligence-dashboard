import type { Member } from '@/types';

export interface ResolvedLeagueInfo {
  name: string;
  trophies?: number;
  tier?: number;
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

function romanToInt(roman: string): number | null {
  const map: Record<string, number> = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  const s = roman.toUpperCase();
  let total = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = map[s[i]] || 0;
    if (val < prev) total -= val; else total += val;
    prev = val;
  }
  return total || null;
}

function parseBaseAndTier(name: string): { base: string; tier?: number } {
  const trimmed = name.trim();
  // Matches: "Witch League 16" or "Steel League III" (roman)
  const m = trimmed.match(/^(.*?League)\s+(\d+|[IVXLCDM]+)$/i);
  if (!m) return { base: trimmed };
  const base = m[1].trim();
  const tierRaw = m[2];
  const tier = /\d+/.test(tierRaw) ? Number(tierRaw) : romanToInt(tierRaw) || undefined;
  return { base, tier };
}

export function resolveMemberLeague(member: Member): ResolvedLeagueInfo {
  // Prefer Ranked league data post-Oct 2025
  const rankedName = member.rankedLeagueName;
  const rawName = rankedName
    ?? member.leagueName
    ?? (typeof member.league === 'string' ? member.league : member.league?.name)
    ?? '';
  const trimmed = rawName.trim();
  const parsed = trimmed ? parseBaseAndTier(trimmed) : { base: '' };
  const leagueTrophies = member.rankedTrophies
    ?? member.leagueTrophies
    ?? (typeof member.league === 'object' && member.league !== null && typeof member.league.trophies === 'number'
      ? member.league.trophies
      : undefined);
  const trophies = leagueTrophies ?? member.trophies ?? undefined;

  const derivedName = deriveLeagueNameFromTrophies(trophies);
  const name = parsed.base || (trimmed.length ? trimmed : 'Unranked');

  const tierFromMember = (member as any)?.rankedLeague?.tier as number | undefined;
  const tier = tierFromMember ?? parsed.tier;
  return { name, trophies, tier };
}
