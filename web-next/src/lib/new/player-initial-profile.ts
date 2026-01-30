import type { SupabasePlayerProfilePayload, PlayerSummarySupabase } from '@/types/player-profile-supabase';
import type { RosterMember, RosterData } from '@/types/roster';

function buildSummaryFromRosterMember(member: RosterMember, roster: RosterData | null): PlayerSummarySupabase {
  const donationsGiven = member.donations ?? null;
  const donationsReceived = member.donationsReceived ?? null;
  const donationBalance =
    typeof donationsGiven === 'number' && typeof donationsReceived === 'number'
      ? donationsGiven - donationsReceived
      : null;

  const heroLevels: Record<string, unknown> = {
    bk: (member as any).bk ?? null,
    aq: (member as any).aq ?? null,
    gw: (member as any).gw ?? null,
    rc: (member as any).rc ?? null,
    mp: (member as any).mp ?? null,
  };

  return {
    name: member.name ?? 'Unknown',
    tag: member.tag,
    clanName: roster?.meta?.clanName ?? null,
    clanTag: roster?.clanTag ?? null,
    role: member.role ?? null,
    townHallLevel: member.townHallLevel ?? null,
    trophies: (member as any).resolvedTrophies ?? member.trophies ?? null,
    rankedTrophies: (member as any).rankedTrophies ?? null,
    seasonTotalTrophies: (member as any).seasonTotalTrophies ?? null,
    lastWeekTrophies: (member as any).lastWeekTrophies ?? null,
    rushPercent: member.rushPercent ?? null,
    league: {
      id: member.leagueId ?? null,
      name: member.leagueName ?? (member as any).resolvedLeague?.name ?? null,
      trophies: member.leagueTrophies ?? null,
      iconSmall: member.leagueIconSmall ?? null,
      iconMedium: member.leagueIconMedium ?? null,
    },
    rankedLeague: {
      id: member.rankedLeagueId ?? null,
      name: member.rankedLeagueName ?? null,
      trophies: null,
      iconSmall: null,
      iconMedium: null,
    },
    battleModeTrophies: member.battleModeTrophies ?? null,
    donations: {
      given: donationsGiven,
      received: donationsReceived,
      balance: donationBalance,
    },
    war: {
      stars: member.warStars ?? null,
      attackWins: null,
      defenseWins: null,
      preference: null,
    },
    builderBase: {
      hallLevel: null,
      trophies: member.battleModeTrophies ?? null,
      battleWins: null,
      leagueId: null,
      leagueName: null,
    },
    capitalContributions: member.clanCapitalContributions ?? null,
    activityScore: member.activityScore ?? null,
    activity: (member as any).activity ?? null,
    lastSeen: null,
    tenureDays: member.tenureDays ?? null,
    tenureAsOf: (member as any).tenureAsOf ?? (member as any).tenure_as_of ?? null,
    heroLevels,
    heroPower: (member as any).heroPower ?? null,
    bestTrophies: null,
    bestVersusTrophies: null,
    pets: null,
    superTroopsActive: null,
    equipmentLevels: null,
    achievements: { count: null, score: null },
    expLevel: null,
  };
}

export function buildInitialPlayerProfileFromRoster(roster: RosterData | null, playerTag: string): SupabasePlayerProfilePayload | null {
  if (!roster?.members?.length) return null;
  const member = roster.members.find((m) => (m.tag || '').toUpperCase() === playerTag.toUpperCase());
  if (!member) return null;

  return {
    summary: buildSummaryFromRosterMember(member as any, roster),
    timeline: [],
    history: null,
    leadership: {
      notes: [],
      warnings: [],
      tenureActions: [],
      departureActions: [],
    },
    evaluations: [],
    joinerEvents: [],
    clanHeroAverages: {},
    vip: { current: null, history: [] },
  };
}
