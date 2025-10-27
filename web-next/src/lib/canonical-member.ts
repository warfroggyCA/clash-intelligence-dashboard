import type { CanonicalMemberSnapshotV1 } from '@/types/canonical-member-snapshot';
import { CANONICAL_MEMBER_SNAPSHOT_VERSION } from '@/types/canonical-member-snapshot';
import type { CanonicalHeroLevels } from '@/types/canonical-member-snapshot';

interface BuildCanonicalMemberOptions {
  clanTag: string;
  clanName: string | null;
  snapshotId: string;
  fetchedAt: string;
  computedAt?: string | null;
  memberCount: number;
  totalTrophies: number | null;
  totalDonations: number | null;
    member: {
      tag: string;
      name: string | null;
      role: string | null;
      townHallLevel: number | null;
      trophies: number | null;
      battleModeTrophies: number | null;
      league: {
        id: number | null;
        name: string | null;
        trophies: number | null;
        iconSmall: string | null;
        iconMedium: string | null;
      } | null;
      ranked: {
        trophies: number | null;
        leagueId: number | null;
        leagueName: string | null;
        iconSmall: string | null;
        iconMedium: string | null;
      };
    donations: {
      given: number | null;
      received: number | null;
    };
    activityScore: number | null;
    heroLevels: CanonicalHeroLevels | null;
    rushPercent: number | null;
    war: {
      stars: number | null;
      attackWins: number | null;
      defenseWins: number | null;
    };
    builderBase: {
      hallLevel: number | null;
      trophies: number | null;
      battleWins: number | null;
      leagueId: number | null;
    };
    capitalContributions: number | null;
    pets: Record<string, number> | null;
    equipmentLevels: Record<string, number> | null;
    achievements: {
      count: number | null;
      score: number | null;
    };
    expLevel: number | null;
    bestTrophies: number | null;
    bestVersusTrophies: number | null;
    superTroopsActive: string[] | null;
    tenure: {
      days: number | null;
      asOf: string | null;
    };
    metrics?: Record<string, { value: number; metadata?: Record<string, any> | null }>;
    extras?: Record<string, any> | null;
  };
}

export function buildCanonicalMemberSnapshot({
  clanTag,
  clanName,
  snapshotId,
  fetchedAt,
  computedAt,
  memberCount,
  totalTrophies,
  totalDonations,
  member,
}: BuildCanonicalMemberOptions): CanonicalMemberSnapshotV1 {
  const snapshotDate = fetchedAt.slice(0, 10);

  return {
    schemaVersion: CANONICAL_MEMBER_SNAPSHOT_VERSION,
    clanTag,
    clanName,
    playerTag: member.tag,
    snapshotId,
    snapshotDate,
    fetchedAt,
    computedAt: computedAt ?? null,
    roster: {
      memberCount,
      totalTrophies,
      totalDonations,
    },
    member: {
      tag: member.tag,
      name: member.name,
      role: member.role,
      townHallLevel: member.townHallLevel,
      trophies: member.trophies,
      battleModeTrophies: member.battleModeTrophies,
      league: member.league,
      ranked: member.ranked,
      donations: member.donations,
      activityScore: member.activityScore,
      heroLevels: member.heroLevels,
      rushPercent: member.rushPercent,
      war: member.war,
      builderBase: member.builderBase,
      capitalContributions: member.capitalContributions,
      pets: member.pets,
      equipmentLevels: member.equipmentLevels,
      achievements: member.achievements,
      expLevel: member.expLevel,
      bestTrophies: member.bestTrophies,
      bestVersusTrophies: member.bestVersusTrophies,
      superTroopsActive: member.superTroopsActive,
      tenure: member.tenure,
      metrics: member.metrics,
      extras: member.extras,
    },
  };
}

