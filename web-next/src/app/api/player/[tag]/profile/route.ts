import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';
import { cfg } from '@/lib/config';
import { readTenureDetails } from '@/lib/tenure';
import { CANONICAL_MEMBER_SNAPSHOT_VERSION } from '@/types/canonical-member-snapshot';
import type { CanonicalMemberSnapshotV1 } from '@/types/canonical-member-snapshot';
import type { PlayerTimelinePoint, PlayerSummarySupabase, SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import type { Member, MemberEnriched, PlayerActivityTimelineEvent } from '@/types';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles } from '@/lib/auth/roles';
import { getLinkedTagsWithNames } from '@/lib/player-aliases';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
  type TimelineComputation,
} from '@/lib/activity/timeline';
import { calculateHistoricalTrophiesForPlayer } from '@/lib/business/historical-trophies';
import { getPlayer, extractHeroLevels } from '@/lib/coc';
import { extractEquipmentLevels, extractPetLevels, countCompletedAchievements, calculateAchievementScore, getActiveSuperTroops } from '@/lib/ingestion/field-extractors';
import { buildCanonicalMemberSnapshot } from '@/lib/canonical-member';
import { getLatestRosterSnapshot, resolveRosterMembers, type ResolvedRosterMember } from '@/lib/roster-resolver';
import { resolveHeroPower, resolveTrophies } from '@/lib/roster-derivations';

export const dynamic = 'force-dynamic';
// Cache player profile aggressively - data only updates once per day (nightly ingestion)
// Cache for 12 hours (43200 seconds) - will refresh when new ingestion runs
// Player stats don't change between ingestions, so long cache is safe
export const revalidate = 43200; // 12 hours

const SEASON_START_ISO = DEFAULT_SEASON_START_ISO;

interface CanonicalSnapshotRow {
  clan_tag: string;
  snapshot_date: string | null;
  payload: CanonicalMemberSnapshotV1;
  created_at?: string | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractPetLevelsFromCoc(playerDetail: any): Record<string, number> | null {
  return extractPetLevels(playerDetail);
}

async function fetchCurrentRosterMembers(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  clanTag: string | null,
): Promise<{ members: ResolvedRosterMember[]; snapshotDate: string | null } | null> {
  if (!clanTag) return null;
  const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase });
  if (!latestSnapshot) return null;
  const { members } = await resolveRosterMembers({
    supabase,
    clanTag: latestSnapshot.clanTag,
    snapshotId: latestSnapshot.snapshotId,
    snapshotDate: latestSnapshot.snapshotDate,
  });
  return { members, snapshotDate: latestSnapshot.snapshotDate };
}

function computeClanHeroAverages(members: ResolvedRosterMember[]): Record<string, number> {
  const totals: Record<string, { sum: number; count: number }> = {
    bk: { sum: 0, count: 0 },
    aq: { sum: 0, count: 0 },
    gw: { sum: 0, count: 0 },
    rc: { sum: 0, count: 0 },
    mp: { sum: 0, count: 0 },
  };

  members.forEach((member) => {
    const heroLevels = member.hero_levels ?? {};
    ['bk', 'aq', 'gw', 'rc', 'mp'].forEach((heroKey) => {
      const value = heroLevels[heroKey as keyof typeof heroLevels];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        totals[heroKey].sum += value;
        totals[heroKey].count += 1;
      }
    });
  });

  const averages: Record<string, number> = {};
  Object.entries(totals).forEach(([hero, data]) => {
    if (data.count > 0) {
      averages[hero] = data.sum / data.count;
    }
  });
  return averages;
}

function computeClanStatsAverages(members: ResolvedRosterMember[]) {
  const totals = {
    trophies: { sum: 0, count: 0 },
    donations: { sum: 0, count: 0 },
    warStars: { sum: 0, count: 0 },
    capitalContributions: { sum: 0, count: 0 },
    townHallLevel: { sum: 0, count: 0 },
  };

  members.forEach((member) => {
    const trophies = resolveTrophies(member);
    if (typeof trophies === 'number' && trophies > 0) {
      totals.trophies.sum += trophies;
      totals.trophies.count += 1;
    }

    const donations = member.donations ?? null;
    if (typeof donations === 'number' && donations > 0) {
      totals.donations.sum += donations;
      totals.donations.count += 1;
    }

    const warStars = member.war_stars ?? null;
    if (typeof warStars === 'number' && warStars > 0) {
      totals.warStars.sum += warStars;
      totals.warStars.count += 1;
    }

    const capitalContrib = member.capital_contributions ?? null;
    if (typeof capitalContrib === 'number' && capitalContrib > 0) {
      totals.capitalContributions.sum += capitalContrib;
      totals.capitalContributions.count += 1;
    }

    const thLevel = member.th_level ?? null;
    if (typeof thLevel === 'number' && thLevel > 0) {
      totals.townHallLevel.sum += thLevel;
      totals.townHallLevel.count += 1;
    }
  });

  return {
    trophies: totals.trophies.count > 0 ? totals.trophies.sum / totals.trophies.count : 0,
    donations: totals.donations.count > 0 ? totals.donations.sum / totals.donations.count : 0,
    warStars: totals.warStars.count > 0 ? totals.warStars.sum / totals.warStars.count : 0,
    capitalContributions:
      totals.capitalContributions.count > 0
        ? totals.capitalContributions.sum / totals.capitalContributions.count
        : 0,
    townHallLevel: totals.townHallLevel.count > 0 ? totals.townHallLevel.sum / totals.townHallLevel.count : 0,
    vipScore: 0,
  };
}

