import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching

const querySchema = z.object({
  clanTag: z.string().optional(),
});

const SEASON_START_ISO = '2025-10-01T00:00:00Z'; // Start from beginning of October when ranked system started

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
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

    // Get the latest canonical member snapshots for this clan
    const { data: canonicalSnapshots, error: canonicalError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false })
      .limit(100); // Get recent snapshots

    if (canonicalError) {
      throw canonicalError;
    }

    if (!canonicalSnapshots || canonicalSnapshots.length === 0) {
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

    // Group snapshots by player_tag and get the latest for each
    const latestSnapshots = new Map<string, any>();
    for (const snapshot of canonicalSnapshots) {
      if (!latestSnapshots.has(snapshot.player_tag)) {
        latestSnapshots.set(snapshot.player_tag, snapshot);
      }
    }

    const members = Array.from(latestSnapshots.values()).map(snapshot => {
      const member = snapshot.payload.member;
      const ranked = member.ranked || {};
      const league = member.league || {};
      const war = member.war || {};
      const builderBase = member.builderBase || {};
      const pets = member.pets || {};
      
      return {
        id: member.tag, // Use tag as ID since we don't have member_id in canonical
        tag: snapshot.player_tag,
        name: member.name,
        th_level: member.townHallLevel,
        role: member.role,
        trophies: member.trophies,
        ranked_trophies: ranked.trophies,
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
        tenure_days: member.tenure?.days,
        tenure_as_of: member.tenure?.asOf,
        snapshot_date: snapshot.snapshot_date,
      };
    });

    // Calculate last week's trophies and running totals from member_snapshot_stats (historical data)
    let lastWeekTrophies = new Map<string, number>();
    let seasonTotalMap = new Map<string, number>();

    const memberIds = members.map(m => m.id).filter(Boolean);
    
    if (memberIds.length > 0) {
      // Get member IDs from the canonical data for historical lookup
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('id, tag')
        .in('tag', members.map(m => m.tag));

      if (!memberError && memberRows) {
        const memberIdMap = new Map<string, string>();
        for (const member of memberRows) {
          memberIdMap.set(member.tag, member.id);
        }

        const historicalMemberIds = Array.from(memberIdMap.values());

        // Fetch last week's trophy data from member_snapshot_stats
        const { data: lastWeekSnapshotRows, error: lastWeekError } = await supabase
        .from('member_snapshot_stats')
          .select('member_id, trophies, ranked_trophies, snapshot_date')
          .in('member_id', historicalMemberIds)
          .filter('snapshot_date', 'gte', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
          .filter('snapshot_date', 'lt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // But not in the last 7 days
        .order('snapshot_date', { ascending: false });

        if (!lastWeekError && lastWeekSnapshotRows) {
          for (const row of lastWeekSnapshotRows) {
            if (!lastWeekTrophies.has(row.member_id)) {
              // Use ranked_trophies if available, otherwise fall back to trophies
              const trophyValue = row.ranked_trophies ?? row.trophies ?? 0;
              lastWeekTrophies.set(row.member_id, trophyValue);
            }
          }
        }

        // Calculate running total from member_snapshot_stats (weekly finals only)
        const { data: allSeasonRows, error: allSeasonError } = await supabase
        .from('member_snapshot_stats')
          .select('member_id, trophies, ranked_trophies, snapshot_date')
          .in('member_id', historicalMemberIds)
        .gte('snapshot_date', SEASON_START_ISO)
          .order('snapshot_date', { ascending: false }); // Get most recent first

        if (!allSeasonError && allSeasonRows) {
          // Group by member and week, get one snapshot per week
          const memberWeeks = new Map<string, Map<string, number>>(); // member_id -> week -> max_trophies
          
          for (const row of allSeasonRows) {
            if (!row.snapshot_date) continue;
            const snapshotDate = new Date(row.snapshot_date);
            if (Number.isNaN(snapshotDate.valueOf())) continue;

            // Determine the start of the week (Monday) for the snapshot date
            const dayOfWeek = snapshotDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const diff = snapshotDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
            const weekStart = new Date(snapshotDate.setUTCDate(diff));
            weekStart.setUTCHours(0, 0, 0, 0);
            const weekStartISO = weekStart.toISOString().slice(0, 10);

            if (!memberWeeks.has(row.member_id)) {
              memberWeeks.set(row.member_id, new Map<string, number>());
            }
            
            // Use ranked_trophies if available, otherwise fall back to trophies
            const trophyValue = row.ranked_trophies ?? row.trophies ?? 0;
            const memberWeekMap = memberWeeks.get(row.member_id)!;
            
            // Only add if we don't already have data for this week (since we're ordered by date desc)
            if (!memberWeekMap.has(weekStartISO)) {
              memberWeekMap.set(weekStartISO, trophyValue);
            }
          }

          // Calculate running total for each member: sum of weekly finals + current week
          for (const [memberId, weekMap] of memberWeeks.entries()) {
            let runningTotal = 0;
            for (const trophies of weekMap.values()) {
              runningTotal += trophies;
            }
            
            seasonTotalMap.set(memberId, runningTotal);
          }
        }

        // Map member IDs back to player tags for the final result
        const finalLastWeekTrophies = new Map<string, number>();
        const finalSeasonTotalMap = new Map<string, number>();
        
        for (const [memberId, trophies] of lastWeekTrophies) {
          const memberTag = memberRows.find(m => m.id === memberId)?.tag;
          if (memberTag) {
            finalLastWeekTrophies.set(memberTag, trophies);
          }
        }
        
        for (const [memberId, total] of seasonTotalMap) {
          const memberTag = memberRows.find(m => m.id === memberId)?.tag;
          if (memberTag) {
            finalSeasonTotalMap.set(memberTag, total);
          }
        }
        
        lastWeekTrophies = finalLastWeekTrophies;
        seasonTotalMap = finalSeasonTotalMap;
      }
    }

    // Transform members to the expected format
    const transformedMembers = members.map(member => ({
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
      activityScore: member.activity_score || 0,
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
      tenureDays: member.tenure_days || 0,
      tenureAsOf: member.tenure_as_of,
      lastWeekTrophies: lastWeekTrophies.get(member.tag) || 0,
      seasonTotalTrophies: seasonTotalMap.get(member.tag) || 0,
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
    }));

    // Sort by trophies descending
    transformedMembers.sort((a, b) => (b.trophies || 0) - (a.trophies || 0));

    const lastUpdated = members.length > 0 ? members[0].snapshot_date : null;

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
          fetched_at: lastUpdated,
          member_count: transformedMembers.length,
          total_trophies: transformedMembers.reduce((sum, m) => sum + (m.trophies || 0), 0),
          total_donations: transformedMembers.reduce((sum, m) => sum + (m.donations || 0), 0),
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
