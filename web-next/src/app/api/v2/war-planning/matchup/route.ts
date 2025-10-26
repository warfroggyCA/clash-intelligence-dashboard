import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  generateWarPlanAnalysis,
  type WarPlanProfile,
} from '@/lib/war-planning/analysis';
import { enhanceWarPlanAnalysis } from '@/lib/war-planning/ai-briefing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MatchupPayload {
  ourClanTag?: string;
  opponentClanTag: string;
  ourSelected: string[];
  opponentSelected: string[];
  ourRoster?: Array<ProfileFallback>;
  opponentRoster?: Array<ProfileFallback>;
  useAI?: boolean;
}

interface ProfileFallback {
  tag: string;
  name?: string | null;
  thLevel?: number | null;
  trophies?: number | null;
  rankedTrophies?: number | null;
  warStars?: number | null;
  attackWins?: number | null;
  defenseWins?: number | null;
  heroLevels?: Record<string, number | null>;
  activityScore?: number | null;
  clanTag?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as MatchupPayload;
    const supabase = getSupabaseServerClient();

    const ourClanTag = normalizeTag(body.ourClanTag ?? '');
    const opponentClanTag = normalizeTag(body.opponentClanTag ?? '');
    const ourSelected = normalizeTags(body.ourSelected);
    const opponentSelected = normalizeTags(body.opponentSelected);
    const rawUseAI = body.useAI;
    const providedOpponentClanName =
      typeof body.opponentClanName === 'string' && body.opponentClanName.trim().length
        ? body.opponentClanName.trim()
        : null;
    let useAI = true;
    if (typeof rawUseAI === 'boolean') {
      useAI = rawUseAI;
    } else if (typeof rawUseAI === 'string') {
      useAI = !['false', '0', 'no', 'off'].includes(rawUseAI.trim().toLowerCase());
    }

    if (!opponentClanTag) {
      return NextResponse.json(
        { success: false, error: 'opponentClanTag is required.' },
        { status: 400 },
      );
    }

    if (!ourSelected.length || !opponentSelected.length) {
      return NextResponse.json(
        { success: false, error: 'Both ourSelected and opponentSelected arrays must be provided.' },
        { status: 400 },
      );
    }

    let ourProfiles = await loadProfiles(supabase, ourSelected, ourClanTag);
    let opponentProfiles = await loadProfiles(supabase, opponentSelected, opponentClanTag);

    if (ourProfiles.length < ourSelected.length && Array.isArray(body.ourRoster)) {
      ourProfiles = fillMissingProfiles(ourProfiles, ourSelected, body.ourRoster);
    }
    if (opponentProfiles.length < opponentSelected.length && Array.isArray(body.opponentRoster)) {
      opponentProfiles = fillMissingProfiles(opponentProfiles, opponentSelected, body.opponentRoster);
    }

    const analysis = await buildMatchupAnalysis(
      ourProfiles,
      opponentProfiles,
      ourSelected,
      opponentSelected,
      { ourClanTag, opponentClanTag, useAI, opponentClanName: providedOpponentClanName },
    );

    return NextResponse.json({
      success: true,
      data: {
        ourClanTag: ourClanTag || null,
        opponentClanTag,
        ourProfiles,
        opponentProfiles,
        analysis,
        useAI,
        opponentClanName: providedOpponentClanName,
      },
    });
  } catch (error) {
    console.error('[war-planning/matchup] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate matchup analysis. Please try again.',
      },
      { status: 500 },
    );
  }
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === 'string' ? normalizeTag(tag) : ''))
    .filter((tag): tag is string => Boolean(tag));
}