function mergeSummaryWithRosterMember(
  summary: PlayerSummarySupabase,
  rosterMember: ResolvedRosterMember | null,
): PlayerSummarySupabase {
  if (!rosterMember) return summary;

  const resolvedTrophies = resolveTrophies(rosterMember) ?? summary.trophies;
  const resolvedHeroPower = resolveHeroPower(rosterMember) ?? summary.heroPower ?? null;
  const resolvedRanked =
    typeof rosterMember.ranked_trophies === 'number' && rosterMember.ranked_trophies > 0
      ? rosterMember.ranked_trophies
      : summary.rankedTrophies;
  const donationsGiven = rosterMember.donations ?? summary.donations.given;
  const donationsReceived = rosterMember.donations_received ?? summary.donations.received;
  const donationBalance =
    donationsGiven != null && donationsReceived != null
      ? donationsGiven - donationsReceived
      : summary.donations.balance;

  return {
    ...summary,
    name: rosterMember.name ?? summary.name,
    role: rosterMember.role ?? summary.role,
    townHallLevel: rosterMember.th_level ?? summary.townHallLevel,
    trophies: resolvedTrophies ?? summary.trophies,
    rankedTrophies: resolvedRanked ?? summary.rankedTrophies,
    rushPercent: rosterMember.rush_percent ?? summary.rushPercent,
    league: {
      ...summary.league,
      id: rosterMember.league_id ?? summary.league.id,
      name: rosterMember.league_name ?? summary.league.name,
      trophies: rosterMember.league_trophies ?? summary.league.trophies,
    },
    rankedLeague: {
      ...summary.rankedLeague,
      id: rosterMember.ranked_league_id ?? summary.rankedLeague.id,
      name: rosterMember.ranked_league_name ?? summary.rankedLeague.name,
    },
    battleModeTrophies: rosterMember.battle_mode_trophies ?? summary.battleModeTrophies,
    donations: {
      given: donationsGiven ?? null,
      received: donationsReceived ?? null,
      balance: donationBalance ?? null,
    },
    war: {
      ...summary.war,
      stars: rosterMember.war_stars ?? summary.war.stars,
      attackWins: rosterMember.attack_wins ?? summary.war.attackWins,
      defenseWins: rosterMember.defense_wins ?? summary.war.defenseWins,
    },
    builderBase: {
      ...summary.builderBase,
      hallLevel: rosterMember.builder_hall_level ?? summary.builderBase.hallLevel,
      trophies: rosterMember.versus_trophies ?? summary.builderBase.trophies,
      battleWins: rosterMember.versus_battle_wins ?? summary.builderBase.battleWins,
      leagueId: rosterMember.builder_league_id ?? summary.builderBase.leagueId,
    },
    capitalContributions: rosterMember.capital_contributions ?? summary.capitalContributions,
    activityScore: rosterMember.activity_score ?? summary.activityScore,
    heroLevels: rosterMember.hero_levels ?? summary.heroLevels,
    heroPower: resolvedHeroPower,
    bestTrophies: rosterMember.best_trophies ?? summary.bestTrophies,
    bestVersusTrophies: rosterMember.best_versus_trophies ?? summary.bestVersusTrophies,
    pets: rosterMember.pet_levels ?? summary.pets,
    superTroopsActive: rosterMember.super_troops_active ?? summary.superTroopsActive,
    equipmentLevels: rosterMember.equipment_flags ?? summary.equipmentLevels,
    achievements: {
      ...summary.achievements,
      count: rosterMember.achievement_count ?? summary.achievements.count,
      score: rosterMember.achievement_score ?? summary.achievements.score,
    },
    expLevel: rosterMember.exp_level ?? summary.expLevel,
  };
}

function buildTimeline(rows: CanonicalSnapshotRow[]): TimelineComputation {
  if (!rows.length) {
    return { timeline: [], lastWeekTrophies: null, seasonTotalTrophies: null };
  }

  const RANKED_START_DATE = '2025-10-06'; // Ranked League started Oct 6, 2025

  // First filter and sort
  const filtered = [...rows]
    .filter((row) => {
      // Filter out dates before Ranked League start (Oct 6, 2025)
      if (!row.snapshot_date) return false;
      const snapshotDateStr = row.snapshot_date.toString().substring(0, 10);
      return snapshotDateStr >= RANKED_START_DATE;
    })
    .filter((row) => row.payload?.schemaVersion === CANONICAL_MEMBER_SNAPSHOT_VERSION)
    .sort((a, b) => {
      const aDate = a.snapshot_date ? new Date(`${a.snapshot_date}T00:00:00Z`).getTime() : 0;
      const bDate = b.snapshot_date ? new Date(`${b.snapshot_date}T00:00:00Z`).getTime() : 0;
      // Sort by date, then by created_at to get latest snapshot per day
      if (aDate !== bDate) return aDate - bDate;
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aCreated - bCreated;
    });

  // Deduplicate by date - keep the LAST (most recent) snapshot per day
  // Since we sorted by date ascending, then by created_at ascending,
  // the latest snapshot per day will overwrite earlier ones
  const byDate = new Map<string, CanonicalSnapshotRow>();
  for (const row of filtered) {
    const dateKey = row.snapshot_date?.toString().substring(0, 10) ?? '';
    if (dateKey) {
      byDate.set(dateKey, row); // Later entries overwrite earlier ones
    }
  }
  const chronological = Array.from(byDate.values());

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const seasonStart = new Date(SEASON_START_ISO);
  const mondayKeysByPlayer = new Set<string>();

  let lastWeekTrophies: number | null = null;
  let seasonTotal = 0;

  const timeline: PlayerTimelinePoint[] = chronological.map((row) => {
    const snapshotDate = row.snapshot_date ? `${row.snapshot_date}` : null;
    const member = row.payload.member;
    const trophies = member.ranked.trophies ?? member.trophies ?? null;
    const dateObj = snapshotDate ? new Date(`${snapshotDate}T00:00:00Z`) : null;

    if (dateObj) {
      if (!lastWeekTrophies && dateObj >= fourteenDaysAgo && dateObj < sevenDaysAgo) {
        lastWeekTrophies = trophies ?? null;
      }

      if (dateObj >= seasonStart && dateObj.getUTCDay() === 1 && snapshotDate) {
        const key = `${row.payload.playerTag}|${snapshotDate}`;
        if (!mondayKeysByPlayer.has(key)) {
          seasonTotal += trophies ?? 0;
          mondayKeysByPlayer.add(key);
        }
      }
    }

    return {
      snapshotDate,
      trophies: member.trophies ?? null,
      rankedTrophies: member.ranked.trophies ?? null,
      donations: member.donations.given ?? null,
      donationsReceived: member.donations.received ?? null,
      activityScore: member.activityScore ?? null,
      heroLevels: member.heroLevels ?? null,
      warStars: member.war.stars ?? null,
      attackWins: member.war.attackWins ?? null,
      defenseWins: member.war.defenseWins ?? null,
      capitalContributions: member.capitalContributions ?? null,
      builderHallLevel: member.builderBase.hallLevel ?? null,
      builderTrophies: member.builderBase.trophies ?? null,
      builderBattleWins: member.builderBase.battleWins ?? null,
      bestTrophies: member.bestTrophies ?? null,
      bestVersusTrophies: member.bestVersusTrophies ?? null,
      leagueName: member.league?.name ?? null,
      leagueTrophies: member.league?.trophies ?? null,
      leagueId: member.league?.id ?? null,
      rankedLeagueId: member.ranked.leagueId ?? null,
      rankedLeagueName: member.ranked.leagueName ?? null,
      superTroopsActive: member.superTroopsActive ?? null,
      petLevels: member.pets ?? null,
      equipmentLevels: member.equipmentLevels ?? null,
      achievementCount: member.achievements.count ?? null,
      achievementScore: member.achievements.score ?? null,
      expLevel: member.expLevel ?? null,
      rushPercent: member.rushPercent ?? null,
      events: null,
      notability: null,
      deltas: null,
    };
  });

  const latestSnapshot = chronological[chronological.length - 1]?.payload;
  const latestTrophies = latestSnapshot?.member?.ranked?.trophies ?? latestSnapshot?.member?.trophies ?? null;
  if (latestTrophies != null) {
    seasonTotal += latestTrophies;
  }

  return {
    timeline,
    lastWeekTrophies,
    seasonTotalTrophies: seasonTotal || seasonTotal === 0 ? seasonTotal : null,
  };
}

