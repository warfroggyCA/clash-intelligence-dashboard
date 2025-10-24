// web-next/src/lib/league-tiers.ts
// Shared helpers for parsing and comparing Clash ranked leagues

const LEAGUE_BASE_RANK: Record<string, number> = {
  'Legend League': 1200,
  'Titan League': 1100,
  'Electro League': 1000,
  'Dragon League': 900,
  'PEKKA League': 800,
  'Golem League': 700,
  'Witch League': 600,
  'Valkyrie League': 500,
  'Wizard League': 400,
  'Archer League': 300,
  'Barbarian League': 200,
  'Skeleton League': 100,
  'Champion League': 950,
  'Master League': 850,
  'Crystal League': 750,
  'Gold League': 650,
  'Silver League': 550,
  'Bronze League': 450,
  Unranked: 0,
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

  const baseRank = LEAGUE_BASE_RANK[baseName] ?? 0;
  const adjustedTier =
    tierValue == null
      ? 0
      : direction === 'ascending'
        ? tierValue
        : Math.max(0, 100 - tierValue);
  const score = baseRank + adjustedTier / 100;

  return {
    raw: trimmed,
    baseName,
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

