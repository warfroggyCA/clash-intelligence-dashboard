import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag, safeTagForFilename } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';
import type { Member, PlayerActivityTimelineEvent } from '@/types';
import { sanitizeErrorForApi } from '@/lib/security/error-sanitizer';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
} from '@/lib/activity/timeline';
import { resolveRosterMembers } from '@/lib/roster-resolver';
import { calculateHistoricalTrophiesForPlayers } from '@/lib/business/historical-trophies';
import { mapActivityToBand, resolveHeroPower, resolveLeagueDisplay, resolveTrophies } from '@/lib/roster-derivations';
import { getClanSetting } from '@/lib/clan-settings';
import { getAuthenticatedUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';
// Cache roster data aggressively - data only updates once per day (nightly cron)
// Cache for 12 hours (43200 seconds) - will refresh when new ingestion runs
// Users can force refresh if needed, but normal browsing benefits from long cache
export const revalidate = 43200; // 12 hours

const querySchema = z.object({
  clanTag: z.string().optional(),
  mode: z.enum(['snapshot', 'live', 'latest']).optional(),
});

// Helper to get current season start (1st Monday of the month)
const getCurrentSeasonStart = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0 (Sun) to 6 (Sat)
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setUTCDate(1 + (dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7));
  return firstMonday.toISOString();
};