function buildSummary(
  latest: CanonicalMemberSnapshotV1,
  timelineStats: TimelineComputation,
  clanName: string | null,
  tenureDays: number | null,
  tenureAsOf: string | null,
): PlayerSummarySupabase {
  const member = latest.member;
  const latestTimelinePoint = timelineStats.timeline?.length
    ? timelineStats.timeline[timelineStats.timeline.length - 1]
    : null;
  const league = member.league ?? { id: null, name: null, trophies: null, iconSmall: null, iconMedium: null };
  const ranked = member.ranked ?? { leagueId: null, leagueName: null, trophies: null, iconSmall: null, iconMedium: null };
  const donationsGiven = member.donations.given ?? null;
  const donationsReceived = member.donations.received ?? null;
  const donationBalance = donationsGiven != null && donationsReceived != null
    ? donationsGiven - donationsReceived
    : null;
  const heroPower = resolveHeroPower(member);

  return {
    name: member.name ?? null,
    tag: member.tag,
    clanName,
    clanTag: latest.clanTag ?? null,
    role: member.role ?? null,
    townHallLevel: member.townHallLevel ?? null,
    trophies: member.trophies ?? null,
    rankedTrophies: ranked.trophies ?? null,
    seasonTotalTrophies: timelineStats.seasonTotalTrophies,
    lastWeekTrophies: timelineStats.lastWeekTrophies,
    rushPercent: member.rushPercent ?? null,
    league: {
      id: league.id ?? null,
      name: league.name ?? null,
      trophies: league.trophies ?? null,
      iconSmall: league.iconSmall ?? null,
      iconMedium: league.iconMedium ?? null,
    },
    rankedLeague: {
      id: ranked.leagueId ?? null,
      name: ranked.leagueName ?? null,
      trophies: ranked.trophies ?? null,
      iconSmall: ranked.iconSmall ?? null,
      iconMedium: ranked.iconMedium ?? null,
    },
    battleModeTrophies: ranked.trophies ?? null,
    donations: {
      given: donationsGiven,
      received: donationsReceived,
      balance: donationBalance,
    },
    war: {
      stars: member.war.stars ?? latestTimelinePoint?.warStars ?? null,
      attackWins: member.war.attackWins ?? latestTimelinePoint?.attackWins ?? null,
      defenseWins: member.war.defenseWins ?? latestTimelinePoint?.defenseWins ?? null,
      preference: member.war.preference ?? null,
    },
    builderBase: {
      hallLevel: member.builderBase.hallLevel ?? null,
      trophies: member.builderBase.trophies ?? null,
      battleWins: member.builderBase.battleWins ?? null,
      leagueId: member.builderBase.leagueId ?? null,
      leagueName: member.builderBase.leagueName ?? null,
    },
    capitalContributions: member.capitalContributions ?? null,
    activityScore: member.activityScore ?? null,
    lastSeen: latest.fetchedAt ?? latest.snapshotDate ?? null,
    tenureDays: tenureDays,
    tenureAsOf: tenureAsOf,
    heroLevels: member.heroLevels ?? null,
    heroPower,
    bestTrophies: member.bestTrophies ?? null,
    bestVersusTrophies: member.bestVersusTrophies ?? null,
    pets: member.pets ?? null,
    superTroopsActive: member.superTroopsActive ?? null,
    equipmentLevels: member.equipmentLevels ?? null,
    achievements: {
      count: member.achievements.count ?? null,
      score: member.achievements.score ?? null,
    },
    expLevel: member.expLevel ?? null,
  };
}

function mapLeagueInfo(leagueTier?: any) {
  if (!leagueTier) return { id: null, name: null, trophies: null, iconSmall: null, iconMedium: null };
  return {
    id: leagueTier.id ?? null,
    name: leagueTier.name ?? null,
    trophies: null,
    iconSmall: leagueTier.iconUrls?.small ?? null,
    iconMedium: leagueTier.iconUrls?.large ?? null,
  };
}