async function loadProfiles(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tags: string[],
  optionalClanTag?: string | null,
) {
  if (!tags.length) return [];
  const cleanTags = tags
    .map((tag) => normalizeTag(tag))
    .filter((tag): tag is string => Boolean(tag));
  if (!cleanTags.length) return [];

  const fetchRows = async (applyClanFilter: boolean) => {
    let query = supabase
      .from('canonical_member_snapshots')
      .select('player_tag, clan_tag, snapshot_date, payload')
      .in('player_tag', cleanTags)
      .order('snapshot_date', { ascending: false })
      .limit(cleanTags.length * 3);

    if (applyClanFilter && optionalClanTag) {
      query = query.eq('clan_tag', optionalClanTag);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  };

  let data = await fetchRows(Boolean(optionalClanTag));
  if ((!data || data.length === 0) && optionalClanTag) {
    data = await fetchRows(false);
  }

  const latestByPlayer = new Map<string, (typeof data)[number]>();
  data.forEach((row) => {
    const normalized = normalizeTag(row.player_tag ?? '');
    if (!normalized || latestByPlayer.has(normalized)) return;
    latestByPlayer.set(normalized, row);
  });

  return tags
    .map((tag) => {
      const row = latestByPlayer.get(tag);
      if (!row) return null;
      const payload = (row.payload as any) ?? {};
      const member = payload.member ?? {};
      const ranked = member.ranked ?? {};
      const war = member.war ?? {};
      const heroes = member.heroLevels ?? payload.heroLevels ?? {};

      return {
        tag,
        name: member.name ?? tag,
        clanTag: row.clan_tag ?? null,
        thLevel: member.townHallLevel ?? null,
        trophies: member.trophies ?? null,
        rankedTrophies: ranked.trophies ?? null,
        warStars: war.stars ?? null,
        attackWins: war.attackWins ?? null,
        defenseWins: war.defenseWins ?? null,
        heroLevels: {
          bk: heroLevelValue(heroes?.bk),
          aq: heroLevelValue(heroes?.aq),
          gw: heroLevelValue(heroes?.gw),
          rc: heroLevelValue(heroes?.rc),
          mp: heroLevelValue(heroes?.mp),
        },
        activityScore: member.activityScore ?? payload.activityScore ?? null,
        lastUpdated: row.snapshot_date ?? null,
      };
    })
    .filter((profile): profile is NonNullable<typeof profile> => profile !== null);
}

async function buildMatchupAnalysis(
  ourProfiles: Array<{
    tag: string;
    name: string;
    thLevel: number | null;
    rankedTrophies: number | null;
    heroLevels: Record<string, number | null>;
    warStars: number | null;
  }>,
  opponentProfiles: Array<{
    tag: string;
    name: string;
    thLevel: number | null;
    rankedTrophies: number | null;
    heroLevels: Record<string, number | null>;
    warStars: number | null;
  }>,
  ourSelected: string[],
  opponentSelected: string[],
  context: {
    ourClanTag?: string | null;
    opponentClanTag?: string | null;
    opponentClanName?: string | null;
    useAI: boolean;
  },
) {
  const ourWarProfiles: WarPlanProfile[] = ourProfiles.map((profile) => ({
    tag: profile.tag,
    name: profile.name,
    clanTag: context.ourClanTag ?? null,
    thLevel: profile.thLevel,
    rankedTrophies: profile.rankedTrophies,
    warStars: profile.warStars,
    heroLevels: profile.heroLevels,
  }));

  const opponentWarProfiles: WarPlanProfile[] = opponentProfiles.map((profile) => ({
    tag: profile.tag,
    name: profile.name,
    clanTag: context.opponentClanTag ?? null,
    thLevel: profile.thLevel,
    rankedTrophies: profile.rankedTrophies,
    warStars: profile.warStars,
    heroLevels: profile.heroLevels,
  }));

  const baseAnalysis = generateWarPlanAnalysis({
    ourProfiles: ourWarProfiles,
    opponentProfiles: opponentWarProfiles,
    ourSelected,
    opponentSelected,
  });

  return enhanceWarPlanAnalysis(baseAnalysis, {
    ourClanTag: context.ourClanTag,
    opponentClanTag: context.opponentClanTag,
    ourProfiles: ourWarProfiles,
    opponentProfiles: opponentWarProfiles,
  }, { enabled: context.useAI });
}

function heroLevelValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fillMissingProfiles(
  existingProfiles: Awaited<ReturnType<typeof loadProfiles>>,
  selectedTags: string[],
  fallbacks: ProfileFallback[],
) {
  const normalizedExisting = new Map(existingProfiles.map((profile) => [normalizeTag(profile.tag), profile]));
  const fallbackMap = new Map(
    fallbacks
      .map((fallback) => {
        const normalized = normalizeTag(fallback.tag ?? '');
        if (!normalized) return null;
        return [normalized, fallback] as const;
      })
      .filter((entry): entry is [string, ProfileFallback] => entry !== null),
  );

  const merged = [...existingProfiles];

  for (const tag of selectedTags) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;
    if (normalizedExisting.has(normalized)) continue;
    const fallback = fallbackMap.get(normalized);
    if (!fallback) continue;
    merged.push({
      tag: normalized,
      name: fallback.name ?? normalized,
      clanTag: fallback.clanTag ?? null,
      thLevel: fallback.thLevel ?? null,
      trophies: fallback.trophies ?? null,
      rankedTrophies: fallback.rankedTrophies ?? null,
      warStars: fallback.warStars ?? null,
      attackWins: fallback.attackWins ?? null,
      defenseWins: fallback.defenseWins ?? null,
      heroLevels: normalizeHeroLevels(fallback.heroLevels),
      activityScore: fallback.activityScore ?? null,
      lastUpdated: null,
    });
  }

  return merged;
}

function normalizeHeroLevels(heroLevels: Record<string, number | null> | undefined): { bk: number | null; aq: number | null; gw: number | null; rc: number | null; mp: number | null } {
  if (!heroLevels || typeof heroLevels !== 'object') {
    return { bk: null, aq: null, gw: null, rc: null, mp: null };
  }
  const result: { bk: number | null; aq: number | null; gw: number | null; rc: number | null; mp: number | null } = { bk: null, aq: null, gw: null, rc: null, mp: null };
  for (const key of Object.keys(result)) {
    const value = heroLevels[key];
    result[key as keyof typeof result] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return result;
}
