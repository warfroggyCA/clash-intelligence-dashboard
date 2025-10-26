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

    const { data: snapshots, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false })
      .limit(120);

    if (snapshotError) {
      throw snapshotError;
    }

    if (!snapshots?.length) {
      return NextResponse.json({
        success: true,
        data: {
          clan: { tag: clanTag },
          roster: [] as LightweightAlly[],
        },
      });
    }

    const latestByPlayer = new Map<string, (typeof snapshots)[number]>();
    for (const row of snapshots) {
      const tag = normalizeTag(row.player_tag ?? '');
      if (!tag || latestByPlayer.has(tag)) continue;
      latestByPlayer.set(tag, row);
    }

    const roster: LightweightAlly[] = Array.from(latestByPlayer.entries()).map(([tag, row]) => {
      const payload = (row.payload as any) ?? {};
      const member = payload.member ?? {};
      const heroes = member.heroLevels ?? payload.heroLevels ?? {};
      const war = member.war ?? {};

      const heroLevels: Record<string, number | null> = {
        bk: heroLevelValue(heroes?.bk),
        aq: heroLevelValue(heroes?.aq),
        gw: heroLevelValue(heroes?.gw),
        rc: heroLevelValue(heroes?.rc),
        mp: heroLevelValue(heroes?.mp),
      };

      return {
        tag,
        name: member.name ?? tag,
        thLevel: member.townHallLevel ?? null,
        role: member.role ?? null,
        trophies: member.trophies ?? null,
        rankedTrophies: member.ranked?.trophies ?? null,
        warStars: war.stars ?? null,
        heroLevels,
        activityScore: member.activityScore ?? payload.activityScore ?? null,
        lastUpdated: row.snapshot_date ?? null,
      };
    });

    roster.sort((a, b) => (b.thLevel ?? 0) - (a.thLevel ?? 0));

    return NextResponse.json({
      success: true,
      data: {
        clan: { tag: clanTag },
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

