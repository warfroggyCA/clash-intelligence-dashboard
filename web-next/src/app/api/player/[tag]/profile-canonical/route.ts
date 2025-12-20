import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag: paramTag } = await params;
    const normalizedWithHash = normalizeTag(paramTag);
    const supabase = getSupabaseServerClient();

    // Get the latest canonical member snapshot for this player
    const { data: canonicalSnapshot, error: canonicalError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('player_tag', normalizedWithHash)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (canonicalError) {
      throw canonicalError;
    }

    if (!canonicalSnapshot) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const member = canonicalSnapshot.payload.member;
    const ranked = member.ranked || {};
    const league = member.league || {};
    const war = member.war || {};
    const builderBase = member.builderBase || {};
    const pets = member.pets || {};

    // Get clan info
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url')
      .eq('tag', canonicalSnapshot.payload.clanTag)
      .single();

    if (clanError) {
      throw clanError;
    }

    // Get historical snapshots for timeline
    const { data: historicalSnapshots, error: historicalError } = await supabase
      .from('canonical_member_snapshots')
      .select('snapshot_date, payload')
      .eq('player_tag', normalizedWithHash)
      .order('snapshot_date', { ascending: false })
      .limit(90);

    if (historicalError) {
      throw historicalError;
    }

    const timeline = historicalSnapshots?.map(snapshot => ({
      snapshotDate: snapshot.snapshot_date,
      trophies: snapshot.payload.member.trophies,
      rankedTrophies: snapshot.payload.member.ranked?.trophies,
      donations: snapshot.payload.member.donations,
      donationsReceived: snapshot.payload.member.donationsReceived,
      activityScore: snapshot.payload.member.activityScore,
      heroLevels: snapshot.payload.member.heroLevels,
      warStars: snapshot.payload.member.war?.stars,
      attackWins: snapshot.payload.member.war?.attackWins,
      defenseWins: snapshot.payload.member.war?.defenseWins,
      equipmentFlags: snapshot.payload.member.equipmentLevels,
      bestTrophies: snapshot.payload.member.bestTrophies,
      bestVersusTrophies: snapshot.payload.member.bestVersusTrophies,
      leagueName: snapshot.payload.member.league?.name,
      leagueTrophies: snapshot.payload.member.league?.trophies,
      leagueId: snapshot.payload.member.league?.id,
      rankedLeagueId: snapshot.payload.member.ranked?.leagueId,
      rankedLeagueName: snapshot.payload.member.ranked?.leagueName,
      battleModeTrophies: snapshot.payload.member.league?.trophies,
      role: snapshot.payload.member.role,
      thLevel: snapshot.payload.member.townHallLevel,
      capitalContributions: snapshot.payload.member.capitalContributions,
      petLevels: snapshot.payload.member.pets,
      builderHallLevel: snapshot.payload.member.builderBase?.hallLevel,
      versusTrophies: snapshot.payload.member.builderBase?.trophies,
      versusBattleWins: snapshot.payload.member.builderBase?.battleWins,
      builderLeagueId: snapshot.payload.member.builderBase?.league?.id,
      maxTroopCount: 0, // Not available in canonical
      maxSpellCount: 0, // Not available in canonical
      superTroopsActive: snapshot.payload.member.superTroopsActive,
      achievementCount: snapshot.payload.member.achievements?.length || 0,
      achievementScore: 0, // Not available in canonical
      expLevel: snapshot.payload.member.expLevel,
    })) || [];

    const summary = {
      tag: member.tag,
      name: member.name,
      clanTag: canonicalSnapshot.payload.clanTag,
      clanName: canonicalSnapshot.payload.clanName,
      role: member.role,
      townHallLevel: member.townHallLevel,
      trophies: member.trophies,
      rankedTrophies: ranked.trophies,
      league: {
        name: league.name,
        trophies: league.trophies,
        iconSmall: league.iconSmall,
        iconMedium: league.iconMedium,
      },
      rankedLeague: {
        id: ranked.leagueId,
        name: ranked.leagueName,
      },
      battleModeTrophies: league.trophies,
      donations: {
        given: member.donations,
        received: member.donationsReceived,
        balance: member.donations - (member.donationsReceived || 0),
      },
      war: {
        stars: war.stars,
        attackWins: war.attackWins,
        defenseWins: war.defenseWins,
      },
      activityScore: member.activityScore,
      lastSeen: null, // Not available in canonical
      tenureDays: member.tenure?.days,
      tenureAsOf: member.tenure?.asOf,
      heroLevels: member.heroLevels,
      bestTrophies: member.bestTrophies,
      bestVersusTrophies: member.bestVersusTrophies,
      capitalContributions: member.capitalContributions,
      petLevels: pets,
      builderHallLevel: builderBase.hallLevel,
      versusTrophies: builderBase.trophies,
      versusBattleWins: builderBase.battleWins,
      builderLeagueId: builderBase.league?.id,
      maxTroopCount: 0, // Not available in canonical
      maxSpellCount: 0, // Not available in canonical
      superTroopsActive: member.superTroopsActive,
      achievementCount: member.achievements?.length || 0,
      achievementScore: 0, // Not available in canonical
      expLevel: member.expLevel,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        timeline,
        clan: clanRow,
      },
    });

  } catch (error: any) {
    console.error('[player-profile-canonical] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
