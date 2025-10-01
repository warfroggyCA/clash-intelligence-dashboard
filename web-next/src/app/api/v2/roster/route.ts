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
      .select('id, fetched_at, member_count, total_trophies, total_donations, metadata, payload_version, ingestion_version, schema_version, computed_at')
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
      .select('member_id, th_level, role, trophies, donations, donations_received, hero_levels, activity_score, rush_percent, extras, league_id, league_name, league_trophies, battle_mode_trophies, ranked_trophies, ranked_league_id, ranked_modifier, equipment_flags')
      .eq('snapshot_id', snapshot.id);

    if (statsError) {
      throw statsError;
    }

    const stats = statsRows ?? [];
    const memberIds = stats.map((row) => row.member_id).filter(Boolean) as string[];

    const { data: metricsRows, error: metricsError } = await supabase
      .from('metrics')
      .select('member_id, metric_name, value, metadata')
      .eq('clan_id', clanRow.id)
      .eq('metric_window', 'latest');

    if (metricsError) {
      throw metricsError;
    }

    const metricsByMember = new Map<string, Record<string, { value: number; metadata?: Record<string, any> | null }>>();
    for (const metric of metricsRows ?? []) {
      if (!metric?.member_id || !metric.metric_name) continue;
      const bucket = metricsByMember.get(metric.member_id) || {};
      bucket[metric.metric_name] = {
        value: typeof metric.value === 'number' ? metric.value : 0,
        metadata: metric.metadata ?? null,
      };
      metricsByMember.set(metric.member_id, bucket);
    }

    let memberLookup: Record<string, any> = {};

    if (memberIds.length) {
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('id, tag, name, th_level, role, league, builder_league, league_id, league_name, league_trophies, league_icon_small, league_icon_medium, battle_mode_trophies, ranked_trophies, ranked_league_id, ranked_league_name, ranked_modifier, season_reset_at, equipment_flags, created_at, updated_at')
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
      const leagueId = stat.league_id ?? member.league_id ?? null;
      const leagueName = stat.league_name ?? member.league_name ?? null;
      const leagueTrophies = stat.league_trophies ?? member.league_trophies ?? null;
      const battleModeTrophies = stat.battle_mode_trophies ?? member.battle_mode_trophies ?? null;
      const rankedTrophies = stat.ranked_trophies ?? member.ranked_trophies ?? null;
      const rankedLeagueId = stat.ranked_league_id ?? member.ranked_league_id ?? null;
      const rankedModifier = stat.ranked_modifier ?? member.ranked_modifier ?? null;
      const equipmentFlags = stat.equipment_flags ?? member.equipment_flags ?? null;

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
        leagueId,
        leagueName,
        leagueTrophies,
        leagueIconSmall: member.league_icon_small ?? null,
        leagueIconMedium: member.league_icon_medium ?? null,
        battleModeTrophies,
        rankedTrophies,
        rankedLeagueId,
        rankedLeagueName: member.ranked_league_name ?? null,
        rankedModifier,
        seasonResetAt: member.season_reset_at ?? null,
        equipmentFlags,
        metrics: metricsByMember.get(stat.member_id) ?? undefined,
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
          payloadVersion: snapshot.payload_version ?? null,
          ingestionVersion: snapshot.ingestion_version ?? null,
          schemaVersion: snapshot.schema_version ?? null,
          computedAt: snapshot.computed_at ?? null,
        },
        members,
      },
    });
  } catch (error: any) {
    console.error('[api/v2/roster] error', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
