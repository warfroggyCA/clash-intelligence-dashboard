import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MatchupPayload {
  ourClanTag?: string;
  opponentClanTag: string;
  ourSelected: string[];
  opponentSelected: string[];
  ourRoster?: Array<ProfileFallback>;
  opponentRoster?: Array<ProfileFallback>;
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

    const analysis = buildMatchupAnalysis(ourProfiles, opponentProfiles, ourSelected, opponentSelected);

    return NextResponse.json({
      success: true,
      data: {
        ourClanTag: ourClanTag || null,
        opponentClanTag,
        ourProfiles,
        opponentProfiles,
        analysis,
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

function buildMatchupAnalysis(
  ourProfiles: Array<{ tag: string; thLevel: number | null; rankedTrophies: number | null; heroLevels: Record<string, number | null>; warStars: number | null }>,
  opponentProfiles: Array<{ tag: string; thLevel: number | null; rankedTrophies: number | null; heroLevels: Record<string, number | null>; warStars: number | null }>,
  ourSelected: string[],
  opponentSelected: string[],
) {
  const ourMetrics = computeTeamMetrics(ourProfiles);
  const opponentMetrics = computeTeamMetrics(opponentProfiles);

  const slotBreakdown = buildSlotBreakdown(
    ourProfiles,
    opponentProfiles,
    ourSelected,
    opponentSelected,
  );

  const thDelta = ourMetrics.averageTownHall - opponentMetrics.averageTownHall;
  const heroDelta = ourMetrics.averageHeroLevel - opponentMetrics.averageHeroLevel;
  const warStarDelta = ourMetrics.averageWarStars - opponentMetrics.averageWarStars;
  const rankedDelta = ourMetrics.averageRankedTrophies - opponentMetrics.averageRankedTrophies;

  const confidenceScore = clamp(
    50 + thDelta * 5 + heroDelta * 0.5 + warStarDelta * 0.1 + rankedDelta * 0.05,
    5,
    95,
  );

  return {
    summary: {
      confidence: confidenceScore,
      outlook: confidenceScore >= 60 ? 'Favorable' : confidenceScore <= 40 ? 'Challenging' : 'Balanced',
    },
    teamComparison: {
      ourMetrics,
      opponentMetrics,
      differentials: {
        townHall: thDelta,
        heroLevels: heroDelta,
        warStars: warStarDelta,
        rankedTrophies: rankedDelta,
      },
    },
    slotBreakdown,
    recommendations: buildRecommendations(confidenceScore, ourMetrics, opponentMetrics, slotBreakdown),
  };
}

function computeTeamMetrics(profiles: Array<{ thLevel: number | null; rankedTrophies: number | null; heroLevels: Record<string, number | null>; warStars: number | null }>) {
  const count = profiles.length || 1;
  const thValues = profiles.map((profile) => profile.thLevel ?? 0);
  const warStars = profiles.map((profile) => profile.warStars ?? 0);
  const ranked = profiles.map((profile) => profile.rankedTrophies ?? 0);
  const heroValues = profiles.flatMap((profile) =>
    Object.values(profile.heroLevels ?? {}).map((value) => (typeof value === 'number' ? value : 0)),
  );

  const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

  return {
    size: profiles.length,
    averageTownHall: sum(thValues) / count,
    maxTownHall: Math.max(...thValues),
    averageWarStars: sum(warStars) / count,
    averageRankedTrophies: sum(ranked) / count,
    averageHeroLevel: heroValues.length ? sum(heroValues) / heroValues.length : 0,
  };
}

function buildSlotBreakdown(
  ourProfiles: Array<{ tag: string; thLevel: number | null; heroLevels: Record<string, number | null>; rankedTrophies: number | null; warStars: number | null }>,
  opponentProfiles: Array<{ tag: string; thLevel: number | null; heroLevels: Record<string, number | null>; rankedTrophies: number | null; warStars: number | null }>,
  ourSelected: string[],
  opponentSelected: string[],
) {
  const normalizeList = (tags: string[]) =>
    tags.map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag));

  const ourNormalized = normalizeList(ourSelected);
  const opponentNormalized = normalizeList(opponentSelected);

  const ourMap = new Map(
    ourProfiles.map((profile) => [normalizeTag(profile.tag) ?? profile.tag, profile]),
  );
  const opponentMap = new Map(
    opponentProfiles.map((profile) => [normalizeTag(profile.tag) ?? profile.tag, profile]),
  );

  const slotCount = Math.max(ourNormalized.length, opponentNormalized.length);

  return Array.from({ length: slotCount }).map((_, index) => {
    const ourTag = ourNormalized[index] ?? null;
    const opponentTag = opponentNormalized[index] ?? null;
    const ourProfile = ourTag ? ourMap.get(ourTag) : undefined;
    const opponentProfile = opponentTag ? opponentMap.get(opponentTag) : undefined;

    const thDiff = (ourProfile?.thLevel ?? 0) - (opponentProfile?.thLevel ?? 0);
    const heroDiff =
      computeAverageHeroLevel(ourProfile?.heroLevels ?? null) -
      computeAverageHeroLevel(opponentProfile?.heroLevels ?? null);
    const rankedDiff = (ourProfile?.rankedTrophies ?? 0) - (opponentProfile?.rankedTrophies ?? 0);
    const warStarDiff = (ourProfile?.warStars ?? 0) - (opponentProfile?.warStars ?? 0);

    const summary = buildSlotSummary(thDiff, heroDiff, rankedDiff, warStarDiff);

    return {
      slot: index + 1,
      ourTag,
      ourName: ourProfile?.name ?? ourTag,
      opponentTag,
      opponentName: opponentProfile?.name ?? opponentTag,
      ourTH: ourProfile?.thLevel ?? null,
      opponentTH: opponentProfile?.thLevel ?? null,
      thDiff,
      heroDiff,
      rankedDiff,
      warStarDiff,
      summary,
    };
  });
}

function buildSlotSummary(
  thDiff: number,
  heroDiff: number,
  rankedDiff: number,
  warStarDiff: number,
) {
  const parts: string[] = [];
  if (thDiff > 0) parts.push(`TH advantage ${thDiff}`);
  if (thDiff < 0) parts.push(`TH disadvantage ${Math.abs(thDiff)}`);
  if (heroDiff > 5) parts.push(`Heroes up ${heroDiff.toFixed(1)}`);
  if (heroDiff < -5) parts.push(`Heroes down ${Math.abs(heroDiff).toFixed(1)}`);
  if (rankedDiff > 100) parts.push(`Ranked +${rankedDiff}`);
  if (rankedDiff < -100) parts.push(`Ranked ${rankedDiff}`);
  if (warStarDiff > 50) parts.push(`War-star veteran +${warStarDiff}`);
  if (warStarDiff < -50) parts.push(`Behind in war stars ${warStarDiff}`);
  if (!parts.length) {
    return 'Even matchup';
  }
  return parts.join(' | ');
}

function buildRecommendations(
  confidence: number,
  ourMetrics: ReturnType<typeof computeTeamMetrics>,
  opponentMetrics: ReturnType<typeof computeTeamMetrics>,
  slotBreakdown: ReturnType<typeof buildSlotBreakdown>,
) {
  const notes: string[] = [];
  if (confidence < 45) {
    notes.push('Prioritize triple attempts on opponent weaknesses; consider safe two-star strategies on strong bases.');
  } else if (confidence > 65) {
    notes.push('Push for early high-value triples to build pressure and keep momentum.');
  } else {
    notes.push('Balanced matchup—play disciplined, adapt to first attack results.');
  }

  if (ourMetrics.averageHeroLevel < opponentMetrics.averageHeroLevel - 5) {
    notes.push('Hero disadvantage detected; consider boosting key attackers or adjusting attack plans accordingly.');
  }

  if (ourMetrics.averageTownHall > opponentMetrics.averageTownHall + 0.5) {
    notes.push('Town Hall advantage—leverage higher-tier bases to force mismatches.');
  }

  const biggestAdvantage = slotBreakdown
    .slice()
    .sort((a, b) => b.heroDiff + b.thDiff * 5 - (a.heroDiff + a.thDiff * 5))[0];
  if (biggestAdvantage && (biggestAdvantage.heroDiff > 5 || biggestAdvantage.thDiff >= 1)) {
    notes.push(
      `Exploit slot ${biggestAdvantage.slot}: strong advantage (${biggestAdvantage.summary})—schedule aggressive attack.`,
    );
  }

  const toughestMatch = slotBreakdown
    .slice()
    .sort((a, b) => (a.heroDiff + a.thDiff * 5) - (b.heroDiff + b.thDiff * 5))[0];
  if (toughestMatch && (toughestMatch.heroDiff < -5 || toughestMatch.thDiff <= -1)) {
    notes.push(
      `Support slot ${toughestMatch.slot}: disadvantage (${toughestMatch.summary})—plan backup hitter or cleanup.`,
    );
  }

  return notes;
}

function heroLevelValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function fillMissingProfiles(
  existingProfiles: ReturnType<typeof loadProfiles>,
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

function computeAverageHeroLevel(heroLevels: Record<string, number | null> | null | undefined) {
  if (!heroLevels) return 0;
  const values = Object.values(heroLevels).filter((value): value is number => typeof value === 'number');
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeHeroLevels(heroLevels: Record<string, number | null> | undefined): Record<string, number | null> {
  if (!heroLevels || typeof heroLevels !== 'object') {
    return { bk: null, aq: null, gw: null, rc: null, mp: null };
  }
  const result: Record<string, number | null> = { bk: null, aq: null, gw: null, rc: null, mp: null };
  for (const key of Object.keys(result)) {
    const value = heroLevels[key];
    result[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return result;
}
