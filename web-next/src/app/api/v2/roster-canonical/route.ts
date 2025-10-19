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

const SEASON_START_ISO = '2025-10-01T00:00:00Z';

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
        donations: member.donations?.given || member.donations || 0,
        donations_received: member.donations?.received || member.donationsReceived || 0,
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

    // Calculate last week's trophies and running totals from historical snapshots
    let lastWeekTrophies = new Map<string, number>();
    let seasonTotalMap = new Map<string, number>();

    if (canonicalSnapshots.length > 0) {
      // Get historical snapshots for calculations
      const { data: historicalSnapshots, error: historicalError } = await supabase
        .from('canonical_member_snapshots')
        .select('player_tag, snapshot_date, payload')
        .eq('clan_tag', clanTag)
        .gte('snapshot_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) // Last 30 days
        .order('snapshot_date', { ascending: false });

      if (!historicalError && historicalSnapshots) {
        // Group by player_tag
        const playerSnapshots = new Map<string, any[]>();
        for (const snapshot of historicalSnapshots) {
          if (!playerSnapshots.has(snapshot.player_tag)) {
            playerSnapshots.set(snapshot.player_tag, []);
          }
          playerSnapshots.get(snapshot.player_tag)!.push(snapshot);
        }

        // Calculate last week and season totals for each player
        for (const [playerTag, snapshots] of playerSnapshots) {
          // Last week: find snapshot from 7-14 days ago
          const lastWeekSnapshot = snapshots.find(s => {
            const snapshotDate = new Date(s.snapshot_date);
            const daysAgo = (Date.now() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo >= 7 && daysAgo <= 14;
          });
          if (lastWeekSnapshot) {
            lastWeekTrophies.set(playerTag, lastWeekSnapshot.payload.member.trophies || 0);
          }

          // Season total: sum all weekly finals since season start
          let seasonTotal = 0;
          const seenWeeks = new Set<string>();
          for (const snapshot of snapshots) {
            if (new Date(snapshot.snapshot_date) >= new Date(SEASON_START_ISO)) {
              const weekStart = new Date(snapshot.snapshot_date);
              weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() + 1);
              const weekKey = weekStart.toISOString().slice(0, 10);
              
              if (!seenWeeks.has(weekKey)) {
                seenWeeks.add(weekKey);
                seasonTotal += snapshot.payload.member.trophies || 0;
              }
            }
          }
          seasonTotalMap.set(playerTag, seasonTotal);
        }
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
