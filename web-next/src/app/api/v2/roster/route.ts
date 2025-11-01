import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { calculateActivityScore } from '@/lib/business/calculations';
import type { Member } from '@/types';
import {
  buildTimelineFromPlayerDay,
  mapTimelinePointsToActivityEvents,
  DEFAULT_SEASON_START_ISO,
  type PlayerDayTimelineRow,
} from '@/lib/activity/timeline';
import { readLedgerEffective } from '@/lib/tenure';
import { calculateHistoricalTrophiesForPlayers } from '@/lib/business/historical-trophies';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching

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
        return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
      }
      throw clanError;
    }

    // 1) Resolve the newest snapshot_date for this clan from Supabase (no ingestion)
    const { data: latestDateRow, error: latestDateErr } = await supabase
      .from('canonical_member_snapshots')
      .select('snapshot_date')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestDateErr) {
      throw latestDateErr;
    }

    // If we have no snapshots at all, return an empty dataset
    if (!latestDateRow?.snapshot_date) {
      return NextResponse.json({
          success: true,
          data: {
          clanTag: clanRow.tag,
          clanName: clanRow.name,
          logoUrl: clanRow.logo_url,
          lastUpdated: null,
            members: [],
          },
      });
    }

    // 2) Fetch ONLY rows for the newest snapshot_date (freshest dataset)
    const latestSnapshotDate: string = latestDateRow.snapshot_date;
    const { data: canonicalSnapshots, error: canonicalError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('clan_tag', clanTag)
      .eq('snapshot_date', latestSnapshotDate)
      .limit(10000);

    if (canonicalError) {
      throw canonicalError;
    }

    // Group snapshots by player_tag and get one entry per player
    const latestSnapshots = new Map<string, any>();
    for (const snapshot of canonicalSnapshots || []) {
      const key = snapshot.player_tag;
      if (key && !latestSnapshots.has(key)) {
        latestSnapshots.set(key, snapshot);
      }
    }

    // Get tenure data from the tenure ledger
    const tenureMap = await readLedgerEffective();

    const rawMembers = Array.from(latestSnapshots.values()).map(snapshot => {
      const member = snapshot.payload.member;
      const ranked = member.ranked || {};
      const league = member.league || {};
      const war = member.war || {};
      const builderBase = member.builderBase || {};
      const pets = member.pets || {};
      const rawTag = snapshot.player_tag ?? member.tag ?? '';
      const canonicalTag = normalizeTag(rawTag) || (typeof rawTag === 'string' ? rawTag : '');
      if (!canonicalTag) {
        return null;
      }
      
      return {
        id: canonicalTag, // Use normalized tag as ID since we don't have member_id in canonical
        tag: canonicalTag,
        name: member.name,
        th_level: member.townHallLevel,
        role: member.role,
        trophies: member.trophies,
        ranked_trophies: member.battleModeTrophies ?? ranked.trophies,
        ranked_league_id: ranked.leagueId,
        ranked_league_name: ranked.leagueName,
        league_trophies: league.trophies,
        battle_mode_trophies: league.trophies,
        donations: typeof member.donations === 'object' ? (member.donations?.given || 0) : (member.donations || 0),
        donations_received: typeof member.donations === 'object' ? (member.donations?.received || 0) : (member.donationsReceived || 0),
        hero_levels: member.heroLevels,
        activity_score: member.activityScore,
        rush_percent: member.rushPercent,
        best_trophies: member.bestTrophies,
        best_versus_trophies: member.bestVersusTrophies,
        war_stars: war.stars,
        attack_wins: war.attackWins,
        defense_wins: war.defenseWins,
        capital_contributions: member.capitalContributions,
        pet_levels: pets,
        builder_hall_level: builderBase.hallLevel,
        versus_trophies: builderBase.trophies,
        versus_battle_wins: builderBase.battleWins,
        builder_league_id: builderBase.league?.id,
        max_troop_count: 0, // Not available in canonical
        max_spell_count: 0, // Not available in canonical
        super_troops_active: member.superTroopsActive,
        achievement_count: member.achievements?.length || 0,
        achievement_score: 0, // Not available in canonical
        exp_level: member.expLevel,
        equipment_flags: member.equipmentLevels,
        tenure_days: tenureMap[canonicalTag] ?? tenureMap[snapshot.player_tag] ?? null,
        tenure_as_of: null, // Will be populated when tenure is updated
        snapshot_date: snapshot.snapshot_date,
      };
    }).filter((member): member is NonNullable<typeof member> => member !== null);

    type SnapshotMember = (typeof rawMembers)[number];
    const members: SnapshotMember[] = rawMembers;

    const canonicalTags = members
      .map((member) => normalizeTag(member.tag ?? ''))
      .filter((tag): tag is string => Boolean(tag));
    const memberQueryTags = Array.from(
      new Set(
        canonicalTags
          .flatMap((tag) => {
            const stripped = tag.replace(/^#+/, '');
            return stripped && stripped !== tag ? [tag, stripped] : [tag];
          })
          .filter((tag): tag is string => Boolean(tag)),
      ),
    );

    const timelineByPlayer = new Map<string, ReturnType<typeof buildTimelineFromPlayerDay>>();
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 14);
      const sinceIso = sinceDate.toISOString().slice(0, 10);

      const { data: playerDayRows, error: playerDayError } = await supabase
        .from('player_day')
        .select(
          'player_tag, date, clan_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability',
        )
        .eq('clan_tag', clanTag)
        .gte('date', sinceIso)
        .order('player_tag')
        .order('date');

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

    // Create maps from member tag -> UUID for lookup (needed for VIP and historical data)
    const memberTagToUuidMap = new Map<string, string>();
    const memberIdToTagMap = new Map<string, string>();
    
    if (memberQueryTags.length > 0) {
      // Get member IDs from the canonical data for historical lookup (single query for both VIP and historical data)
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('id, tag')
        .in('tag', memberQueryTags);

      if (!memberError && memberRows) {
        for (const row of memberRows) {
          const normalizedTag = normalizeTag(row.tag ?? '');
          if (normalizedTag) {
            memberTagToUuidMap.set(normalizedTag, row.id);
            memberIdToTagMap.set(row.id, normalizedTag);
          }
        }
      }
    }
    
    // Calculate historical trophies using SSOT shared function
    const historicalTrophyDataByMember = memberIdToTagMap.size > 0
      ? await calculateHistoricalTrophiesForPlayers(memberIdToTagMap)
      : new Map<string, Awaited<ReturnType<typeof calculateHistoricalTrophiesForPlayers>> extends Map<string, infer V> ? V : never>();
    
    // Fetch VIP scores for current tournament week
    const vipScoresByMemberId = new Map<string, {
      score: number;
      rank: number;
      competitive_score: number;
      support_score: number;
      development_score: number;
      trend: 'up' | 'down' | 'stable';
      last_week_score?: number;
    }>();
    
    if (memberTagToUuidMap.size > 0) {
      try {
        // Get actual UUIDs for members from memberTagToUuidMap
        const memberUuids = Array.from(memberTagToUuidMap.values()).filter(Boolean);
        
        if (memberUuids.length === 0) {
          // No members found in database, skip VIP lookup
          console.warn('[Roster API] No member UUIDs found for VIP lookup');
        } else {
          // Get the most recent week_start that has VIP data
          const { data: latestWeekRow, error: weekError } = await supabase
            .from('vip_scores')
            .select('week_start')
            .order('week_start', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (weekError) {
            console.warn('[Roster API] Error fetching latest week:', weekError);
          }
          
          if (!latestWeekRow) {
            // No VIP data at all, skip
            console.warn('[Roster API] No VIP data found');
          } else {
            const weekStartISO = latestWeekRow.week_start;
            console.log('[Roster API] Fetching VIP for week_start:', weekStartISO, 'memberUuids:', memberUuids.length);
            
            // Fetch current week VIP scores using UUIDs
            const { data: vipRows, error: vipError } = await supabase
              .from('vip_scores')
              .select('member_id, vip_score, competitive_score, support_score, development_score, week_start')
              .in('member_id', memberUuids)
              .eq('week_start', weekStartISO)
              .order('vip_score', { ascending: false });
            
            if (vipError) {
              console.warn('[Roster API] Error fetching VIP scores:', vipError);
            }
            
            console.log('[Roster API] Found VIP rows:', vipRows?.length || 0);
            
            if (!vipError && vipRows) {
              // Create rank map (1-indexed)
              let rank = 1;
              for (const row of vipRows) {
                vipScoresByMemberId.set(row.member_id, {
                  score: Number(row.vip_score),
                  rank: rank++,
                  competitive_score: Number(row.competitive_score),
                  support_score: Number(row.support_score),
                  development_score: Number(row.development_score),
                  trend: 'stable', // Will calculate trend if we have last week data
                });
              }
              
              // Fetch last week's VIP scores for trend calculation
              const lastWeekStart = new Date(weekStartISO);
              lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
              const lastWeekStartISO = lastWeekStart.toISOString().split('T')[0];
              
              const { data: lastWeekVipRows } = await supabase
                .from('vip_scores')
                .select('member_id, vip_score')
                .in('member_id', memberUuids)
                .eq('week_start', lastWeekStartISO);
              
              if (lastWeekVipRows) {
                const lastWeekScores = new Map(
                  lastWeekVipRows.map(row => [row.member_id, Number(row.vip_score)])
                );
                
                // Update trend for each member
                for (const [memberId, vipData] of vipScoresByMemberId.entries()) {
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
            }
          }
        }
      } catch (error) {
        console.warn('[Roster API] Failed to fetch VIP scores:', error);
        // Continue without VIP data - don't fail the request
      }
    }

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
          name: member.ranked_league_name,
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

    // Sort by trophies descending
    transformedMembers.sort((a, b) => (b.trophies || 0) - (a.trophies || 0));

    const snapshotDate =
      resolvedFetchedAt?.slice(0, 10)
        ?? (typeof lastUpdatedRaw === 'string' ? lastUpdatedRaw.slice(0, 10) : null);
    const payloadVersion = resolvedFetchedAt ? `canonical-${resolvedFetchedAt}` : null;
    const totalTrophies = transformedMembers.reduce((sum, m) => sum + (m.trophies || 0), 0);
    const totalDonations = transformedMembers.reduce((sum, m) => sum + (m.donations || 0), 0);

    // Get current date in UTC for comparison
    const currentDateUTC = new Date().toISOString().split('T')[0];
    const snapshotDateOnly = snapshotDate ? snapshotDate.split('T')[0] : null;
    
    return NextResponse.json({
      success: true,
      data: {
        clan: clanRow,
        members: transformedMembers,
        seasonEnd: null,
        seasonId: null,
        seasonStart: null,
        snapshot: {
          id: null,
          fetchedAt: resolvedFetchedAt,
          fetched_at: resolvedFetchedAt ?? lastUpdatedRaw,
          memberCount: transformedMembers.length,
          member_count: transformedMembers.length,
          totalTrophies,
          total_trophies: totalTrophies,
          totalDonations,
          total_donations: totalDonations,
          payloadVersion,
          payload_version: payloadVersion,
          ingestionVersion: null,
          ingestion_version: null,
          schemaVersion: null,
          schema_version: null,
          computedAt: resolvedFetchedAt,
          computed_at: resolvedFetchedAt,
          seasonId: null,
          season_id: null,
          seasonStart: null,
          season_start: null,
          seasonEnd: null,
          season_end: null,
          snapshotDate,
          snapshot_date: snapshotDate,
          metadata: {
            snapshotDate,
            snapshot_date: snapshotDate,
            fetchedAt: resolvedFetchedAt,
            computedAt: resolvedFetchedAt,
            payloadVersion,
            ingestionVersion: null,
            schemaVersion: null,
          },
        },
        // Add date comparison metadata
        dateInfo: {
          currentDate: currentDateUTC,
          snapshotDate: snapshotDateOnly,
          isStale: snapshotDateOnly ? currentDateUTC > snapshotDateOnly : false,
        },
      },
    });

  } catch (error: any) {
    console.error('[roster-canonical] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
