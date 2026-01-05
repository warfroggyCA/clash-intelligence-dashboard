// web-next/src/lib/league-tiers.ts
// Shared helpers for parsing and comparing Clash ranked leagues

const LEAGUE_BASE_RANK: Record<string, number> = {
  'legend league': 1200,
  'titan league': 1100,
  'electro league': 1000,
  'dragon league': 900,
  'pekka league': 800,
  'golem league': 700,
  'witch league': 600,
  'valkyrie league': 500,
  'wizard league': 400,
  'archer league': 300,
  'barbarian league': 200,
  'skeleton league': 100,
  'champion league': 950,
  'master league': 850,
  'crystal league': 750,
  'gold league': 650,
  'silver league': 550,
  'bronze league': 450,
  unranked: 0,
};

const LEAGUE_CANONICAL_NAME: Record<string, string> = {
  'legend league': 'Legend League',
  'titan league': 'Titan League',
  'electro league': 'Electro League',
  'dragon league': 'Dragon League',
  'pekka league': 'PEKKA League',
  'golem league': 'Golem League',
  'witch league': 'Witch League',
  'valkyrie league': 'Valkyrie League',
  'wizard league': 'Wizard League',
  'archer league': 'Archer League',
  'barbarian league': 'Barbarian League',
  'skeleton league': 'Skeleton League',
  'champion league': 'Champion League',
  'master league': 'Master League',
  'crystal league': 'Crystal League',
  'gold league': 'Gold League',
  'silver league': 'Silver League',
  'bronze league': 'Bronze League',
  unranked: 'Unranked',
};

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

function romanToNumber(input: string): number | null {
  const roman = input.trim().toUpperCase();
  if (!roman || !/^[IVXLCDM]+$/.test(roman)) {
    return null;
  }

  let total = 0;
  let prev = 0;
  for (let i = roman.length - 1; i >= 0; i -= 1) {
    const value = ROMAN_VALUES[roman[i]];
    if (!value) return null;
    if (value < prev) {
      total -= value;
    } else {
      total += value;
      prev = value;
    }
  }
  return total;
}

export interface RankedLeagueInfo {
  raw: string;
  baseName: string;
  tierValue: number | null;
  direction: 'ascending' | 'descending';
  baseRank: number;
  score: number;
}

const LEAGUE_REGEX =
  /^(?<base>[A-Za-z ]*?League)(?:\s+(?<suffix>[0-9]+|[IVXLCDM]+))?$/i;

export function parseRankedLeagueName(
  leagueName: string | null | undefined,
): RankedLeagueInfo | null {
  if (!leagueName) return null;
  const trimmed = leagueName.trim();
  if (!trimmed) return null;

  const match = trimmed.match(LEAGUE_REGEX);
  let baseName = trimmed;
  let suffix: string | undefined;

  if (match?.groups?.base) {
    baseName = match.groups.base.replace(/\s+/g, ' ').trim();
  }
  if (match?.groups?.suffix) {
    suffix = match.groups.suffix.trim();
  }

  let direction: RankedLeagueInfo['direction'] = 'ascending';
  let tierValue: number | null = null;

  if (suffix) {
    if (/^\d+$/.test(suffix)) {
      tierValue = Number(suffix);
    } else {
      const roman = romanToNumber(suffix);
      if (roman !== null) {
        tierValue = roman;
        direction = 'descending';
      }
    }
  }

  const normalizedBase = baseName.toLowerCase();
  const baseRank = LEAGUE_BASE_RANK[normalizedBase] ?? 0;
  const canonicalBaseName = LEAGUE_CANONICAL_NAME[normalizedBase] ?? baseName;
  const adjustedTier =
    tierValue == null
      ? 0
      : direction === 'ascending'
        ? tierValue
        : Math.max(0, 100 - tierValue);
  const score = baseRank + adjustedTier / 100;

  return {
    raw: trimmed,
    baseName: canonicalBaseName,
    tierValue,
    direction,
    baseRank,
    score,
  };
}

export function compareRankedLeagues(
  current: string | null | undefined,
  previous: string | null | undefined,
): number {
  const currentInfo = parseRankedLeagueName(current);
  const previousInfo = parseRankedLeagueName(previous);

  if (!currentInfo && !previousInfo) return 0;
  if (currentInfo && !previousInfo) return 1;
  if (!currentInfo && previousInfo) return -1;
  if (!currentInfo || !previousInfo) return 0;

  if (currentInfo.score === previousInfo.score) return 0;

  return currentInfo.score > previousInfo.score ? 1 : -1;
}
