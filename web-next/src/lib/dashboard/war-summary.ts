interface WarLogEntry {
  result?: string | null;
  clan?: {
    stars?: number | null;
    attacks?: number | null;
  } | null;
  opponent?: {
    stars?: number | null;
    name?: string | null;
  } | null;
  teamSize?: number | null;
}

interface CurrentWarSnapshot {
  state?: string | null;
  opponent?: {
    name?: string | null;
  } | null;
  teamSize?: number | null;
}

export interface WarSummary {
  activeWar: {
    isActive: boolean;
    state: string | null;
    stateLabel: string;
    opponentName: string | null;
    teamSize: number | null;
  } | null;
  record: { wins: number; losses: number; ties: number; total: number } | null;
  averageStarsPerAttack: number | null;
}

const normalizeResult = (result?: string | null): 'WIN' | 'LOSE' | 'TIE' | null => {
  if (!result) return null;
  const normalized = result.toUpperCase();
  if (normalized === 'WIN' || normalized === 'LOSE' || normalized === 'TIE') return normalized;
  return null;
};

const inferResultFromStars = (clanStars?: number | null, opponentStars?: number | null): 'WIN' | 'LOSE' | 'TIE' | null => {
  if (typeof clanStars !== 'number' || typeof opponentStars !== 'number') return null;
  if (clanStars > opponentStars) return 'WIN';
  if (clanStars < opponentStars) return 'LOSE';
  return 'TIE';
};

const getWarStateLabel = (state?: string | null): string => {
  switch (state) {
    case 'preparation':
      return 'Planning';
    case 'inWar':
      return 'War in progress';
    case 'warEnded':
      return 'Completed';
    default:
      return 'No active war';
  }
};

export function buildWarSummary({
  currentWar,
  warLog,
}: {
  currentWar?: CurrentWarSnapshot | null;
  warLog?: WarLogEntry[] | null;
}): WarSummary {
  const rawState = currentWar?.state ?? null;
  const activeWarState = rawState && rawState !== 'notInWar' ? rawState : null;
  const activeWarLabel = getWarStateLabel(activeWarState);
  const activeWar = activeWarState
    ? {
        isActive: activeWarState === 'preparation' || activeWarState === 'inWar',
        state: activeWarState,
        stateLabel: activeWarLabel,
        opponentName: currentWar?.opponent?.name ?? null,
        teamSize: typeof currentWar?.teamSize === 'number' ? currentWar.teamSize : null,
      }
    : null;

  const entries = Array.isArray(warLog) ? warLog.slice(0, 10) : [];
  if (entries.length === 0) {
    return {
      activeWar,
      record: null,
      averageStarsPerAttack: null,
    };
  }

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let totalStars = 0;
  let totalAttacks = 0;

  entries.forEach((entry) => {
    const clanStars = entry.clan?.stars ?? null;
    const opponentStars = entry.opponent?.stars ?? null;
    const result = normalizeResult(entry.result) ?? inferResultFromStars(clanStars, opponentStars);
    if (result === 'WIN') wins += 1;
    if (result === 'LOSE') losses += 1;
    if (result === 'TIE') ties += 1;

    const attacks = entry.clan?.attacks;
    if (typeof clanStars === 'number' && typeof attacks === 'number' && attacks > 0) {
      totalStars += clanStars;
      totalAttacks += attacks;
    }
  });

  const averageStarsPerAttack = totalAttacks > 0
    ? Number((totalStars / totalAttacks).toFixed(2))
    : null;

  return {
    activeWar,
    record: { wins, losses, ties, total: entries.length },
    averageStarsPerAttack,
  };
}

export function buildWarChatBlurb(activeWar: WarSummary['activeWar']): string {
  if (!activeWar) {
    return 'No active war right now. Check the dashboard for the latest results.';
  }

  const opponent = activeWar.opponentName ?? 'Opponent pending';
  const size = activeWar.teamSize ? `${activeWar.teamSize}v${activeWar.teamSize}` : 'War size pending';
  const status = activeWar.stateLabel || 'War status pending';

  return [
    `War vs ${opponent} (${size})`,
    `Status: ${status}`,
    'Check the dashboard for full details and suggested targets.',
  ].join('\n');
}
