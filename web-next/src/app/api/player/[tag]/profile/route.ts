import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { calculateActivityScore } from '@/lib/business/calculations';
import { cfg } from '@/lib/config';
import { readTenureDetails } from '@/lib/tenure';
import { CANONICAL_MEMBER_SNAPSHOT_VERSION } from '@/types/canonical-member-snapshot';
import type { CanonicalMemberSnapshotV1 } from '@/types/canonical-member-snapshot';
import type { PlayerTimelinePoint, PlayerSummarySupabase, SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import type { Member, MemberEnriched, PlayerActivityTimelineEvent } from '@/types';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
  type TimelineComputation,
} from '@/lib/activity/timeline';
import { calculateHistoricalTrophiesForPlayer } from '@/lib/business/historical-trophies';
import { getPlayer } from '@/lib/coc';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Keep API route fresh, but page will cache via server component

const SEASON_START_ISO = DEFAULT_SEASON_START_ISO;

interface CanonicalSnapshotRow {
  clan_tag: string;
  snapshot_date: string | null;
  payload: CanonicalMemberSnapshotV1;
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

function buildTimeline(rows: CanonicalSnapshotRow[]): TimelineComputation {
  if (!rows.length) {
    return { timeline: [], lastWeekTrophies: null, seasonTotalTrophies: null };
  }

  const RANKED_START_DATE = '2025-10-06'; // Ranked League started Oct 6, 2025

  const chronological = [...rows]
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
      return aDate - bDate;
    });

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
  const league = member.league ?? { id: null, name: null, trophies: null, iconSmall: null, iconMedium: null };
  const ranked = member.ranked ?? { leagueId: null, leagueName: null, trophies: null, iconSmall: null, iconMedium: null };
  const donationsGiven = member.donations.given ?? null;
  const donationsReceived = member.donations.received ?? null;
  const donationBalance = donationsGiven != null && donationsReceived != null
    ? donationsGiven - donationsReceived
    : null;

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
      stars: member.war.stars ?? null,
      attackWins: member.war.attackWins ?? null,
      defenseWins: member.war.defenseWins ?? null,
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