async function fetchCanonicalSnapshots(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  playerTag: string,
  clanTag: string | null,
  limit = 60, // PERFORMANCE: Reduced from 120 to 60 - 2 months is sufficient for profile view
): Promise<CanonicalSnapshotRow[]> {
  const RANKED_START_DATE = '2025-10-06'; // Filter at SQL level to exclude Oct 5 and earlier
  
  const baseSelect = supabase
    .from('canonical_member_snapshots')
    .select('clan_tag, snapshot_date, payload, created_at')
    .eq('player_tag', playerTag)
    .gte('snapshot_date', RANKED_START_DATE) // Only fetch Oct 6, 2025 onwards
    .order('snapshot_date', { ascending: false })
    .limit(limit);

  if (clanTag) {
    const { data, error } = await baseSelect.eq('clan_tag', clanTag);
    if (error && error.code !== 'PGRST205') {
      throw error;
    }
    // If clanTag is explicitly provided, return only results for that clan (even if empty)
    // Don't fall back to all snapshots - this ensures we get clan-specific data
    return (data ?? []) as CanonicalSnapshotRow[];
  }

  // Only fetch all snapshots if no clanTag was specified
  const { data, error } = await baseSelect;
  if (error) {
    throw error;
  }
  return (data ?? []) as CanonicalSnapshotRow[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag: requestedTag } = await params;
    const supabase = getSupabaseServerClient();
    const normalizedTag = normalizeTag(requestedTag);
    if (!normalizedTag) {
      return NextResponse.json({ success: false, error: 'Player tag is required' }, { status: 400 });
    }

    const user = await getAuthenticatedUser().catch(() => null);
    const userRoles = user ? await getUserClanRoles(user.id) : [];

    // Get clanTag from query parameter, fallback to homeClanTag
    // Safely parse URL - handle edge cases where req.url might not be a full URL
    let searchParams: URLSearchParams;
    try {
      const url = typeof req.url === 'string' ? new URL(req.url) : new URL(req.url);
      searchParams = url.searchParams;
    } catch (e) {
      // Fallback: try to extract query string manually
      const urlString = typeof req.url === 'string' ? req.url : String(req.url);
      const queryStart = urlString.indexOf('?');
      const queryString = queryStart >= 0 ? urlString.substring(queryStart + 1) : '';
      searchParams = new URLSearchParams(queryString);
    }
    const requestedClanTag = searchParams.get('clanTag');
    const clanTag = requestedClanTag ? normalizeTag(requestedClanTag) : (cfg.homeClanTag ? normalizeTag(cfg.homeClanTag) : null);

    const canonicalRows = await fetchCanonicalSnapshots(supabase, normalizedTag, clanTag);
    const filteredRows = canonicalRows.filter(
      (row) => row.payload?.schemaVersion === CANONICAL_MEMBER_SNAPSHOT_VERSION,
    );

    if (!filteredRows.length) {
      // Fallback: Try to fetch player data from CoC API if not in our snapshots
      // This is useful for linked alias accounts that may not be in our clan
      console.log(`[player-profile] Player ${normalizedTag} not found in snapshots, attempting CoC API fetch`);
      
      try {
        const cleanTag = normalizedTag.replace('#', '');
        const cocPlayer = await getPlayer(cleanTag);
        
        if (cocPlayer && cocPlayer.name) {
          console.log(`[player-profile] Successfully fetched ${normalizedTag} from CoC API: ${cocPlayer.name}`);
          
          // Extract clan info if available (CoC API includes clan object)
          const clanInfo = (cocPlayer as any).clan || null;
          
          // Calculate clan hero averages if clanTag was requested
          let clanHeroAverages: Record<string, number> = {};
          if (clanTag) {
            try {
              const rosterPayload = await fetchCurrentRosterMembers(supabase, clanTag);
              if (rosterPayload?.members?.length) {
                clanHeroAverages = computeClanHeroAverages(rosterPayload.members);
              }
            } catch (error) {
              console.warn('Failed to calculate clan hero averages for CoC fallback:', error);
            }
          }
          
          // Build a minimal profile from CoC API data
          const minimalProfile: SupabasePlayerProfilePayload = {
            summary: {
              name: cocPlayer.name || 'Unknown Player',
              tag: normalizedTag,
              clanName: clanInfo?.name || null,
              clanTag: clanTag || (clanInfo?.tag ? normalizeTag(clanInfo.tag) : null),
              role: clanInfo?.role || null,
              townHallLevel: cocPlayer.townHallLevel || null,
              trophies: cocPlayer.trophies || null,
              rankedTrophies: null,
              seasonTotalTrophies: null,
              lastWeekTrophies: null,
              rushPercent: null,
              league: {
                id: cocPlayer.league?.id || null,
                name: cocPlayer.league?.name || null,
                trophies: cocPlayer.trophies || null,
                iconSmall: cocPlayer.league?.iconUrls?.small || null,
                iconMedium: cocPlayer.league?.iconUrls?.medium || null,
              },
              rankedLeague: {
                id: null,
                name: null,
                trophies: null,
                iconSmall: null,
                iconMedium: null,
              },
              battleModeTrophies: cocPlayer.versusTrophies || null,
              donations: {
                given: cocPlayer.donations || null,
                received: cocPlayer.donationsReceived || null,
                balance: (cocPlayer.donations || 0) - (cocPlayer.donationsReceived || 0),
              },
              war: {
                stars: null,
                attackWins: cocPlayer.attackWins || null,
                defenseWins: null,
                preference: null,
              },
              builderBase: {
                hallLevel: null,
                trophies: cocPlayer.versusTrophies || null,
                battleWins: cocPlayer.versusBattleWins || null,
                leagueId: null,
                leagueName: null,
              },
              capitalContributions: cocPlayer.clanCapitalContributions || null,
              activityScore: null,
              activity: null,
              lastSeen: null,
              tenureDays: null,
              tenureAsOf: null,
              heroLevels: cocPlayer.heroes ? cocPlayer.heroes.reduce((acc: Record<string, unknown>, hero) => {
                const key = hero.name?.toLowerCase().replace(/\s+/g, '') || '';
                acc[key] = hero.level || hero.currentLevel || 0;
                return acc;
              }, {}) : null,
              bestTrophies: null,
              bestVersusTrophies: null,
              pets: null,
              superTroopsActive: null,
              equipmentLevels: null,
              achievements: {
                count: null,
                score: null,
              },
              expLevel: null,
            },
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
            clanHeroAverages: clanHeroAverages,
            vip: {
              current: null,
              history: [],
            },
          };
          
          return NextResponse.json({ success: true, data: minimalProfile });
        }
      } catch (cocError: any) {
        console.warn(`[player-profile] Failed to fetch ${normalizedTag} from CoC API:`, cocError.message);
        // Fall through to return 404
      }
      
      return NextResponse.json({ success: false, error: 'Player not found in canonical snapshots' }, { status: 404 });
    }

    let latestSnapshot = filteredRows[0].payload;
    let latestSnapshotDate = filteredRows[0].snapshot_date;
    // Use requested clanTag if provided, otherwise fall back to snapshot's clanTag
    const resolvedClanTag = clanTag ?? latestSnapshot.clanTag ?? filteredRows[0].clan_tag ?? null;
    const normalizedResolvedClanTag = resolvedClanTag ? normalizeTag(resolvedClanTag) : null;
    // Temporarily allow public access; if user roles exist, enforce clan access, otherwise skip.
    if (normalizedResolvedClanTag && userRoles.length) {
      const hasClanAccess = userRoles.some((role) => role.clan_tag === normalizedResolvedClanTag);
      if (!hasClanAccess) {
        return NextResponse.json({ success: false, error: 'Forbidden: Clan access required' }, { status: 403 });
      }
    }
    
    // Log the latest snapshot date for debugging
    console.log(`[player-profile] Latest snapshot date for ${normalizedTag}: ${latestSnapshotDate}`);

    // PERFORMANCE: Parallelize independent queries (clan, tenure, player_day, member lookup)
    const [
      { data: clanRow, error: clanError },
      tenureDetails,
      { data: playerDayRows, error: playerDayError },
      { data: memberRow },
      { data: historyRow, error: historyError },
      rosterPayload,
    ] = await Promise.all([
      // Get clan info
      resolvedClanTag
        ? supabase
            .from('clans')
            .select('id, tag, name, logo_url')
            .eq('tag', resolvedClanTag)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Get tenure details
      readTenureDetails(latestSnapshot.snapshotDate ?? undefined),
      // Get player_day data for timeline
      supabase
        .from('player_day')
        .select('date, clan_tag, player_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability')
        .eq('player_tag', normalizedTag)
        .order('date', { ascending: true }),
      // Get member ID and current name for historical trophy calculations and name override
      supabase
        .from('members')
        .select('id, name')
        .eq('tag', normalizedTag)
        .maybeSingle(),
      resolvedClanTag
        ? supabase
            .from('player_history')
            .select('*')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolvedClanTag ? fetchCurrentRosterMembers(supabase, resolvedClanTag) : Promise.resolve(null),
    ]);

    if (clanError && clanError.code !== 'PGRST116') {
      throw clanError;
    }
    if (playerDayError && playerDayError.code !== 'PGRST116') {
      throw playerDayError;
    }
    if (historyError) {
      throw historyError;
    }

    const rosterMembers = rosterPayload?.members ?? [];
    const rosterMember = rosterMembers.find((member) => member.tag === normalizedTag) ?? null;

    const tenureInfo = tenureDetails[latestSnapshot.playerTag] ?? null;
    const historyCurrentStint = historyRow?.current_stint ?? historyRow?.currentStint ?? null;
    const historyBase = typeof historyRow?.total_tenure === 'number' ? historyRow.total_tenure : 0;
    let historyCurrentDays = 0;
    if (historyCurrentStint?.isActive && historyCurrentStint.startDate) {
      const start = new Date(historyCurrentStint.startDate);
      if (!Number.isNaN(start.getTime())) {
        historyCurrentDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    const historyTenureDays = historyRow ? Math.max(0, Math.round(historyBase + Math.max(0, historyCurrentDays))) : null;
    const historyTenureAsOf = historyCurrentStint?.startDate ?? null;
    const tenureCandidates = [
      { days: historyTenureDays, asOf: historyTenureAsOf },
      { days: tenureInfo?.days ?? null, asOf: tenureInfo?.as_of ?? null },
      { days: latestSnapshot.member.tenure.days ?? null, asOf: latestSnapshot.member.tenure.asOf ?? null },
    ].filter((candidate): candidate is { days: number; asOf: string | null } => 
      typeof candidate.days === 'number' && Number.isFinite(candidate.days)
    );
    const resolvedTenure = tenureCandidates.reduce(
      (best, candidate) => (best == null || candidate.days > best.days ? candidate : best),
      null as { days: number; asOf: string | null } | null,
    );

    let timelineStats: TimelineComputation;

    // Use player_day data if it has sufficient recent entries (at least 5 days)
    // Otherwise fall back to canonical_member_snapshots which is always current
    const hasRecentPlayerDayData = playerDayRows && playerDayRows.length >= 5;
    if (hasRecentPlayerDayData) {
      timelineStats = buildTimelineFromPlayerDay(playerDayRows as PlayerDayTimelineRow[], SEASON_START_ISO);
    } else {
      // Fall back to canonical snapshots - these are always kept current
      timelineStats = buildTimeline(filteredRows);
    }

    // PERFORMANCE: Calculate historical trophies (memberRow already fetched in parallel above)
    let historicalTrophyData: Awaited<ReturnType<typeof calculateHistoricalTrophiesForPlayer>> | null = null;
    try {
      if (memberRow?.id) {
        historicalTrophyData = await calculateHistoricalTrophiesForPlayer(memberRow.id, normalizedTag);
      }
    } catch (error) {
      console.warn('[player-profile] Failed to fetch historical trophy data:', error);
      // Continue with fallback values from timelineStats
    }

    // Use SSOT historical trophy data, fallback to timelineStats if not available
    const resolvedLastWeekTrophies = historicalTrophyData?.lastWeekTrophies ?? timelineStats.lastWeekTrophies;
    const resolvedSeasonTotalTrophies = historicalTrophyData?.seasonTotalTrophies ?? timelineStats.seasonTotalTrophies;

    let summary: PlayerSummarySupabase;

    let latestClanSnapshotDate: string | null = null;
    let latestClanSnapshotRow: { snapshot_date: string | null; snapshot_id: string | null; payload: CanonicalMemberSnapshotV1 | null } | null = null;
    if (resolvedClanTag) {
      try {
        const { data: latestClanRow } = await supabase
          .from('canonical_member_snapshots')
          .select('snapshot_date, snapshot_id, payload')
          .eq('clan_tag', resolvedClanTag)
          .order('snapshot_date', { ascending: false })
          .limit(1);
        latestClanSnapshotRow = (latestClanRow?.[0] as any) ?? null;
        latestClanSnapshotDate = latestClanSnapshotRow?.snapshot_date ?? null;
      } catch (error) {
        console.warn('[player-profile] Failed to resolve latest clan snapshot date:', error);
      }
    }

    if (latestClanSnapshotDate) {
      try {
        if (latestSnapshotDate !== latestClanSnapshotDate && resolvedClanTag) {
          const { data: matchingRow } = await supabase
            .from('canonical_member_snapshots')
            .select('snapshot_date, snapshot_id, payload')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .eq('snapshot_date', latestClanSnapshotDate)
            .maybeSingle();

          if (matchingRow?.payload) {
            latestSnapshot = matchingRow.payload as CanonicalMemberSnapshotV1;
            latestSnapshotDate = matchingRow.snapshot_date;
          } else {
            const cleanTag = normalizedTag.replace('#', '');
            const cocPlayer = await getPlayer(cleanTag);
            const latestRosterPayload = latestClanSnapshotRow?.payload ?? latestSnapshot;
            const snapshotId = latestClanSnapshotRow?.snapshot_id ?? latestRosterPayload?.snapshotId ?? `autoheal-${normalizedTag}-${latestClanSnapshotDate}`;
            const fetchedAt = latestRosterPayload?.fetchedAt ?? `${latestClanSnapshotDate}T00:00:00.000Z`;

            const leagueInfo = mapLeagueInfo((cocPlayer as any).leagueTier);
            const rankedInfo = {
              trophies: cocPlayer.trophies ?? null,
              leagueId: leagueInfo.id,
              leagueName: leagueInfo.name,
              iconSmall: leagueInfo.iconSmall,
              iconMedium: leagueInfo.iconMedium,
            };

            const canonicalSnapshot = buildCanonicalMemberSnapshot({
              clanTag: resolvedClanTag,
              clanName: latestRosterPayload?.clanName ?? null,
              snapshotId,
              fetchedAt,
              computedAt: null,
              memberCount: latestRosterPayload?.roster?.memberCount ?? null,
              totalTrophies: latestRosterPayload?.roster?.totalTrophies ?? null,
              totalDonations: latestRosterPayload?.roster?.totalDonations ?? null,
              member: {
                tag: normalizedTag,
                name: cocPlayer.name ?? latestSnapshot.member.name ?? null,
                role: latestSnapshot.member.role ?? null,
                townHallLevel: cocPlayer.townHallLevel ?? null,
                townHallWeaponLevel: (cocPlayer as any).townHallWeaponLevel ?? null,
                trophies: cocPlayer.trophies ?? null,
                battleModeTrophies: (cocPlayer as any).builderBaseTrophies ?? (cocPlayer as any).versusTrophies ?? null,
                league: leagueInfo,
                ranked: rankedInfo,
                donations: {
                  given: cocPlayer.donations ?? null,
                  received: cocPlayer.donationsReceived ?? null,
                },
                activityScore: null,
                heroLevels: extractHeroLevels(cocPlayer),
                rushPercent: latestSnapshot.member.rushPercent ?? null,
                war: {
                  stars: (cocPlayer as any).warStars ?? null,
                  attackWins: cocPlayer.attackWins ?? null,
                  defenseWins: (cocPlayer as any).defenseWins ?? null,
                  preference: (cocPlayer as any).warPreference ?? null,
                },
                builderBase: {
                  hallLevel: (cocPlayer as any).builderHallLevel ?? null,
                  trophies: (cocPlayer as any).builderBaseTrophies ?? (cocPlayer as any).versusTrophies ?? null,
                  battleWins: (cocPlayer as any).versusBattleWins ?? null,
                  leagueId: (cocPlayer as any).builderBaseLeague?.id ?? null,
                  leagueName: (cocPlayer as any).builderBaseLeague?.name ?? null,
                },
                capitalContributions: cocPlayer.clanCapitalContributions ?? null,
                pets: extractPetLevels(cocPlayer),
                equipmentLevels: extractEquipmentLevels(cocPlayer),
                achievements: {
                  count: countCompletedAchievements(cocPlayer),
                  score: calculateAchievementScore(cocPlayer),
                },
                expLevel: (cocPlayer as any).expLevel ?? null,
                bestTrophies: (cocPlayer as any).bestTrophies ?? null,
                bestVersusTrophies: (cocPlayer as any).bestBuilderBaseTrophies ?? null,
                superTroopsActive: getActiveSuperTroops(cocPlayer),
                tenure: latestSnapshot.member.tenure ?? { days: null, asOf: null },
                clanRank: latestSnapshot.member.clanRank ?? null,
                previousClanRank: latestSnapshot.member.previousClanRank ?? null,
                labels: (cocPlayer as any).labels ?? null,
                legendStatistics: latestSnapshot.member.legendStatistics ?? null,
                metrics: latestSnapshot.member.metrics ?? undefined,
                extras: latestSnapshot.member.extras ?? null,
              },
            });

            await supabase
              .from('canonical_member_snapshots')
              .upsert(
                [{
                  clan_tag: resolvedClanTag,
                  player_tag: normalizedTag,
                  snapshot_id: snapshotId,
                  snapshot_date: canonicalSnapshot.snapshotDate,
                  schema_version: canonicalSnapshot.schemaVersion,
                  payload: canonicalSnapshot,
                }],
                { onConflict: 'snapshot_id,player_tag' }
              );

            latestSnapshot = canonicalSnapshot;
            latestSnapshotDate = canonicalSnapshot.snapshotDate;
          }
        }
      } catch (error) {
        console.warn('[player-profile] Auto-heal for latest snapshot failed:', error);
      }
      // summary will be rebuilt after potential auto-heal
    }

    summary = buildSummary(
      latestSnapshot,
      {
        ...timelineStats,
        lastWeekTrophies: resolvedLastWeekTrophies,
        seasonTotalTrophies: resolvedSeasonTotalTrophies,
      },
      clanRow?.name ?? null,
      resolvedTenure?.days ?? null,
      resolvedTenure?.asOf ?? null,
    );

    if (latestClanSnapshotDate) {
      summary = {
        ...summary,
        lastSeen: latestClanSnapshotDate,
      };
    }

    summary = mergeSummaryWithRosterMember(summary, rosterMember);

    if (!summary.pets || Object.keys(summary.pets).length === 0) {
      try {
        const cleanTag = normalizedTag.replace('#', '');
        const cocPlayer = await getPlayer(cleanTag);
        summary = {
          ...summary,
          pets: extractPetLevelsFromCoc(cocPlayer) ?? summary.pets,
        };
      } catch (error) {
        console.warn('[player-profile] Failed to fetch pets from CoC API', error);
      }
    }

    // Override name with current name from members table if available (handles name changes)
    if (memberRow?.name) {
      summary = {
        ...summary,
        name: memberRow.name,
      };
    }

    const memberForActivity: Member = {
      name: summary.name ?? summary.tag,
      tag: summary.tag,
      role: summary.role ?? undefined,
      townHallLevel: summary.townHallLevel ?? undefined,
      trophies: summary.trophies ?? undefined,
      rankedTrophies: summary.rankedTrophies ?? undefined,
      rankedLeagueId: summary.rankedLeague.id ?? undefined,
      rankedLeagueName: summary.rankedLeague.name ?? undefined,
      leagueId: summary.league.id ?? undefined,
      leagueName: summary.league.name ?? undefined,
      donations: summary.donations.given ?? undefined,
      donationsReceived: summary.donations.received ?? undefined,
      seasonTotalTrophies: summary.seasonTotalTrophies ?? undefined,
      enriched: {
        warStars: summary.war.stars ?? null,
        attackWins: summary.war.attackWins ?? null,
        defenseWins: summary.war.defenseWins ?? null,
        capitalContributions: summary.capitalContributions ?? null,
        builderHallLevel: summary.builderBase.hallLevel ?? null,
        versusTrophies: summary.builderBase.trophies ?? null,
        versusBattleWins: summary.builderBase.battleWins ?? null,
        builderLeagueId: summary.builderBase.leagueId ?? null,
        builderLeagueName: summary.builderBase.leagueName ?? null,
        achievementCount: summary.achievements.count ?? null,
        achievementScore: summary.achievements.score ?? null,
        expLevel: summary.expLevel ?? null,
        bestTrophies: summary.bestTrophies ?? null,
        bestVersusTrophies: summary.bestVersusTrophies ?? null,
        equipmentLevels: summary.equipmentLevels ?? null,
        maxTroopCount: null,
        maxSpellCount: null,
        petLevels: summary.pets ?? null,
        superTroopsActive: summary.superTroopsActive ?? null,
      } as MemberEnriched,
    } as Member;

    const activityTimeline = mapTimelinePointsToActivityEvents(timelineStats.timeline);
    const activityEvidence = resolveMemberActivity({
      ...memberForActivity,
      activityTimeline,
    } as Member & { activityTimeline?: PlayerActivityTimelineEvent[] });
    summary = {
      ...summary,
      activityScore: summary.activityScore ?? activityEvidence.score ?? null,
      activity: activityEvidence,
    };

    // Calculate clan hero averages for comparison
    let clanHeroAverages: Record<string, number> = {};
    if (rosterMembers.length > 0) {
      clanHeroAverages = computeClanHeroAverages(rosterMembers);
    } else if (resolvedClanTag) {
      try {
        const { data: rosterRows, error: rosterError } = await supabase
          .from('canonical_member_snapshots')
          .select('payload')
          .eq('clan_tag', resolvedClanTag)
          .order('snapshot_date', { ascending: false })
          .limit(20);

        if (!rosterError && rosterRows && rosterRows.length > 0) {
          const totals: Record<string, { sum: number; count: number }> = {
            bk: { sum: 0, count: 0 },
            aq: { sum: 0, count: 0 },
            gw: { sum: 0, count: 0 },
            rc: { sum: 0, count: 0 },
            mp: { sum: 0, count: 0 },
          };

          rosterRows.forEach((row) => {
            const payload = row.payload as CanonicalMemberSnapshotV1;
            if (payload?.member?.heroLevels) {
              const heroLevels = payload.member.heroLevels;
              ['bk', 'aq', 'gw', 'rc', 'mp'].forEach((heroKey) => {
                const value = heroLevels[heroKey as keyof typeof heroLevels];
                if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                  totals[heroKey].sum += value;
                  totals[heroKey].count += 1;
                }
              });
            }
          });

          Object.entries(totals).forEach(([hero, data]) => {
            if (data.count > 0) {
              clanHeroAverages[hero] = data.sum / data.count;
            }
          });
        }
      } catch (error) {
        console.warn('Failed to calculate clan hero averages:', error);
      }
    }

    // Calculate clan averages for stats (for radar chart comparison)
    let clanStatsAverages = {
      trophies: 0,
      donations: 0,
      warStars: 0,
      capitalContributions: 0,
      townHallLevel: 0,
      vipScore: 0,
    };
    if (rosterMembers.length > 0) {
      clanStatsAverages = computeClanStatsAverages(rosterMembers);
      const memberIds = rosterMembers.map((member) => member.id).filter(Boolean);
      if (memberIds.length > 0) {
        const weekStartISO = new Date().toISOString().split('T')[0];
        const monday = new Date(weekStartISO);
        monday.setUTCDate(monday.getUTCDate() - monday.getUTCDay() + 1);
        const weekStart = monday.toISOString().split('T')[0];

        try {
          const { data: vipRows } = await supabase
            .from('vip_scores')
            .select('vip_score, member_id')
            .eq('week_start', weekStart)
            .in('member_id', memberIds);

          if (vipRows && vipRows.length > 0) {
            const vipSum = vipRows.reduce((sum, row) => sum + Number(row.vip_score || 0), 0);
            clanStatsAverages.vipScore = vipSum / vipRows.length;
          }
        } catch (vipError) {
          console.warn('Failed to fetch clan VIP averages:', vipError);
        }
      }
    } else if (resolvedClanTag) {
      try {
        const { data: latestSnapshotRows } = await supabase
          .from('canonical_member_snapshots')
          .select('payload, snapshot_date, player_tag')
          .eq('clan_tag', resolvedClanTag)
          .order('snapshot_date', { ascending: false });

        if (latestSnapshotRows && latestSnapshotRows.length > 0) {
          const playerLatestMap = new Map<string, CanonicalMemberSnapshotV1>();
          latestSnapshotRows.forEach((row) => {
            const tag = row.player_tag;
            if (!playerLatestMap.has(tag)) {
              playerLatestMap.set(tag, row.payload as CanonicalMemberSnapshotV1);
            }
          });

          const members = Array.from(playerLatestMap.values());
          const totals = {
            trophies: { sum: 0, count: 0 },
            donations: { sum: 0, count: 0 },
            warStars: { sum: 0, count: 0 },
            capitalContributions: { sum: 0, count: 0 },
            townHallLevel: { sum: 0, count: 0 },
          };

          members.forEach((payload) => {
            const member = payload?.member;
            if (!member) return;

            const trophies = member.ranked?.trophies ?? member.trophies ?? 0;
            if (trophies > 0) {
              totals.trophies.sum += trophies;
              totals.trophies.count += 1;
            }

            const donations = member.donations?.given ?? 0;
            if (donations > 0) {
              totals.donations.sum += donations;
              totals.donations.count += 1;
            }

            const warStars = member.war?.stars ?? 0;
            if (warStars > 0) {
              totals.warStars.sum += warStars;
              totals.warStars.count += 1;
            }

            const capitalContrib = member.capitalContributions ?? 0;
            if (capitalContrib > 0) {
              totals.capitalContributions.sum += capitalContrib;
              totals.capitalContributions.count += 1;
            }

            const thLevel = member.townHallLevel ?? 0;
            if (thLevel > 0) {
              totals.townHallLevel.sum += thLevel;
              totals.townHallLevel.count += 1;
            }
          });

          if (totals.trophies.count > 0) {
            clanStatsAverages.trophies = totals.trophies.sum / totals.trophies.count;
          }
          if (totals.donations.count > 0) {
            clanStatsAverages.donations = totals.donations.sum / totals.donations.count;
          }
          if (totals.warStars.count > 0) {
            clanStatsAverages.warStars = totals.warStars.sum / totals.warStars.count;
          }
          if (totals.capitalContributions.count > 0) {
            clanStatsAverages.capitalContributions = totals.capitalContributions.sum / totals.capitalContributions.count;
          }
          if (totals.townHallLevel.count > 0) {
            clanStatsAverages.townHallLevel = totals.townHallLevel.sum / totals.townHallLevel.count;
          }
        }
      } catch (error) {
        console.warn('Failed to calculate clan stats averages:', error);
      }
    }

    // PERFORMANCE: Parallelize all leadership data queries - they don't depend on each other
    const [
      { data: notesRows, error: notesError },
      { data: warningsRows, error: warningsError },
      { data: tenureRows, error: tenureError },
      { data: departureRows, error: departureError },
      { data: evaluationRows, error: evaluationError },
      { data: joinerRows, error: joinerError },
      linkedAccounts,
    ] = await Promise.all([
      // Player notes
      resolvedClanTag
        ? supabase
            .from('player_notes')
            .select('id, created_at, note, custom_fields, created_by')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Player warnings
      resolvedClanTag
        ? supabase
            .from('player_warnings')
            .select('id, created_at, warning_note, is_active, created_by')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Tenure actions
      resolvedClanTag
        ? supabase
            .from('player_tenure_actions')
            .select('id, created_at, action, reason, granted_by, created_by')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Departure actions
      resolvedClanTag
        ? supabase
            .from('player_departure_actions')
            .select('id, created_at, reason, departure_type, recorded_by, created_by')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Evaluations
      resolvedClanTag
        ? supabase
            .from('applicant_evaluations')
            .select('id, status, score, recommendation, rush_percent, evaluation, applicant, created_at, updated_at')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Joiner events
      resolvedClanTag
        ? supabase
            .from('joiner_events')
            .select('id, detected_at, status, metadata')
            .eq('clan_tag', resolvedClanTag)
            .eq('player_tag', normalizedTag)
            .order('detected_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      resolvedClanTag ? getLinkedTagsWithNames(resolvedClanTag, normalizedTag) : Promise.resolve([]),
    ]);
    if (notesError) {
      throw notesError;
    }
    if (warningsError) {
      throw warningsError;
    }
    if (tenureError) {
      throw tenureError;
    }
    if (departureError) {
      throw departureError;
    }
    if (evaluationError) {
      throw evaluationError;
    }
    if (joinerError) {
      throw joinerError;
    }

    // PERFORMANCE: Fetch VIP scores (memberRow already fetched in parallel above)
    let currentVip = null;
    let vipHistory: Array<{ week_start: string; vip_score: number; competitive_score: number; support_score: number; development_score: number; rank: number }> = [];
    
    try {
      if (memberRow?.id) {
        // Get current tournament week
        const now = new Date();
        const dayOfWeek = now.getUTCDay();
        const hours = now.getUTCHours();
        
        let weekStart: Date;
        if (dayOfWeek === 1 && hours < 5) {
          weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 5, 0, 0));
        } else {
          const daysSinceTuesday = dayOfWeek === 0 ? 2 : (dayOfWeek === 1 ? 1 : dayOfWeek - 1);
          weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceTuesday, 5, 0, 0));
        }
        
        const weekStartISO = weekStart.toISOString().split('T')[0];
        
        // Fetch current week VIP
        const { data: currentVipRow } = await supabase
          .from('vip_scores')
          .select('vip_score, competitive_score, support_score, development_score, week_start')
          .eq('member_id', memberRow.id)
          .eq('week_start', weekStartISO)
          .single();
        
        if (currentVipRow) {
          // Get rank for current week
          const { data: allCurrentWeekVip } = await supabase
            .from('vip_scores')
            .select('member_id, vip_score')
            .eq('week_start', weekStartISO)
            .order('vip_score', { ascending: false });
          
          const rank = (allCurrentWeekVip?.findIndex(row => row.member_id === memberRow.id) ?? -1) + 1;
          
          currentVip = {
            score: Number(currentVipRow.vip_score),
            rank,
            competitive_score: Number(currentVipRow.competitive_score),
            support_score: Number(currentVipRow.support_score),
            development_score: Number(currentVipRow.development_score),
            week_start: currentVipRow.week_start,
          };
        }
        
        // Fetch historical VIP scores (last 8 weeks)
        const { data: historicalVipRows } = await supabase
          .from('vip_scores')
          .select('vip_score, competitive_score, support_score, development_score, week_start')
          .eq('member_id', memberRow.id)
          .order('week_start', { ascending: false })
          .limit(8);
        
        if (historicalVipRows) {
          // Get ranks for historical weeks
          for (const row of historicalVipRows) {
            const { data: weekVipRows } = await supabase
              .from('vip_scores')
              .select('member_id, vip_score')
              .eq('week_start', row.week_start)
              .order('vip_score', { ascending: false });
            
            const rank = (weekVipRows?.findIndex(w => w.member_id === memberRow.id) ?? -1) + 1;
            
            vipHistory.push({
              week_start: row.week_start,
              vip_score: Number(row.vip_score),
              competitive_score: Number(row.competitive_score),
              support_score: Number(row.support_score),
              development_score: Number(row.development_score),
              rank,
            });
          }
        }
      }
    } catch (error) {
      console.warn('[player-profile] Failed to fetch VIP scores:', error);
      // Continue without VIP data
    }

    // Determine if current user has leadership access for this clan
    const isLeadership = normalizedResolvedClanTag && userRoles.length
      ? userRoles.some(
          (role) =>
            role.clan_tag === normalizedResolvedClanTag &&
            (role.role === 'leader' || role.role === 'coleader')
      )
      : false;

    const responsePayload = {
      summary,
      timeline: timelineStats.timeline,
      history: historyRow ?? null,
      clanHeroAverages,
      clanStatsAverages,
      linkedAccounts,
      leadership: isLeadership ? {
        notes: ensureArray(notesRows),
        warnings: ensureArray(warningsRows),
        tenureActions: ensureArray(tenureRows),
        departureActions: ensureArray(departureRows),
      } : {
        notes: [],
        warnings: [],
        tenureActions: [],
        departureActions: [],
      },
      evaluations: isLeadership ? ensureArray(evaluationRows) : [],
      joinerEvents: isLeadership ? ensureArray(joinerRows) : [],
      vip: {
        current: currentVip,
        history: vipHistory,
      },
      // Include snapshot date for debugging/freshness tracking
      _metadata: {
        snapshotDate: latestSnapshotDate,
        fetchedAt: new Date().toISOString(),
      },
    };

    const response = NextResponse.json({ success: true, data: responsePayload });
    
    // PERFORMANCE: Aggressive caching - data only changes once per day (nightly ingestion)
    // Cache for 12 hours, stale-while-revalidate for 24 hours
    // Cache will be invalidated when new snapshot is ingested (new snapshot_date)
    response.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    
    return response;
  } catch (error: any) {
    console.error('[player-profile] canonical error', error);
    const message = error?.message || 'Failed to load player profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