const SEASON_START_ISO = getCurrentSeasonStart();
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

    // PRIVACY ENFORCEMENT
    const visibility = await getClanSetting(clanTag, 'rosterVisibility', 'public');
    if (visibility !== 'public') {
      const { requireRole } = await import('@/lib/auth/guards');
      try {
        const allowedRoles = visibility === 'leadership' ? ['leader', 'coleader'] : ['member', 'elder', 'coleader', 'leader'];
        await requireRole(req, allowedRoles as any, { clanTag });
      } catch (authError) {
        return NextResponse.json({ success: false, error: 'Private Roster: Login required.' }, { status: 403 });
      }
    }

    // MODE HANDLING:
    // snapshot: Use roster_snapshots (nightly SSOT)
    // live: Trigger fresh CoC API fetch then return
    // latest (default): Try roster_snapshots if reasonably fresh, otherwise trigger live
    const mode = parsed.data.mode || 'latest';

    if (mode === 'live') {
      // Leadership-only live refresh to protect CoC API quota.
      // This triggers ingestion (CoC fetch) and then returns the newest snapshot.
      try {
        const { requireRole } = await import('@/lib/auth/guards');
        await requireRole(req, ['leader', 'coleader'], { clanTag });

        const { runFastIngestion } = await import('@/lib/ingestion/run-ingestion');
        await runFastIngestion({ clanTag });
        // After ingestion, the latest snapshot will be the one just created.
      } catch (ingestError) {
        console.warn('[roster] Live refresh failed (or unauthorized), falling back to snapshot:', ingestError);
      }
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

    const { members, memberTagToId: memberTagToUuidMap, memberIdToTag: memberIdToTagMap } =
      await resolveRosterMembers({
        supabase,
        clanTag,
        snapshotId: snapshot.id,
        snapshotDate: latestSnapshotDate,
      });

    // PERFORMANCE: Fetch player_day data in parallel with member processing
    // This query doesn't depend on the members array, so it can run concurrently
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);
    const sinceIso = sinceDate.toISOString().slice(0, 10);
    
    const clanTagNoHash = clanTag.replace('#', '');
    const playerDayQueryPromise = supabase
      .from('player_day')
      .select(
        'player_tag, date, clan_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability',
      )
      // NOTE: Some historical tables store clan_tag in "safe" form (no leading #) and/or lowercase.
      // Newer ingestion uses normalized tags (leading #, uppercase). Query common variants.
      .in('clan_tag', [clanTag, safeClanTag, clanTagNoHash, clanTagNoHash.toLowerCase()])
      .gte('date', sinceIso)
      .order('player_tag')
      .order('date');

    type SnapshotMember = (typeof members)[number];

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

      const activityEvidence = resolveMemberActivity({
        ...toMemberForActivity(member),
        activityTimeline,
      } as Member & { activityTimeline?: PlayerActivityTimelineEvent[] });

      const activityScore = activityEvidence?.score ?? member.activity_score ?? null;
      
      // Use SSOT historical trophy data
      const historicalData = historicalTrophyDataByMember.get(memberTag);
      const resolvedLastWeek = historicalData?.lastWeekTrophies ?? timelineStats?.lastWeekTrophies ?? null;
      const resolvedSeasonTotal = historicalData?.seasonTotalTrophies ?? timelineStats?.seasonTotalTrophies ?? null;

      const resolvedTrophies = resolveTrophies(member);
      const resolvedLeague = resolveLeagueDisplay(member, { allowProfileFallback: false });
      const heroPower = resolveHeroPower({
        hero_levels: member.hero_levels ?? null,
        bk: member.hero_levels?.bk ?? null,
        aq: member.hero_levels?.aq ?? null,
        gw: member.hero_levels?.gw ?? null,
        rc: member.hero_levels?.rc ?? null,
        mp: member.hero_levels?.mp ?? null,
      });
      const activityBand = mapActivityToBand(activityEvidence);

      return {
        id: member.id,
        tag: member.tag,
        name: member.name,
        role: member.role,
        townHallLevel: member.th_level,
        trophies: member.trophies ?? null,
        rankedTrophies: member.ranked_trophies ?? null,
        rankedLeagueId: member.ranked_league_id,
        rankedLeagueName: member.ranked_league_name,
        leagueId: member.league_id,
        leagueName: member.league_name,
        leagueTrophies: member.league_trophies ?? null,
        battleModeTrophies: member.battle_mode_trophies ?? null,
        donations: member.donations ?? null,
        donationsReceived: member.donations_received ?? null,
        // Convenience aliases for quick access (mirrors activity.metrics)
        donationDelta: activityEvidence?.metrics?.donationDelta ?? 0,
        donationReceivedDelta: activityEvidence?.metrics?.donationReceivedDelta ?? 0,
        heroLevels: member.hero_levels,
        bk: member.hero_levels?.bk ?? null,
        aq: member.hero_levels?.aq ?? null,
        gw: member.hero_levels?.gw ?? null,
        rc: member.hero_levels?.rc ?? null,
        mp: member.hero_levels?.mp ?? null,
        activityScore,
        activity: activityEvidence,
        activityBand: activityBand.band,
        activityTone: activityBand.tone,
        resolvedTrophies,
        resolvedLeague: {
          name: resolvedLeague.league,
          tier: resolvedLeague.tier ?? undefined,
          hasLeague: resolvedLeague.hasLeague,
        },
        heroPower,
        rushPercent: member.rush_percent ?? null,
        bestTrophies: member.best_trophies ?? null,
        bestVersusTrophies: member.best_versus_trophies ?? null,
        warStars: member.war_stars ?? null,
        attackWins: member.attack_wins ?? null,
        defenseWins: member.defense_wins ?? null,
        capitalContributions: member.capital_contributions ?? null,
        petLevels: member.pet_levels,
        builderHallLevel: member.builder_hall_level ?? null,
        versusTrophies: member.versus_trophies ?? null,
        versusBattleWins: member.versus_battle_wins ?? null,
        builderLeagueId: member.builder_league_id,
        maxTroopCount: member.max_troop_count ?? null,
        maxSpellCount: member.max_spell_count ?? null,
        superTroopsActive: member.super_troops_active,
        achievementCount: member.achievement_count ?? null,
        achievementScore: member.achievement_score ?? null,
        expLevel: member.exp_level ?? null,
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
        if (members.length > 0) {
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

          Object.entries(totals).forEach(([hero, data]) => {
            if (data.count > 0) {
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

    // Sort by resolved trophies descending (fallback to raw trophies when present)
    const scoreTrophies = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : -1;
    transformedMembers.sort(
      (a, b) =>
        scoreTrophies(b.resolvedTrophies ?? b.trophies ?? null) -
        scoreTrophies(a.resolvedTrophies ?? a.trophies ?? null),
    );

    const snapshotDate = latestSnapshotDate;
    const payloadVersion = snapshot.payload_version ?? `snapshot-${snapshot.id}`;
    const sumIfComplete = (values: Array<number | null | undefined>): number | null => {
      let sum = 0;
      let hasValue = false;
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          hasValue = true;
        } else {
          return null;
        }
      }
      return hasValue ? sum : null;
    };
    const computedTotalTrophies = sumIfComplete(transformedMembers.map((m) => m.resolvedTrophies ?? m.trophies ?? null));
    const computedTotalDonations = sumIfComplete(transformedMembers.map((m) => m.donations ?? null));
    const totalTrophies = snapshot.total_trophies ?? computedTotalTrophies;
    const totalDonations = snapshot.total_donations ?? computedTotalDonations;

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