async function fetchCanonicalSnapshots(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  playerTag: string,
  clanTag: string | null,
  limit = 120,
): Promise<CanonicalSnapshotRow[]> {
  const RANKED_START_DATE = '2025-10-06'; // Filter at SQL level to exclude Oct 5 and earlier
  
  const baseSelect = supabase
    .from('canonical_member_snapshots')
    .select('clan_tag, snapshot_date, payload')
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
  { params }: { params: { tag: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const requestedTag = params?.tag ?? '';
    const normalizedTag = normalizeTag(requestedTag);
    if (!normalizedTag) {
      return NextResponse.json({ success: false, error: 'Player tag is required' }, { status: 400 });
    }

    // Get clanTag from query parameter, fallback to homeClanTag
    const { searchParams } = new URL(req.url);
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
              const { data: rosterRows } = await supabase
                .from('canonical_member_snapshots')
                .select('payload')
                .eq('clan_tag', clanTag)
                .order('snapshot_date', { ascending: false })
                .limit(50);
              
              if (rosterRows && rosterRows.length > 0) {
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

    const latestSnapshot = filteredRows[0].payload;
    const latestSnapshotDate = filteredRows[0].snapshot_date;
    // Use requested clanTag if provided, otherwise fall back to snapshot's clanTag
    const resolvedClanTag = clanTag ?? latestSnapshot.clanTag ?? filteredRows[0].clan_tag ?? null;
    
    // Log the latest snapshot date for debugging
    console.log(`[player-profile] Latest snapshot date for ${normalizedTag}: ${latestSnapshotDate}`);

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url')
      .eq('tag', resolvedClanTag)
      .maybeSingle();
    if (clanError && clanError.code !== 'PGRST116') {
      throw clanError;
    }

    const tenureDetails = await readTenureDetails(latestSnapshot.snapshotDate ?? undefined);
    const tenureInfo = tenureDetails[latestSnapshot.playerTag] ?? null;

    let timelineStats: TimelineComputation;

    const { data: playerDayRows, error: playerDayError } = await supabase
      .from('player_day')
      .select('date, clan_tag, player_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability')
      .eq('player_tag', normalizedTag)
      .order('date', { ascending: true });

    if (playerDayError && playerDayError.code !== 'PGRST116') {
      throw playerDayError;
    }

    if (playerDayRows && playerDayRows.length) {
      timelineStats = buildTimelineFromPlayerDay(playerDayRows as PlayerDayTimelineRow[], SEASON_START_ISO);
    } else {
      timelineStats = buildTimeline(filteredRows);
    }

    // Get member ID for historical trophy calculations (SSOT)
    let historicalTrophyData: Awaited<ReturnType<typeof calculateHistoricalTrophiesForPlayer>> | null = null;
    try {
      const { data: memberRow } = await supabase
        .from('members')
        .select('id')
        .eq('tag', normalizedTag)
        .maybeSingle();
      
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

    let summary = buildSummary(
      latestSnapshot,
      {
        ...timelineStats,
        lastWeekTrophies: resolvedLastWeekTrophies,
        seasonTotalTrophies: resolvedSeasonTotalTrophies,
      },
      clanRow?.name ?? null,
      tenureInfo?.days ?? latestSnapshot.member.tenure.days ?? null,
      tenureInfo?.as_of ?? latestSnapshot.member.tenure.asOf ?? null,
    );

    const memberForActivity: Member = {
      name: summary.name ?? summary.tag,
      tag: summary.tag,
      role: summary.role ?? undefined,
      townHallLevel: summary.townHallLevel ?? undefined,
      trophies: summary.trophies ?? undefined,
      rankedTrophies: summary.rankedTrophies ?? undefined,
      rankedLeagueId: summary.rankedLeague.id ?? undefined,
      rankedLeagueName: summary.rankedLeague.name ?? undefined,
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
    const activityEvidence = calculateActivityScore(memberForActivity, {
      timeline: activityTimeline,
      lookbackDays: 7,
    });
    summary = {
      ...summary,
      activityScore: summary.activityScore ?? activityEvidence.score ?? null,
      activity: activityEvidence,
    };

    // Calculate clan hero averages for comparison
    let clanHeroAverages: Record<string, number> = {};
    if (resolvedClanTag) {
      try {
        // Fetch current roster data for clan averages
        const { data: rosterRows, error: rosterError } = await supabase
          .from('canonical_member_snapshots')
          .select('payload')
          .eq('clan_tag', resolvedClanTag)
          .order('snapshot_date', { ascending: false })
          .limit(50); // Get recent snapshots

        console.log('Clan averages calculation - rosterRows:', rosterRows?.length || 0);
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
          console.log('Calculated clan hero averages:', clanHeroAverages);
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
    if (resolvedClanTag) {
      try {
        // Fetch most recent snapshot for each clan member
        const { data: latestSnapshotRows } = await supabase
          .from('canonical_member_snapshots')
          .select('payload, snapshot_date, player_tag')
          .eq('clan_tag', resolvedClanTag)
          .order('snapshot_date', { ascending: false });

        if (latestSnapshotRows && latestSnapshotRows.length > 0) {
          // Get unique players (most recent snapshot per player)
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
            vipScore: { sum: 0, count: 0 },
          };

          members.forEach((payload) => {
            const member = payload?.member;
            if (!member) return;

            // Trophies
            const trophies = member.ranked?.trophies ?? member.trophies ?? 0;
            if (trophies > 0) {
              totals.trophies.sum += trophies;
              totals.trophies.count += 1;
            }

            // Donations
            const donations = member.donations?.given ?? 0;
            if (donations > 0) {
              totals.donations.sum += donations;
              totals.donations.count += 1;
            }

            // War stars (from war.stars)
            const warStars = member.war?.stars ?? 0;
            if (warStars > 0) {
              totals.warStars.sum += warStars;
              totals.warStars.count += 1;
            }

            // Capital contributions
            const capitalContrib = member.capitalContributions ?? 0;
            if (capitalContrib > 0) {
              totals.capitalContributions.sum += capitalContrib;
              totals.capitalContributions.count += 1;
            }

            // Town Hall level
            const thLevel = member.townHallLevel ?? 0;
            if (thLevel > 0) {
              totals.townHallLevel.sum += thLevel;
              totals.townHallLevel.count += 1;
            }
          });

          // Calculate averages
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

          // VIP score average (use current week VIP scores)
          const weekStartISO = new Date().toISOString().split('T')[0];
          const monday = new Date(weekStartISO);
          monday.setUTCDate(monday.getUTCDate() - monday.getUTCDay() + 1);
          const weekStart = monday.toISOString().split('T')[0];

          try {
            const { data: vipRows } = await supabase
              .from('vip_scores')
              .select('vip_score, member_id')
              .eq('week_start', weekStart);

            if (vipRows && vipRows.length > 0) {
              const vipSum = vipRows.reduce((sum, row) => sum + Number(row.vip_score || 0), 0);
              clanStatsAverages.vipScore = vipSum / vipRows.length;
            }
          } catch (vipError) {
            console.warn('Failed to fetch clan VIP averages:', vipError);
          }
        }
      } catch (error) {
        console.warn('Failed to calculate clan stats averages:', error);
      }
    }

    const { data: historyRow, error: historyError } = resolvedClanTag
      ? await supabase
          .from('player_history')
          .select('*')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .maybeSingle()
      : { data: null, error: null };
    if (historyError) {
      throw historyError;
    }

    const { data: notesRows, error: notesError } = resolvedClanTag
      ? await supabase
          .from('player_notes')
          .select('id, created_at, note, custom_fields, created_by')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (notesError) {
      throw notesError;
    }

    const { data: warningsRows, error: warningsError } = resolvedClanTag
      ? await supabase
          .from('player_warnings')
          .select('id, created_at, warning_note, is_active, created_by')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (warningsError) {
      throw warningsError;
    }

    const { data: tenureRows, error: tenureError } = resolvedClanTag
      ? await supabase
          .from('player_tenure_actions')
          .select('id, created_at, action, reason, granted_by, created_by')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (tenureError) {
      throw tenureError;
    }

    const { data: departureRows, error: departureError } = resolvedClanTag
      ? await supabase
          .from('player_departure_actions')
          .select('id, created_at, reason, departure_type, recorded_by, created_by')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (departureError) {
      throw departureError;
    }

    const { data: evaluationRows, error: evaluationError } = resolvedClanTag
      ? await supabase
          .from('applicant_evaluations')
          .select('id, status, score, recommendation, rush_percent, evaluation, applicant, created_at, updated_at')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (evaluationError) {
      throw evaluationError;
    }

    const { data: joinerRows, error: joinerError } = resolvedClanTag
      ? await supabase
          .from('joiner_events')
          .select('id, detected_at, status, metadata')
          .eq('clan_tag', resolvedClanTag)
          .eq('player_tag', normalizedTag)
          .order('detected_at', { ascending: false })
      : { data: [], error: null };
    if (joinerError) {
      throw joinerError;
    }

    // Fetch VIP scores for current and historical weeks
    let currentVip = null;
    let vipHistory: Array<{ week_start: string; vip_score: number; competitive_score: number; support_score: number; development_score: number; rank: number }> = [];
    
    try {
      // Get member ID
      const { data: memberRow } = await supabase
        .from('members')
        .select('id')
        .eq('tag', normalizedTag)
        .single();
      
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

    // Check user role to filter leadership data
    // TODO: Replace with real auth check when authentication is implemented
    const userRole = req.headers.get('x-user-role') || 'member';
    const isLeadership = userRole === 'leader' || userRole === 'coLeader' || userRole === 'coleader';

    const responsePayload = {
      summary,
      timeline: timelineStats.timeline,
      history: historyRow ?? null,
      clanHeroAverages,
      clanStatsAverages,
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

    return NextResponse.json({ success: true, data: responsePayload });
  } catch (error: any) {
    console.error('[player-profile] canonical error', error);
    const message = error?.message || 'Failed to load player profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
