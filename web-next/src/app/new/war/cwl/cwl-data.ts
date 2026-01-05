import { getDefaultCwlSeasonId } from '@/lib/cwl-season';

export type CwlDayOpponentStatus = 'not_loaded' | 'roster_loaded' | 'war_finished';

export interface CwlSeasonSummary {
  seasonLabel: string;
  seasonId: string;
  warSize: 15 | 30;
  league: string;
  rosterSelected: number;
  rosterLocked: boolean;
}

export interface CwlDayOpponent {
  dayIndex: number;
  clanName: string;
  clanTag: string;
  status: CwlDayOpponentStatus;
  note?: string;
}

export interface CwlMember {
  name: string;
  tag: string;
  townHall: number | null;
  heroPower: number | null;
  daysPlayed?: number;
  reliability?: string;
}

const defaultSeasonId = getDefaultCwlSeasonId();

export const sampleSeasonSummary: CwlSeasonSummary = {
  seasonLabel: `CWL ${defaultSeasonId}`,
  seasonId: defaultSeasonId,
  warSize: 15,
  league: '',
  rosterSelected: 0,
  rosterLocked: false,
};

export const sampleOpponents: CwlDayOpponent[] = [];

export const sampleRoster: CwlMember[] = [];

export const sampleOpponentThSpread: Record<number, number> = {};

export const sampleOpponentStrengthNote = '';

export const buildAiClipboardPayload = (dayIndex: number, warSize: number, roster: CwlMember[], thSpread: Record<number, number>) => {
  const rosterJson = JSON.stringify(
    roster.map((m) => ({
      name: m.name,
      tag: m.tag,
      th: m.townHall,
      heroPower: m.heroPower,
      daysPlayedSoFar: m.daysPlayed ?? null,
    })),
    null,
    2,
  );

  return [
    'You are an expert Clash of Clans Clan War League strategist.',
    '',
    `We are playing Day ${dayIndex} in a ${warSize}v${warSize} CWL war.`,
    '',
    'Our season roster:',
    rosterJson,
    '',
    'Opponent TH distribution (approx):',
    JSON.stringify(thSpread, null, 2),
    '',
    'Please recommend which players should play today, balancing TH strength and fairness (spread play across the week).',
  ].join('\n');
};
