import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OurSelectionPayload {
  clanTag?: string;
  selectedTags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = (await req.json().catch(() => ({}))) as OurSelectionPayload;
    const requestedClanTag = body.clanTag ?? cfg.homeClanTag ?? '';
    const clanTag = normalizeTag(requestedClanTag);

    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'A valid clanTag must be provided (explicitly or via configuration).' },
        { status: 400 },
      );
    }

    const selectedTags = Array.isArray(body.selectedTags) ? body.selectedTags : [];
    const normalizedSelected = selectedTags
      .map((tag) => normalizeTag(tag))
      .filter((tag): tag is string => Boolean(tag));

    if (!normalizedSelected.length) {
      return NextResponse.json(
        { success: false, error: 'selectedTags array with at least one valid player tag is required.' },
        { status: 400 },
      );
    }

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('clan_tag', clanTag)
      .in('player_tag', normalizedSelected)
      .order('snapshot_date', { ascending: false })
      .limit(normalizedSelected.length * 3);

    if (snapshotError) {
      throw snapshotError;
    }

    const latestByPlayer = new Map<string, (typeof snapshotRows)[number]>();
    snapshotRows?.forEach((row) => {
      const normalized = normalizeTag(row?.player_tag ?? '');
      if (!normalized || latestByPlayer.has(normalized)) return;
      latestByPlayer.set(normalized, row);
    });

    const selection = normalizedSelected
      .map((tag) => {
        const row = latestByPlayer.get(tag);
        if (!row) {
          return null;
        }

        const payload = (row.payload as any) ?? {};
        const member = payload.member ?? {};
        const ranked = member.ranked ?? {};
        const war = member.war ?? {};
        const heroes = member.heroLevels ?? payload.heroLevels ?? {};

        return {
          tag,
          name: member.name ?? tag,
          thLevel: member.townHallLevel ?? null,
          role: member.role ?? null,
          trophies: member.trophies ?? null,
          rankedTrophies: ranked.trophies ?? null,
          warStars: war.stars ?? null,
          heroLevels: {
            bk: heroLevelValue(heroes?.bk),
            aq: heroLevelValue(heroes?.aq),
            gw: heroLevelValue(heroes?.gw),
            rc: heroLevelValue(heroes?.rc),
            mp: heroLevelValue(heroes?.mp),
          },
          activityScore: member.activityScore ?? payload.activityScore ?? null,
          readinessNotes: deriveReadiness(member, payload),
          lastUpdated: row.snapshot_date ?? null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const missing = normalizedSelected.filter((tag) => !latestByPlayer.has(tag));

    return NextResponse.json({
      success: true,
      data: {
        clanTag,
        selection,
        missing,
        analysisHints: buildSelectionSummary(selection),
      },
    });
  } catch (error) {
    console.error('[war-planning/our-selection] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process roster selection. Please try again.',
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

function deriveReadiness(member: any, payload: any): string[] {
  const notes: string[] = [];
  const war = member.war ?? {};
  if (typeof war.stars === 'number' && war.stars >= 1000) {
    notes.push('War veteran');
  }
  if ((member.activityScore ?? payload.activityScore ?? 0) >= 80) {
    notes.push('High recent activity');
  }
  if ((member.heroLevels?.bk ?? 0) >= 65 && (member.heroLevels?.aq ?? 0) >= 65) {
    notes.push('Max heroes');
  }
  return notes;
}

function buildSelectionSummary(selection: Array<{ thLevel: number | null; heroLevels: Record<string, number | null> }>) {
  if (!selection.length) {
    return {
      averageTownHall: null,
      maxTownHall: null,
      minTownHall: null,
      averageHeroLevel: null,
      notes: [],
    };
  }

  const thLevels = selection.map((player) => player.thLevel ?? 0);
  const averageTownHall = thLevels.reduce((sum, level) => sum + level, 0) / selection.length;
  const heroValues = selection.flatMap((player) => Object.values(player.heroLevels ?? {}));
  const numericHeroValues = heroValues.filter((value): value is number => typeof value === 'number');
  const averageHeroLevel =
    numericHeroValues.length > 0
      ? numericHeroValues.reduce((sum, level) => sum + level, 0) / numericHeroValues.length
      : null;

  return {
    averageTownHall,
    maxTownHall: Math.max(...thLevels),
    minTownHall: Math.min(...thLevels),
    averageHeroLevel,
    notes: selection.length >= 15 ? ['Roster ready for 15v15'] : [],
  };
}

