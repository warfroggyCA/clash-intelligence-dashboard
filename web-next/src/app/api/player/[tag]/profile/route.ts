import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { calculateActivityScore } from '@/lib/business/calculations';
import { cfg } from '@/lib/config';
import { readTenureDetails } from '@/lib/tenure';
import { CANONICAL_MEMBER_SNAPSHOT_VERSION } from '@/types/canonical-member-snapshot';
import type { CanonicalMemberSnapshotV1 } from '@/types/canonical-member-snapshot';
import type { PlayerTimelinePoint, PlayerSummarySupabase } from '@/types/player-profile-supabase';
import type { Member, MemberEnriched, PlayerActivityTimelineEvent } from '@/types';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
  type TimelineComputation,
} from '@/lib/activity/timeline';

export const dynamic = 'force-dynamic';

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

  const chronological = [...rows]
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
    },
    builderBase: {
      hallLevel: member.builderBase.hallLevel ?? null,
      trophies: member.builderBase.trophies ?? null,
      battleWins: member.builderBase.battleWins ?? null,
      leagueId: member.builderBase.leagueId ?? null,
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
  const baseSelect = supabase
    .from('canonical_member_snapshots')
    .select('clan_tag, snapshot_date, payload')
    .eq('player_tag', playerTag)
    .order('snapshot_date', { ascending: false })
    .limit(limit);

  if (clanTag) {
    const { data, error } = await baseSelect.eq('clan_tag', clanTag);
    if (!error && data?.length) {
      return data as CanonicalSnapshotRow[];
    }
    if (error && error.code !== 'PGRST205') {
      throw error;
    }
  }

  const { data, error } = await baseSelect;
  if (error) {
    throw error;
  }
  return (data ?? []) as CanonicalSnapshotRow[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const requestedTag = params?.tag ?? '';
    const normalizedTag = normalizeTag(requestedTag);
    if (!normalizedTag) {
      return NextResponse.json({ success: false, error: 'Player tag is required' }, { status: 400 });
    }

    const homeClanTag = cfg.homeClanTag ? normalizeTag(cfg.homeClanTag) : null;

    const canonicalRows = await fetchCanonicalSnapshots(supabase, normalizedTag, homeClanTag);
    const filteredRows = canonicalRows.filter(
      (row) => row.payload?.schemaVersion === CANONICAL_MEMBER_SNAPSHOT_VERSION,
    );

    if (!filteredRows.length) {
      return NextResponse.json({ success: false, error: 'Player not found in canonical snapshots' }, { status: 404 });
    }

    const latestSnapshot = filteredRows[0].payload;
    const clanTag = latestSnapshot.clanTag ?? filteredRows[0].clan_tag ?? homeClanTag;

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url')
      .eq('tag', clanTag)
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

    let summary = buildSummary(
      latestSnapshot,
      timelineStats,
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
    if (clanTag) {
      try {
        // Fetch current roster data for clan averages
        const { data: rosterRows, error: rosterError } = await supabase
          .from('canonical_member_snapshots')
          .select('payload')
          .eq('clan_tag', clanTag)
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

    const { data: historyRow, error: historyError } = clanTag
      ? await supabase
          .from('player_history')
          .select('*')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .maybeSingle()
      : { data: null, error: null };
    if (historyError) {
      throw historyError;
    }

    const { data: notesRows, error: notesError } = clanTag
      ? await supabase
          .from('player_notes')
          .select('id, created_at, note, custom_fields, created_by')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (notesError) {
      throw notesError;
    }

    const { data: warningsRows, error: warningsError } = clanTag
      ? await supabase
          .from('player_warnings')
          .select('id, created_at, warning_note, is_active, created_by')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (warningsError) {
      throw warningsError;
    }

    const { data: tenureRows, error: tenureError } = clanTag
      ? await supabase
          .from('player_tenure_actions')
          .select('id, created_at, action, reason, granted_by, created_by')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (tenureError) {
      throw tenureError;
    }

    const { data: departureRows, error: departureError } = clanTag
      ? await supabase
          .from('player_departure_actions')
          .select('id, created_at, reason, departure_type, recorded_by, created_by')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (departureError) {
      throw departureError;
    }

    const { data: evaluationRows, error: evaluationError } = clanTag
      ? await supabase
          .from('applicant_evaluations')
          .select('id, status, score, recommendation, rush_percent, evaluation, applicant, created_at, updated_at')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (evaluationError) {
      throw evaluationError;
    }

    const { data: joinerRows, error: joinerError } = clanTag
      ? await supabase
          .from('joiner_events')
          .select('id, detected_at, status, metadata')
          .eq('clan_tag', clanTag)
          .eq('player_tag', normalizedTag)
          .order('detected_at', { ascending: false })
      : { data: [], error: null };
    if (joinerError) {
      throw joinerError;
    }

    const responsePayload = {
      summary,
      timeline: timelineStats.timeline,
      history: historyRow ?? null,
      clanHeroAverages,
      leadership: {
        notes: ensureArray(notesRows),
        warnings: ensureArray(warningsRows),
        tenureActions: ensureArray(tenureRows),
        departureActions: ensureArray(departureRows),
      },
      evaluations: ensureArray(evaluationRows),
      joinerEvents: ensureArray(joinerRows),
    };

    return NextResponse.json({ success: true, data: responsePayload });
  } catch (error: any) {
    console.error('[player-profile] canonical error', error);
    const message = error?.message || 'Failed to load player profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
