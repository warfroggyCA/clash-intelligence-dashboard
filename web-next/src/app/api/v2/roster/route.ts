import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag, safeTagForFilename } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { calculateActivityScore } from '@/lib/business/calculations';
import type { Member } from '@/types';
import { sanitizeErrorForApi } from '@/lib/security/error-sanitizer';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
} from '@/lib/activity/timeline';
import { readLedgerEffective } from '@/lib/tenure';
import { calculateHistoricalTrophiesForPlayers } from '@/lib/business/historical-trophies';

export const dynamic = 'force-dynamic';
// Cache roster data aggressively - data only updates once per day (nightly cron)
// Cache for 12 hours (43200 seconds) - will refresh when new ingestion runs
// Users can force refresh if needed, but normal browsing benefits from long cache
export const revalidate = 43200; // 12 hours

const querySchema = z.object({
  clanTag: z.string().optional(),
});

const SEASON_START_ISO = '2025-10-01T00:00:00Z'; // Start from beginning of October when ranked system started
// First official ranked finals Monday in the new system
const RANKED_START_MONDAY_ISO = '2025-10-13';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const weekStartKey = (date: Date): string => {
      const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const dayOfWeek = base.getUTCDay(); // 0 = Sun ... 6 = Sat
      const diff = base.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      base.setUTCDate(diff);
      base.setUTCHours(0, 0, 0, 0);
      return base.toISOString().slice(0, 10);
    };
    const searchParams = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid query parameters' }, { status: 400 });
    }

    const requestedTag = parsed.data.clanTag || cfg.homeClanTag || '';
    const clanTag = normalizeTag(requestedTag);

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'A valid clanTag is required' }, { status: 400 });
    }

    // Get clan info
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url, created_at, updated_at')
      .eq('tag', clanTag)
      .single();

    if (clanError) {
      if (clanError.code === 'PGRST116') {
        // Clan not in database - check if it's a tracked clan
        try {
          const { data: trackedClan } = await supabase
            .from('tracked_clans')
            .select('clan_tag')
            .eq('clan_tag', clanTag)
            .eq('is_active', true)
            .maybeSingle();
          
          if (trackedClan) {
            // It's a tracked clan but no data yet - return empty roster in the expected format
        return NextResponse.json({
          success: true,
          data: {
            clan: {
                  tag: clanTag,
                  name: null,
                  logo_url: null,
                },
                snapshot: null,
                members: [],
              },
            });
          }
        } catch (trackedCheckError) {
          // If we can't check tracked clans, fall through to 404
          console.warn('[roster] Failed to check tracked clans:', trackedCheckError);
        }
        
        return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
      }
      throw clanError;
    }

    // Get the latest roster snapshot (this is where all the ingested data lives)
    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at, member_count, total_trophies, total_donations, metadata, payload_version, ingestion_version, schema_version, computed_at, season_id, season_start, season_end')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      throw snapshotError;
    }

    // If we have no snapshots at all, return an empty dataset in the expected format
    if (!snapshotRows) {
      return NextResponse.json({
        success: true,
        data: {
          clan: {
            id: clanRow.id,
            tag: clanRow.tag,
            name: clanRow.name,
            logo_url: clanRow.logo_url,
            created_at: clanRow.created_at,
            updated_at: clanRow.updated_at,
          },
          members: [],
          snapshot: null,
          dateInfo: {
            currentDate: new Date().toISOString().split('T')[0],
            snapshotDate: null,
            isStale: false,
          },
        },
      });
    }

    const snapshot = snapshotRows;
    const latestSnapshotDate = snapshot.fetched_at?.slice(0, 10) || null;

    // Also load raw clan_snapshot row so we can expose detailed war data
    // Note: clan_snapshots uses safeTagForFilename (lowercase, no #) format
    const safeClanTag = safeTagForFilename(clanTag);
    const { data: clanSnapshotRow, error: clanSnapshotError } = await supabase
      .from('clan_snapshots')
      .select('current_war, war_log, member_summaries, player_details, capital_seasons, metadata')
      .eq('clan_tag', safeClanTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clanSnapshotError) {
      console.warn('[roster] Failed to load clan_snapshot for lookup', clanSnapshotError);
    }

    const snapshotDetails = clanSnapshotRow
      ? {
          currentWar: clanSnapshotRow.current_war ?? null,
          warLog: clanSnapshotRow.war_log ?? [],
          memberSummaries: clanSnapshotRow.member_summaries ?? [],
          playerDetails: clanSnapshotRow.player_details ?? [],
          capitalRaidSeasons: clanSnapshotRow.capital_seasons ?? [],
          metadata: clanSnapshotRow.metadata ?? {},
        }
      : null;

    // PERFORMANCE: Parallelize independent queries to reduce total latency
    // These queries don't depend on each other, so they can run concurrently
    const [
      { data: statsRows, error: statsError },
      { data: canonicalSnapshots, error: canonicalError },
      tenureMap,
    ] = await Promise.all([
      // Get ALL member stats from member_snapshot_stats (this is the single source of truth)
      supabase
        .from('member_snapshot_stats')
        .select('member_id, th_level, role, trophies, donations, donations_received, hero_levels, activity_score, rush_percent, war_stars, attack_wins, defense_wins, capital_contributions, pet_levels, builder_hall_level, versus_trophies, versus_battle_wins, builder_league_id, max_troop_count, max_spell_count, super_troops_active, achievement_count, achievement_score, exp_level, equipment_flags, best_trophies, best_versus_trophies, ranked_trophies, ranked_league_id, ranked_league_name, league_id, league_name, league_trophies, battle_mode_trophies, tenure_days, tenure_as_of')
        .eq('snapshot_id', snapshot.id),
      // Get canonical snapshots for additional data (activity, etc.) - single query
      // Use fetched_at date for matching canonical snapshots
      latestSnapshotDate
        ? supabase
            .from('canonical_member_snapshots')
            .select('player_tag, payload')
            .eq('clan_tag', clanTag)
            .eq('snapshot_date', latestSnapshotDate)
        : supabase
            .from('canonical_member_snapshots')
            .select('player_tag, payload')
            .eq('clan_tag', clanTag)
            .limit(0), // Return empty result if no snapshot date
      // Get tenure data from the tenure ledger
      readLedgerEffective(),
    ]);

    if (statsError) {
      throw statsError;
    }
    if (canonicalError) {
      throw canonicalError;
    }

    const stats = statsRows ?? [];
    const memberIds = stats.map((row) => row.member_id).filter(Boolean) as string[];

    // Get member info (tags, names, cumulative donations) - single query
    const { data: memberRows, error: memberError } = await supabase
      .from('members')
      .select('id, tag, name, cumulative_donations_given, cumulative_donations_received')
      .in('id', memberIds);

    if (memberError) {
      throw memberError;
    }

    const memberLookup = new Map(memberRows?.map(m => [m.id, m]) || []);

    // Map canonical snapshots by tag for quick lookup
    const canonicalByTag = new Map<string, any>();
    for (const cs of canonicalSnapshots || []) {
      const tag = normalizeTag(cs.player_tag || '');
      if (tag && !canonicalByTag.has(tag)) {
        canonicalByTag.set(tag, cs);
      }
    }

    // PERFORMANCE: Fetch player_day data in parallel with member processing
    // This query doesn't depend on the members array, so it can run concurrently
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);
    const sinceIso = sinceDate.toISOString().slice(0, 10);
    
    const playerDayQueryPromise = supabase
      .from('player_day')
      .select(
        'player_tag, date, clan_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability',
      )
      .eq('clan_tag', clanTag)
      .gte('date', sinceIso)
      .order('player_tag')
      .order('date');

    // Build members from stats (single source of truth) + enrich with canonical payload data
    const rawMembers = stats.map(stat => {
      const member = memberLookup.get(stat.member_id);
      if (!member) return null;

      const canonicalTag = normalizeTag(member.tag || '');
      if (!canonicalTag) return null;

      const canonical = canonicalByTag.get(canonicalTag);
      const canonicalMember = canonical?.payload?.member || {};
      const ranked = canonicalMember.ranked || {};
      const league = canonicalMember.league || {};

      return {
        id: member.id,
        tag: canonicalTag,
        name: member.name || canonicalMember.name || canonicalTag,
        th_level: stat.th_level ?? canonicalMember.townHallLevel ?? null,
        role: stat.role ?? canonicalMember.role ?? null,
        trophies: stat.trophies ?? canonicalMember.trophies ?? null,
        ranked_trophies: stat.ranked_trophies ?? canonicalMember.battleModeTrophies ?? ranked.trophies ?? null,
        // LEAGUE DATA FROM STATS (single source of truth), fallback to canonical payload if missing
        ranked_league_id: stat.ranked_league_id ?? ranked.leagueId ?? null,
        ranked_league_name: stat.ranked_league_name ?? ranked.leagueName ?? null,
        league_id: stat.league_id ?? league.id ?? null,
        league_name: stat.league_name ?? league.name ?? null,
        league_trophies: stat.league_trophies ?? league.trophies ?? null,
        battle_mode_trophies: stat.battle_mode_trophies ?? null,
        // DONATIONS FROM STATS (single source of truth)
        donations: stat.donations ?? 0,
        donations_received: stat.donations_received ?? 0,
        // CUMULATIVE DONATIONS FROM MEMBERS TABLE (accumulates over tenure)
        cumulative_donations_given: member.cumulative_donations_given ?? 0,
        cumulative_donations_received: member.cumulative_donations_received ?? 0,
        hero_levels: stat.hero_levels ?? canonicalMember.heroLevels ?? null,
        activity_score: stat.activity_score ?? canonicalMember.activityScore ?? null,
        rush_percent: stat.rush_percent ?? canonicalMember.rushPercent ?? null,
        best_trophies: stat.best_trophies ?? canonicalMember.bestTrophies ?? null,
        best_versus_trophies: stat.best_versus_trophies ?? canonicalMember.bestVersusTrophies ?? null,
        war_stars: stat.war_stars ?? canonicalMember.war?.stars ?? null,
        attack_wins: stat.attack_wins ?? canonicalMember.war?.attackWins ?? null,
        defense_wins: stat.defense_wins ?? canonicalMember.war?.defenseWins ?? null,
        capital_contributions: stat.capital_contributions ?? canonicalMember.capitalContributions ?? null,
        pet_levels: stat.pet_levels ?? canonicalMember.pets ?? null,
        builder_hall_level: stat.builder_hall_level ?? canonicalMember.builderBase?.hallLevel ?? null,
        versus_trophies: stat.versus_trophies ?? canonicalMember.builderBase?.trophies ?? null,
        versus_battle_wins: stat.versus_battle_wins ?? canonicalMember.builderBase?.battleWins ?? null,
        builder_league_id: stat.builder_league_id ?? canonicalMember.builderBase?.league?.id ?? null,
        max_troop_count: stat.max_troop_count ?? 0,
        max_spell_count: stat.max_spell_count ?? 0,
        super_troops_active: stat.super_troops_active ?? canonicalMember.superTroopsActive ?? null,
        achievement_count: stat.achievement_count ?? 0,
        achievement_score: stat.achievement_score ?? 0,
        exp_level: stat.exp_level ?? canonicalMember.expLevel ?? null,
        equipment_flags: stat.equipment_flags ?? canonicalMember.equipmentLevels ?? null,
        tenure_days: stat.tenure_days ?? tenureMap[canonicalTag] ?? null,
        tenure_as_of: stat.tenure_as_of ?? null,
        snapshot_date: latestSnapshotDate,
      };
    }).filter((member): member is NonNullable<typeof member> => member !== null);

    type SnapshotMember = (typeof rawMembers)[number];
    const members: SnapshotMember[] = rawMembers;

    // Build tag->UUID maps from the members we already have (no extra query needed)
    const memberTagToUuidMap = new Map<string, string>();
    const memberIdToTagMap = new Map<string, string>();
    for (const member of members) {
      if (member.id && member.tag) {
        const normalizedTag = normalizeTag(member.tag);
        if (normalizedTag) {
          memberTagToUuidMap.set(normalizedTag, member.id);
          memberIdToTagMap.set(member.id, normalizedTag);
        }
      }
    }

    const canonicalTags = members
      .map((member) => normalizeTag(member.tag ?? ''))
      .filter((tag): tag is string => Boolean(tag));

    // PERFORMANCE: Process player_day data (already fetched in parallel above)
    const timelineByPlayer = new Map<string, ReturnType<typeof buildTimelineFromPlayerDay>>();
    try {
      const { data: playerDayRows, error: playerDayError } = await playerDayQueryPromise;

      if (playerDayError) {
        throw playerDayError;
      }

      if (playerDayRows && playerDayRows.length) {
        const grouped = new Map<string, PlayerDayTimelineRow[]>();
        for (const row of playerDayRows as PlayerDayTimelineRow[]) {
          const tag = normalizeTag(row.player_tag);
          if (!tag) continue;
          if (!grouped.has(tag)) {
            grouped.set(tag, []);
          }
          grouped.get(tag)!.push(row);
        }

        for (const [playerTag, rows] of grouped) {
          timelineByPlayer.set(playerTag, buildTimelineFromPlayerDay(rows, DEFAULT_SEASON_START_ISO));
        }
      }
    } catch (error) {
      console.warn('[Roster API] Failed to load player_day timelines', error);
    }

    const toMemberForActivity = (member: SnapshotMember): Member => {
      const enriched = {
        warStars: member.war_stars ?? null,
        attackWins: member.attack_wins ?? null,
        defenseWins: member.defense_wins ?? null,
        capitalContributions: member.capital_contributions ?? null,
        builderHallLevel: member.builder_hall_level ?? null,
        versusTrophies: member.versus_trophies ?? null,
        versusBattleWins: member.versus_battle_wins ?? null,
        builderLeagueId: member.builder_league_id ?? null,
        achievementCount: member.achievement_count ?? null,
        achievementScore: member.achievement_score ?? null,
        expLevel: member.exp_level ?? null,
        equipmentLevels: member.equipment_flags ?? null,
        petLevels: member.pet_levels ?? null,
        superTroopsActive: member.super_troops_active ?? null,
        maxTroopCount: member.max_troop_count ?? null,
        maxSpellCount: member.max_spell_count ?? null,
      };

      return {
        tag: member.tag ?? null,
        name: member.name ?? member.tag ?? 'Unknown',
        role: member.role ?? null,
        townHallLevel: member.th_level ?? null,
        trophies: member.trophies ?? null,
        rankedTrophies: member.ranked_trophies ?? null,
        rankedLeagueId: member.ranked_league_id ?? null,
        rankedLeagueName: member.ranked_league_name ?? null,
        leagueId: member.league_id ?? null,
        leagueName: member.league_name ?? null,
        donations: member.donations ?? null,
        donationsReceived: member.donations_received ?? null,
        warStars: member.war_stars ?? null,
        attackWins: member.attack_wins ?? null,
        defenseWins: member.defense_wins ?? null,
        capitalContributions: member.capital_contributions ?? null,
        builderHallLevel: member.builder_hall_level ?? null,
        versusTrophies: member.versus_trophies ?? null,
        versusBattleWins: member.versus_battle_wins ?? null,
        superTroopsActive: member.super_troops_active ?? null,
        expLevel: member.exp_level ?? null,
        activity: null,
        enriched: enriched as Member['enriched'],
      } as Member;
    };
    
    // PERFORMANCE: Parallelize historical trophies and VIP score queries
    // These don't depend on each other, so they can run concurrently
    const memberUuids = memberTagToUuidMap.size > 0 
      ? Array.from(memberTagToUuidMap.values()).filter(Boolean)
      : [];
    
    const [historicalTrophyDataByMember, vipScoresByMemberId] = await Promise.all([
      // Calculate historical trophies using SSOT shared function
      memberIdToTagMap.size > 0
        ? calculateHistoricalTrophiesForPlayers(memberIdToTagMap)
        : Promise.resolve(new Map<string, Awaited<ReturnType<typeof calculateHistoricalTrophiesForPlayers>> extends Map<string, infer V> ? V : never>()),
      
      // Fetch VIP scores for current tournament week
      (async () => {
        const vipScoresMap = new Map<string, {
          score: number;
          rank: number;
          competitive_score: number;
          support_score: number;
          development_score: number;
          trend: 'up' | 'down' | 'stable';
          last_week_score?: number;
        }>();
        
        if (memberUuids.length === 0) {
          return vipScoresMap;
        }
        
        try {
          // Get the most recent week_start that has VIP data
          const { data: latestWeekRow, error: weekError } = await supabase
            .from('vip_scores')
            .select('week_start')
            .order('week_start', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (weekError) {
            console.warn('[Roster API] Error fetching latest week:', weekError);
            return vipScoresMap;
          }
          
          if (!latestWeekRow) {
            return vipScoresMap;
          }
          
          const weekStartISO = latestWeekRow.week_start;
          
          // PERFORMANCE: Parallelize current week and last week VIP queries
          const lastWeekStart = new Date(weekStartISO);
          lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
          const lastWeekStartISO = lastWeekStart.toISOString().split('T')[0];
          
          const [
            { data: vipRows, error: vipError },
            { data: lastWeekVipRows, error: lastWeekVipError },
          ] = await Promise.all([
            supabase
              .from('vip_scores')
              .select('member_id, vip_score, competitive_score, support_score, development_score, week_start')
              .in('member_id', memberUuids)
              .eq('week_start', weekStartISO)
              .order('vip_score', { ascending: false }),
            supabase
              .from('vip_scores')
              .select('member_id, vip_score')
              .in('member_id', memberUuids)
              .eq('week_start', lastWeekStartISO),
          ]);
          
          if (vipError) {
            console.warn('[Roster API] Error fetching VIP scores:', vipError);
            return vipScoresMap;
          }
          
          if (lastWeekVipError) {
            console.warn('[Roster API] Error fetching last week VIP scores:', lastWeekVipError);
            // Continue without last week data - trend will remain 'stable'
          }
          
          if (!vipRows) {
            return vipScoresMap;
          }
          
          // Create rank map (1-indexed)
          let rank = 1;
          for (const row of vipRows) {
            vipScoresMap.set(row.member_id, {
              score: Number(row.vip_score),
              rank: rank++,
              competitive_score: Number(row.competitive_score),
              support_score: Number(row.support_score),
              development_score: Number(row.development_score),
              trend: 'stable', // Will calculate trend if we have last week data
            });
          }
          
          // Update trend for each member using last week's scores
          if (lastWeekVipRows) {
            const lastWeekScores = new Map(
              lastWeekVipRows.map(row => [row.member_id, Number(row.vip_score)])
            );
            
            for (const [memberId, vipData] of vipScoresMap.entries()) {
              const lastWeekScore = lastWeekScores.get(memberId);
              if (lastWeekScore !== undefined) {
                vipData.last_week_score = lastWeekScore;
                if (vipData.score > lastWeekScore + 0.5) {
                  vipData.trend = 'up';
                } else if (vipData.score < lastWeekScore - 0.5) {
                  vipData.trend = 'down';
                } else {
                  vipData.trend = 'stable';
                }
              }
            }
          }
        } catch (error) {
          console.warn('[Roster API] Failed to fetch VIP scores:', error);
          // Continue without VIP data - don't fail the request
        }
        
        return vipScoresMap;
      })(),
    ]);

    // Calculate last updated timestamp
    const lastUpdatedRaw = members.reduce<string | null>((latest, entry) => {
      const candidate =
        typeof entry.snapshot_date === 'string' && entry.snapshot_date.trim().length
          ? entry.snapshot_date
          : null;
      if (!candidate) return latest;
      if (!latest) return candidate;
      return candidate > latest ? candidate : latest;
    }, null);

    const toIsoString = (value: string | null): string | null => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.valueOf())) {
        return null;
      }
      return date.toISOString();
    };
    const resolvedFetchedAt = toIsoString(lastUpdatedRaw);

    // Transform members to the expected format
    const transformedMembers = members.map((member) => {
      const memberTag = normalizeTag(member.tag ?? '') || (member.tag ?? '');
      const timelineStats = timelineByPlayer.get(memberTag);
      const timelinePoints = timelineStats?.timeline ?? [];
      const activityTimeline = mapTimelinePointsToActivityEvents(timelinePoints);

      const activityEvidence = calculateActivityScore(toMemberForActivity(member), {
        timeline: activityTimeline,
        lookbackDays: 7,
      });

      const activityScore = activityEvidence?.score ?? member.activity_score ?? 0;
      
      // Use SSOT historical trophy data
      const historicalData = historicalTrophyDataByMember.get(memberTag);
      const resolvedLastWeek = historicalData?.lastWeekTrophies ?? timelineStats?.lastWeekTrophies ?? 0;
      const resolvedSeasonTotal = historicalData?.seasonTotalTrophies ?? timelineStats?.seasonTotalTrophies ?? 0;

      return {
        id: member.id,
        tag: member.tag,
        name: member.name,
        role: member.role,
        townHallLevel: member.th_level,
        trophies: member.trophies || 0,
        rankedTrophies: member.ranked_trophies || 0,
        rankedLeagueId: member.ranked_league_id,
        rankedLeagueName: member.ranked_league_name,
        leagueId: member.league_id,
        leagueName: member.league_name,
        leagueTrophies: member.league_trophies || 0,
        battleModeTrophies: member.battle_mode_trophies || 0,
        donations: member.donations || 0,
        donationsReceived: member.donations_received || 0,
        heroLevels: member.hero_levels,
        bk: member.hero_levels?.bk || 0,
        aq: member.hero_levels?.aq || 0,
        gw: member.hero_levels?.gw || 0,
        rc: member.hero_levels?.rc || 0,
        mp: member.hero_levels?.mp || 0,
        activityScore,
        activity: activityEvidence,
        rushPercent: member.rush_percent || 0,
        bestTrophies: member.best_trophies || 0,
        bestVersusTrophies: member.best_versus_trophies || 0,
        warStars: member.war_stars || 0,
        attackWins: member.attack_wins || 0,
        defenseWins: member.defense_wins || 0,
        capitalContributions: member.capital_contributions || 0,
        petLevels: member.pet_levels,
        builderHallLevel: member.builder_hall_level || 0,
        versusTrophies: member.versus_trophies || 0,
        versusBattleWins: member.versus_battle_wins || 0,
        builderLeagueId: member.builder_league_id,
        maxTroopCount: member.max_troop_count || 0,
        maxSpellCount: member.max_spell_count || 0,
        superTroopsActive: member.super_troops_active,
        achievementCount: member.achievement_count || 0,
        achievementScore: member.achievement_score || 0,
        expLevel: member.exp_level || 0,
        equipmentFlags: member.equipment_flags,
        tenureDays: member.tenure_days ?? null,
        tenure_days: member.tenure_days ?? null,
        tenureAsOf: member.tenure_as_of ?? null,
        tenure_as_of: member.tenure_as_of ?? null,
        lastWeekTrophies: resolvedLastWeek,
        seasonTotalTrophies: resolvedSeasonTotal,
        league: {
          id: member.league_id,
          name: member.league_name,
          trophies: member.league_trophies,
          iconSmall: null,
          iconMedium: null,
        },
        rankedLeague: {
          id: member.ranked_league_id,
          name: member.ranked_league_name,
        },
        vip: (() => {
          // Look up VIP by member UUID (not tag)
          const memberTag = normalizeTag(member.tag ?? '');
          const memberUuid = memberTagToUuidMap.get(memberTag ?? '');
          return memberUuid ? (vipScoresByMemberId.get(memberUuid) || null) : null;
        })(),
      };
    });

    // Calculate clan hero averages for comparison (with counts)
    let clanHeroAverages: Record<string, number | { average: number; count: number }> = {};
    if (clanTag) {
      try {
        // Use the canonical snapshots we already fetched for clan averages
        if (canonicalSnapshots && canonicalSnapshots.length > 0) {
          const totals: Record<string, { sum: number; count: number }> = {
            bk: { sum: 0, count: 0 },
            aq: { sum: 0, count: 0 },
            gw: { sum: 0, count: 0 },
            rc: { sum: 0, count: 0 },
            mp: { sum: 0, count: 0 },
          };

          canonicalSnapshots.forEach((row) => {
            const payload = row.payload as any;
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
              // Store both average and count for accurate display
              clanHeroAverages[hero] = {
                average: data.sum / data.count,
                count: data.count,
              };
            }
          });
        }
      } catch (error) {
        console.warn('[Roster API] Failed to calculate clan hero averages:', error);
        // Continue without clan averages - don't fail the request
      }
    }

    // Sort by trophies descending
    transformedMembers.sort((a, b) => (b.trophies || 0) - (a.trophies || 0));

    const snapshotDate = latestSnapshotDate;
    const payloadVersion = snapshot.payload_version ?? `snapshot-${snapshot.id}`;
    const totalTrophies = snapshot.total_trophies ?? transformedMembers.reduce((sum, m) => sum + (m.trophies || 0), 0);
    const totalDonations = snapshot.total_donations ?? transformedMembers.reduce((sum, m) => sum + (m.donations || 0), 0);

    // Get current date in UTC for comparison
    const currentDateUTC = new Date().toISOString().split('T')[0];
    const snapshotDateOnly = snapshotDate ? snapshotDate.split('T')[0] : null;
    
    const response = NextResponse.json({
      success: true,
      data: {
        clan: clanRow,
        members: transformedMembers,
        seasonEnd: snapshot.season_end ?? null,
        seasonId: snapshot.season_id ?? null,
        seasonStart: snapshot.season_start ?? null,
        snapshot: {
          id: snapshot.id,
          fetchedAt: snapshot.fetched_at ?? resolvedFetchedAt,
          fetched_at: snapshot.fetched_at ?? resolvedFetchedAt,
          memberCount: snapshot.member_count ?? transformedMembers.length,
          member_count: snapshot.member_count ?? transformedMembers.length,
          totalTrophies,
          total_trophies: totalTrophies,
          totalDonations,
          total_donations: totalDonations,
          payloadVersion,
          payload_version: payloadVersion,
          ingestionVersion: snapshot.ingestion_version ?? null,
          ingestion_version: snapshot.ingestion_version ?? null,
          schemaVersion: snapshot.schema_version ?? null,
          schema_version: snapshot.schema_version ?? null,
          computedAt: snapshot.computed_at ?? resolvedFetchedAt,
          computed_at: snapshot.computed_at ?? resolvedFetchedAt,
          seasonId: snapshot.season_id ?? null,
          season_id: snapshot.season_id ?? null,
          seasonStart: snapshot.season_start ?? null,
          season_start: snapshot.season_start ?? null,
          seasonEnd: snapshot.season_end ?? null,
          season_end: snapshot.season_end ?? null,
          snapshotDate,
          snapshot_date: snapshotDate,
          metadata: snapshot.metadata ?? {
            snapshotDate,
            snapshot_date: snapshotDate,
            fetchedAt: snapshot.fetched_at ?? resolvedFetchedAt,
            computedAt: snapshot.computed_at ?? resolvedFetchedAt,
            payloadVersion,
            ingestionVersion: snapshot.ingestion_version ?? null,
            schemaVersion: snapshot.schema_version ?? null,
          },
          },
          // Add date comparison metadata
          dateInfo: {
            currentDate: currentDateUTC,
            snapshotDate: snapshotDateOnly,
            isStale: snapshotDateOnly ? currentDateUTC > snapshotDateOnly : false,
          },
          snapshotDetails,
          // Add clan hero averages for comparison
          clanHeroAverages,
        },
      });

    // PERFORMANCE: Aggressive caching - data only changes once per day (nightly ingestion)
    // Cache for 12 hours, stale-while-revalidate for 24 hours
    // Cache will be invalidated when new snapshot is ingested (new snapshot_date)
    response.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    
    return response;

  } catch (error: any) {
    console.error('[roster] Error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorForApi(error).message },
      { status: 500 }
    );
  }
}
