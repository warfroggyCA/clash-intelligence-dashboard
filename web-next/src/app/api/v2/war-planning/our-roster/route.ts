import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LightweightAlly = {
  tag: string;
  name: string;
  thLevel: number | null;
  role: string | null;
  trophies: number | null;
  rankedTrophies: number | null;
  warStars: number | null;
  heroLevels: Record<string, number | null>;
  activityScore: number | null;
  lastUpdated: string | null;
  warPreference?: "in" | "out" | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedTag = searchParams.get('clanTag') ?? cfg.homeClanTag ?? '';
    const clanTag = normalizeTag(requestedTag);

    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'A valid clanTag query parameter is required.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) {
      throw clanError;
    }

    if (!clanRow) {
      return NextResponse.json({
        success: true,
        data: {
          clan: { tag: clanTag, name: null },
          roster: [] as LightweightAlly[],
        },
      });
    }

    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      throw snapshotError;
    }

    if (!latestSnapshot) {
      return NextResponse.json({
        success: true,
        data: {
          clan: { tag: clanTag, name: clanRow.name ?? null },
          roster: [] as LightweightAlly[],
        },
      });
    }

    const { data: statsRows, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select(
        'member_id, th_level, role, trophies, ranked_trophies, battle_mode_trophies, donations, donations_received, hero_levels, activity_score, war_stars, attack_wins, defense_wins, war_preference, capital_contributions, builder_hall_level, versus_trophies, versus_battle_wins',
      )
      .eq('snapshot_id', latestSnapshot.id);

    if (statsError) {
      throw statsError;
    }

    if (!statsRows?.length) {
      return NextResponse.json({
        success: true,
        data: {
          clan: { tag: clanTag, name: clanRow.name ?? null },
          roster: [] as LightweightAlly[],
        },
      });
    }

    const memberIds = statsRows.map((row) => row.member_id).filter(Boolean);

    let memberRows: Array<{ id: string; tag: string; name: string | null }> = [];
    if (memberIds.length) {
      const { data, error: memberError } = await supabase
        .from('members')
        .select('id, tag, name')
        .in('id', memberIds);

      if (memberError) {
        throw memberError;
      }
      memberRows = data ?? [];
    }

    const memberLookup = new Map(memberRows.map((member) => [member.id, member]));

    const roster: LightweightAlly[] = statsRows.reduce<LightweightAlly[]>((acc, row) => {
      const member = memberLookup.get(row.member_id);
      if (!member) return acc;
      const tag = normalizeTag(member.tag ?? '');
      if (!tag) return acc;
      const heroLevels = normalizeHeroLevels(row.hero_levels);
      acc.push({
        tag,
        name: member.name || tag,
        thLevel: row.th_level ?? null,
        role: row.role ?? null,
        trophies: row.battle_mode_trophies ?? row.trophies ?? null,
        rankedTrophies: row.ranked_trophies ?? row.battle_mode_trophies ?? null,
        warStars: row.war_stars ?? null,
        heroLevels,
        activityScore: row.activity_score ?? null,
        lastUpdated: latestSnapshot.fetched_at ?? null,
        warPreference: row.war_preference ?? null,
      });
      return acc;
    }, []);

    roster.sort((a, b) => (b.thLevel ?? 0) - (a.thLevel ?? 0));

    return NextResponse.json({
      success: true,
      data: {
        clan: { tag: clanTag, name: clanRow.name ?? null },
        roster,
      },
    });
  } catch (error) {
    console.error('[war-planning/our-roster] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load clan roster. Please try again.',
      },
      { status: 500 },
    );
  }
}

function heroLevelValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeHeroLevels(raw: unknown): Record<string, number | null> {
  const base = { bk: null, aq: null, gw: null, rc: null, mp: null } as Record<string, number | null>;
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(base)) {
      const value = (raw as Record<string, unknown>)[key];
      base[key as keyof typeof base] = heroLevelValue(value);
    }
  }
  return base;
}
