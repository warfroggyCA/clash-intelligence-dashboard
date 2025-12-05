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
  townHall: number;
  heroPower: number;
  daysPlayed?: number;
  reliability?: string;
}

export const sampleSeasonSummary: CwlSeasonSummary = {
  seasonLabel: 'CWL 2025-07',
  seasonId: '2025-07',
  warSize: 15,
  league: 'Master III (mock)',
  rosterSelected: 12,
  rosterLocked: false,
};

export const sampleOpponents: CwlDayOpponent[] = [
  { dayIndex: 1, clanName: 'Shadow Legion', clanTag: '#8PV9QQQ', status: 'roster_loaded', note: 'Loaded 3h ago' },
  { dayIndex: 2, clanName: 'Ice Guardians', clanTag: '#99RR0LL', status: 'not_loaded' },
  { dayIndex: 3, clanName: 'Cosmic Rage', clanTag: '#PPVCJ22', status: 'not_loaded' },
  { dayIndex: 4, clanName: 'Tanker Elite', clanTag: '#8800AAA', status: 'not_loaded' },
  { dayIndex: 5, clanName: 'Nova Storm', clanTag: '#2XYZ123', status: 'not_loaded' },
  { dayIndex: 6, clanName: 'Blue Inferno', clanTag: '#9UL8Y8U', status: 'not_loaded' },
  { dayIndex: 7, clanName: 'Wildcards', clanTag: '#1TEST77', status: 'not_loaded' },
];

export const sampleRoster: CwlMember[] = [
  { name: 'God Of LOYINS', tag: '#9VCJUVGV', townHall: 16, heroPower: 310, daysPlayed: 0, reliability: 'High' },
  { name: 'warfroggy', tag: '#G9QVRYC2Y', townHall: 16, heroPower: 305, daysPlayed: 0, reliability: 'High' },
  { name: 'CosmicThomas', tag: '#YYVUCPQ90', townHall: 15, heroPower: 285, daysPlayed: 0, reliability: 'High' },
  { name: 'Headhuntress', tag: '#GPYCPQV8J', townHall: 15, heroPower: 280, daysPlayed: 0, reliability: 'Medium' },
  { name: 'Tigress', tag: '#P0LYUV0V', townHall: 14, heroPower: 250, daysPlayed: 0, reliability: 'Medium' },
  { name: 'War.Frog', tag: '#UL0LRJ02', townHall: 14, heroPower: 248, daysPlayed: 0, reliability: 'Medium' },
  { name: 'Powerful-PB', tag: '#QUV0R9080', townHall: 13, heroPower: 230, daysPlayed: 0, reliability: 'Low' },
  { name: 'LeaderOne', tag: '#AAA1111', townHall: 16, heroPower: 300, daysPlayed: 0, reliability: 'High' },
  { name: 'SupporterA', tag: '#BBB2222', townHall: 15, heroPower: 270, daysPlayed: 0, reliability: 'Medium' },
  { name: 'SupporterB', tag: '#CCC3333', townHall: 14, heroPower: 240, daysPlayed: 0, reliability: 'Medium' },
  { name: 'NewGuy', tag: '#DDD4444', townHall: 13, heroPower: 215, daysPlayed: 0, reliability: 'Unknown' },
  { name: 'AltAccount', tag: '#EEE5555', townHall: 12, heroPower: 180, daysPlayed: 0, reliability: 'Low' },
  { name: 'Big TH18', tag: '#TH18X', townHall: 18, heroPower: 340, daysPlayed: 0, reliability: 'High' },
  { name: 'TH17 Core', tag: '#TH17Y', townHall: 17, heroPower: 325, daysPlayed: 0, reliability: 'High' },
  { name: 'BenchTH15', tag: '#BENCH15', townHall: 15, heroPower: 265, daysPlayed: 0, reliability: 'Medium' },
  { name: 'BenchTH14', tag: '#BENCH14', townHall: 14, heroPower: 240, daysPlayed: 0, reliability: 'Medium' },
  { name: 'BenchTH13', tag: '#BENCH13', townHall: 13, heroPower: 210, daysPlayed: 0, reliability: 'Low' },
  { name: 'BenchTH12', tag: '#BENCH12', townHall: 12, heroPower: 180, daysPlayed: 0, reliability: 'Low' },
];

export const sampleOpponentThSpread = {
  18: 2,
  17: 3,
  16: 6,
  15: 5,
  14: 4,
  13: 2,
};

export const sampleOpponentStrengthNote =
  'Opponent has heavy TH16/17 presence; expect strong cores. Keep at least 10 top accounts in the lineup.';

export const buildAiClipboardPayload = (dayIndex: number, warSize: number, roster: CwlMember[], thSpread: Record<number, number>) => {
  const rosterJson = JSON.stringify(
    roster.map((m) => ({
      name: m.name,
      tag: m.tag,
      th: m.townHall,
      heroPower: m.heroPower,
      daysPlayedSoFar: m.daysPlayed ?? 0,
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
