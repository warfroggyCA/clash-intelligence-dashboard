import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getClanWarLeagueGroup, getCwlWar, getPlayer, extractHeroLevels } from '@/lib/coc';

/**
 * GET /api/cwl/our-roster
 * 
 * Returns our clan's CWL roster with ghost detection.
 * Ghost = player registered in CWL war but no longer in the clan.
 * 
 * Query params:
 * - clanTag: our clan tag (defaults to homeClanTag)
 * - dayIndex: CWL day (1-7) to check specific war
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawClanTag = searchParams.get('clanTag') || cfg.homeClanTag || '';
    const clanTag = normalizeTag(rawClanTag);
    const dayIndex = searchParams.get('dayIndex') ? Number(searchParams.get('dayIndex')) : null;

    if (!clanTag || !isValidTag(clanTag)) {
      return NextResponse.json(
        { success: false, error: 'Invalid clan tag' },
        { status: 400 }
      );
    }

    // Step 1: Get current clan roster from Supabase
    const supabase = getSupabaseAdminClient();
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) throw clanError;

    let currentRosterTags = new Set<string>();
    if (clanRow) {
      const { data: latestSnapshot } = await supabase
        .from('roster_snapshots')
        .select('id')
        .eq('clan_id', clanRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSnapshot) {
        const { data: members } = await supabase
          .from('member_snapshot_stats')
          .select('member_id')
          .eq('snapshot_id', latestSnapshot.id);

        if (members?.length) {
          const memberIds = members.map((m) => m.member_id);
          const { data: memberRows } = await supabase
            .from('members')
            .select('tag')
            .in('id', memberIds);
          
          for (const row of memberRows || []) {
            if (row.tag) currentRosterTags.add(normalizeTag(row.tag));
          }
        }
      }
    }

    // Step 2: Get CWL war roster from CoC API
    const leagueGroup = await getClanWarLeagueGroup(clanTag).catch(() => null);
    
    if (!leagueGroup?.rounds?.length) {
      // No CWL data - fall back to current roster only
      return NextResponse.json({
        success: true,
        data: {
          source: 'clan',
          message: 'No active CWL league group found. Using current clan roster.',
          roster: [],
          currentRosterCount: currentRosterTags.size,
          cwlRosterCount: 0,
          ghosts: [],
        }
      });
    }

    // Find the war for our clan on the specified day
    const rounds = leagueGroup.rounds;
    const roundIndex = dayIndex 
      ? Math.max(0, Math.min(dayIndex - 1, rounds.length - 1))
      : null;
    
    const candidateWarTags = roundIndex != null
      ? (rounds[roundIndex]?.warTags ?? [])
      : rounds.flatMap((round) => round.warTags ?? []);

    const filteredWarTags = candidateWarTags.filter(
      (tag): tag is string => typeof tag === 'string' && isValidTag(tag)
    );

    let war: Awaited<ReturnType<typeof getCwlWar>> | null = null;
    for (const tag of filteredWarTags) {
      const candidate = await getCwlWar(tag).catch(() => null);
      if (!candidate?.clan?.tag || !candidate?.opponent?.tag) continue;
      
      const warClanTag = normalizeTag(candidate.clan.tag);
      const warOppTag = normalizeTag(candidate.opponent.tag);
      
      if (warClanTag === clanTag || warOppTag === clanTag) {
        war = candidate;
        break;
      }
    }

    if (!war) {
      return NextResponse.json({
        success: true,
        data: {
          source: 'clan',
          message: 'No CWL war found for the specified day. Using current clan roster.',
          roster: [],
          currentRosterCount: currentRosterTags.size,
          cwlRosterCount: 0,
          ghosts: [],
        }
      });
    }

    // Get our side of the war
    const warClanTag = normalizeTag(war.clan?.tag ?? '');
    const ourSide = warClanTag === clanTag ? war.clan : war.opponent;
    const cwlMembers = Array.isArray(ourSide?.members) ? ourSide.members : [];

    // Step 3: Build roster with ghost detection
    interface CwlRosterMember {
      tag: string;
      name: string;
      townHall: number | null;
      mapPosition: number | null;
      heroPower: number | null;
      heroes: Record<string, number | null> | null;
      isGhost: boolean;
      inCurrentRoster: boolean;
    }

    const roster: CwlRosterMember[] = [];
    const ghosts: Array<{ tag: string; name: string; townHall: number | null }> = [];

    for (const member of cwlMembers) {
      const normalizedTag = normalizeTag(member.tag);
      const inCurrentRoster = currentRosterTags.has(normalizedTag);
      const isGhost = !inCurrentRoster;
      
      // Try to get hero info
      let heroLevels: Record<string, number | null> | null = null;
      let heroPower: number | null = null;
      
      try {
        const player = await getPlayer(member.tag);
        heroLevels = extractHeroLevels(player as any);
        heroPower = Object.values(heroLevels || {})
          .filter((v): v is number => typeof v === 'number')
          .reduce((sum, v) => sum + v, 0);
      } catch {
        // Failed to fetch player details - use war data only
      }

      const th = member.townHallLevel ?? member.townhallLevel ?? null;

      const rosterMember: CwlRosterMember = {
        tag: normalizedTag,
        name: member.name || normalizedTag,
        townHall: th,
        mapPosition: member.mapPosition ?? null,
        heroPower,
        heroes: heroLevels,
        isGhost,
        inCurrentRoster,
      };

      roster.push(rosterMember);
      
      if (isGhost) {
        ghosts.push({
          tag: normalizedTag,
          name: member.name || normalizedTag,
          townHall: th,
        });
      }
    }

    // Sort by map position
    roster.sort((a, b) => (a.mapPosition ?? 999) - (b.mapPosition ?? 999));

    return NextResponse.json({
      success: true,
      data: {
        source: 'cwl',
        message: ghosts.length 
          ? `Found ${ghosts.length} ghost(s) - players in CWL but no longer in clan.`
          : 'All CWL members are still in the clan.',
        roster,
        currentRosterCount: currentRosterTags.size,
        cwlRosterCount: roster.length,
        ghosts,
        warState: war.state,
        warStartTime: (war as any).startTime ?? null,
      }
    });

  } catch (error: any) {
    console.error('[/api/cwl/our-roster] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load CWL roster' },
      { status: 500 }
    );
  }
}

