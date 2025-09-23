import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const querySchema = z.object({
  clanTag: z.string().optional(),
});

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

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at, member_count, total_trophies, total_donations, metadata')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (snapshotError) {
      throw snapshotError;
    }

    const snapshot = snapshotRows?.[0] ?? null;

    if (!snapshot) {
      return NextResponse.json({
        success: true,
        data: {
          clan: clanRow,
          snapshot: null,
          members: [],
        },
      });
    }

    const { data: statsRows, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, th_level, role, trophies, donations, donations_received, hero_levels, activity_score, rush_percent, extras')
      .eq('snapshot_id', snapshot.id);

    if (statsError) {
      throw statsError;
    }

    const stats = statsRows ?? [];
    const memberIds = stats.map((row) => row.member_id).filter(Boolean) as string[];

    let memberLookup: Record<string, any> = {};

    if (memberIds.length) {
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('id, tag, name, th_level, role, league, builder_league, created_at, updated_at')
        .in('id', memberIds);

      if (memberError) {
        throw memberError;
      }

      for (const row of memberRows ?? []) {
        memberLookup[row.id] = row;
      }
    }

    const members = stats.map((stat) => {
      const member = memberLookup[stat.member_id] || {};
      return {
        id: stat.member_id,
        tag: member.tag ?? null,
        name: member.name ?? null,
        townHallLevel: stat.th_level ?? member.th_level ?? null,
        role: stat.role ?? member.role ?? null,
        trophies: stat.trophies,
        donations: stat.donations,
        donationsReceived: stat.donations_received,
        heroLevels: stat.hero_levels ?? null,
        activityScore: stat.activity_score ?? null,
        rushPercent: stat.rush_percent ?? null,
        extras: stat.extras ?? null,
        league: member.league ?? null,
        builderLeague: member.builder_league ?? null,
        memberCreatedAt: member.created_at ?? null,
        memberUpdatedAt: member.updated_at ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        clan: clanRow,
        snapshot: {
          id: snapshot.id,
          fetchedAt: snapshot.fetched_at,
          memberCount: snapshot.member_count,
          totalTrophies: snapshot.total_trophies,
          totalDonations: snapshot.total_donations,
          metadata: snapshot.metadata ?? null,
        },
        members,
      },
    });
  } catch (error: any) {
    console.error('[api/v2/roster] error', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}

