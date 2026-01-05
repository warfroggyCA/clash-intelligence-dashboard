// web-next/src/app/api/war/opponent/route.ts
// Returns a consolidated opponent profile for war planning.

export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { cached } from '@/lib/cache';
import { cfg } from '@/lib/config';
import { getDefaultCwlSeasonId } from '@/lib/cwl-season';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { isValidTag, normalizeTag } from '@/lib/tags';
import {
  getClanInfo,
  getClanMembers,
  getClanWarLog,
  getClanCurrentWar,
  getClanWarLeagueGroup,
  getCwlWar,
  getPlayer,
  extractHeroLevels,
} from '@/lib/coc';
import { HERO_MAX_LEVELS } from '@/types';

const QuerySchema = z.object({
  opponentTag: z.string().optional(),
  ourClanTag: z.string().optional(),
  autoDetect: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v == null ? true : v === 'true')),
  enrich: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    }),
  rosterSource: z.enum(['clan', 'cwl', 'auto']).optional(),
  dayIndex: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    }),
  warTag: z.string().optional(),
  seasonId: z.string().optional(),
  warSize: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    }),
  refresh: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  persist: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});

type OpponentMember = {
  tag: string;
  name: string;
  role?: string;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  th?: number | null;
  heroes?: Partial<Record<'bk' | 'aq' | 'gw' | 'rc' | 'mp', number | null>>;
  readinessScore?: number | null; // 0-100
  isMax?: boolean;
  isRushed?: boolean;
  isGhost?: boolean; // Player left the clan but still in CWL roster
};

type OpponentProfile = {
  clan: {
    tag: string;
    name?: string;
    level?: number;
    league?: { id: number; name: string } | null;
    memberCount?: number;
    warRecord?: { wins?: number; losses?: number; ties?: number; winStreak?: number };
    warFrequency?: string | null;
    publicWarLog?: boolean;
  };
  roster: OpponentMember[];
  thDistribution: Record<string, number>;
  recentForm: {
    lastWars: number;
    wlt: { w: number; l: number; t: number };
    avgStars?: number | null;
    avgDestruction?: number | null;
    teamSizes?: Record<string, number>;
  };
  briefing: { bullets: string[]; copy: string };
  limitations: {
    privateWarLog?: boolean;
    couldNotDetectOpponent?: boolean;
    partialPlayerDetails?: boolean;
    cwlRosterUnavailable?: boolean;
  };
  detectedOpponentTag?: string | null;
  warState?: string | null;
};

type CwlRosterResult = {
  roster: OpponentMember[];
  thDistribution: Record<string, number>;
  partialPlayerDetails: boolean;
  ghostCount: number;
  ghosts: Array<{ tag: string; name: string }>;
  ghostDetectionStatus: 'available' | 'unavailable' | 'error';
};

const toOptionalNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function readinessFromHeroes(th: number | null | undefined, heroes: OpponentMember['heroes']): { score: number | null; isMax: boolean; isRushed: boolean } {
  if (!th || !heroes) return { score: null, isMax: false, isRushed: false };
  const caps = HERO_MAX_LEVELS[th] || {} as any;
  const keys: Array<'bk'|'aq'|'gw'|'rc'> = ['bk','aq','gw','rc'];
  let ratioSum = 0;
  let count = 0;
  let maxed = true;
  let rushed = false;
  for (const k of keys) {
    const cap = (caps as any)[k];
    if (!cap) continue;
    const lvl = heroes[k] ?? null;
    if (lvl == null || typeof lvl !== 'number') {
      maxed = false;
      rushed = true;
      continue;
    }
    const r = Math.max(0, Math.min(1, lvl / cap));
    ratioSum += r;
    count += 1;
    if (lvl < cap) maxed = false;
    if (lvl < cap * 0.6) rushed = true;
  }
  if (count === 0) return { score: null, isMax: false, isRushed: false };
  const score = Math.round((ratioSum / count) * 100);
  return { score, isMax: maxed, isRushed: rushed };
}

function buildBriefing(profile: OpponentProfile): OpponentProfile['briefing'] {
  const bullets: string[] = [];
  const c = profile.clan;
  const form = profile.recentForm;
  const thTop = Object.entries(profile.thDistribution).sort((a,b) => Number(b[0]) - Number(a[0]))[0]?.[0];
  if (c.name) bullets.push(`${c.name} (${c.tag}) • Lv${c.level ?? '?'}`);
  if (thTop) bullets.push(`TH spread: top TH${thTop}, ${Object.values(profile.thDistribution).reduce((a,b)=>a+b,0)} members analysed`);
  bullets.push(`Recent form: ${form.wlt.w}-${form.wlt.l}-${form.wlt.t}${form.avgStars != null ? ` • ${form.avgStars.toFixed(2)}⭐ avg` : ''}${form.avgDestruction != null ? ` • ${Math.round(form.avgDestruction)}% destr` : ''}`);
  if (profile.limitations.privateWarLog) bullets.push('War log is private – limited history');
  if (profile.limitations.partialPlayerDetails) bullets.push('Details limited to top players due to rate limits');
  return { bullets, copy: bullets.join('\n') };
}

async function getOrCreateSeasonId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanTag: string,
  seasonId: string,
  warSize: number,
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from('cwl_seasons')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return existing.id as string;
  const { data: inserted, error: insertError } = await supabase
    .from('cwl_seasons')
    .insert({ clan_tag: clanTag, season_id: seasonId, war_size: warSize })
    .select('id')
    .maybeSingle();
  if (insertError) throw insertError;
  return inserted?.id as string;
}

async function buildCwlRoster(params: {
  opponentTag: string;
  ourClanTag: string | null;
  dayIndex?: number;
  warTag?: string;
  enrich?: number;
  cocOptions?: { bypassCache?: boolean };
}): Promise<CwlRosterResult | null> {
  const { opponentTag, ourClanTag, dayIndex, warTag, enrich, cocOptions } = params;
  const normalizedOpponentTag = normalizeTag(opponentTag);
  const normalizedOurTag = ourClanTag ? normalizeTag(ourClanTag) : null;
  const lookupTag = normalizedOurTag || normalizedOpponentTag;
  if (!lookupTag) return null;

  const leagueGroup = await getClanWarLeagueGroup(lookupTag, cocOptions);
  if (!leagueGroup?.rounds?.length) return null;

  const rounds = leagueGroup.rounds;
  const roundIndex =
    typeof dayIndex === 'number' && Number.isFinite(dayIndex)
      ? Math.max(1, Math.min(Math.round(dayIndex), rounds.length)) - 1
      : null;
  const candidateWarTags = warTag
    ? [normalizeTag(warTag)]
    : roundIndex != null
      ? (rounds[roundIndex]?.warTags ?? [])
      : rounds.flatMap((round) => round.warTags ?? []);

  const filteredWarTags = candidateWarTags.filter((tag) => typeof tag === 'string' && isValidTag(tag));
  if (!filteredWarTags.length) return null;

  let war: Awaited<ReturnType<typeof getCwlWar>> | null = null;
  for (const tag of filteredWarTags) {
    const candidate = await getCwlWar(tag, cocOptions).catch(() => null);
    if (!candidate?.clan?.tag || !candidate?.opponent?.tag) continue;
    const warClanTag = normalizeTag(candidate.clan.tag);
    const warOppTag = normalizeTag(candidate.opponent.tag);
    const matchesOur = normalizedOurTag ? warClanTag === normalizedOurTag || warOppTag === normalizedOurTag : true;
    const matchesOpponent = normalizedOpponentTag
      ? warClanTag === normalizedOpponentTag || warOppTag === normalizedOpponentTag
      : true;
    if (!matchesOur || !matchesOpponent) continue;
    war = candidate;
    break;
  }

  if (!war) return null;

  const warClanTag = normalizeTag(war.clan?.tag ?? '');
  const warOppTag = normalizeTag(war.opponent?.tag ?? '');
  const opponentSide = normalizedOpponentTag
    ? warClanTag === normalizedOpponentTag
      ? war.clan
      : warOppTag === normalizedOpponentTag
        ? war.opponent
        : null
    : normalizedOurTag
      ? warClanTag === normalizedOurTag
        ? war.opponent
        : warOppTag === normalizedOurTag
          ? war.clan
          : null
      : war.opponent;

  const warMembers = Array.isArray(opponentSide?.members) ? opponentSide?.members ?? [] : [];
  if (!warMembers.length) return null;

  const ENRICH_DEFAULT = 12;
  const toEnrich = Math.max(1, Math.min(enrich ?? ENRICH_DEFAULT, 50));
  const sortedByMap = [...warMembers].sort(
    (a, b) => (a.mapPosition ?? 999) - (b.mapPosition ?? 999),
  );
  const enrichTargets = sortedByMap.slice(0, Math.min(sortedByMap.length, toEnrich));

  const memberLookup = new Map<string, (typeof warMembers)[number]>();
  warMembers.forEach((member) => {
    if (member?.tag) memberLookup.set(normalizeTag(member.tag), member);
  });

  const enrichedMap = new Map<string, {
    th: number | null;
    heroes: OpponentMember['heroes'];
    readinessScore: number | null;
    isMax: boolean;
    isRushed: boolean;
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
  }>();

  for (const m of enrichTargets) {
    try {
      const p = await getPlayer(m.tag, cocOptions);
      const heroLevels = extractHeroLevels(p as any);
      const warMember = memberLookup.get(normalizeTag(m.tag));
      const warTh = toOptionalNumber(warMember?.townHallLevel ?? warMember?.townhallLevel);
      const playerTh = toOptionalNumber((p as any)?.townHallLevel);
      const th = warTh ?? playerTh ?? null;
      const readiness = readinessFromHeroes(th, heroLevels);
      enrichedMap.set(normalizeTag(m.tag), {
        th,
        heroes: heroLevels,
        readinessScore: readiness.score,
        isMax: readiness.isMax,
        isRushed: readiness.isRushed,
        trophies: (p as any)?.trophies ?? null,
        donations: (p as any)?.donations ?? null,
        donationsReceived: (p as any)?.donationsReceived ?? null,
      });
    } catch {
      // ignore individual failures
    }
  }

  // Ghost detection: compare CWL war roster against opponent's current clan members
  const opponentClanTag = normalizeTag(opponentSide?.tag ?? '');
  let currentMemberTags = new Set<string>();
  let ghostDetectionStatus: 'available' | 'unavailable' | 'error' = 'unavailable';
  
  console.log('[opponent/route] Ghost detection - opponent clan tag:', opponentClanTag);
  
  if (opponentClanTag) {
    try {
      const currentMembers = await getClanMembers(opponentClanTag, cocOptions);
      // getClanMembers returns an array directly, not { items: [...] }
      console.log('[opponent/route] Current members fetched:', currentMembers?.length || 0);
      if (currentMembers?.length) {
        for (const m of currentMembers) {
          if (m.tag) currentMemberTags.add(normalizeTag(m.tag));
        }
        ghostDetectionStatus = 'available';
        console.log('[opponent/route] Current member tags count:', currentMemberTags.size);
      }
    } catch (err: any) {
      console.warn('[opponent/route] Could not fetch current members for ghost detection:', err?.message || err);
      ghostDetectionStatus = 'error';
    }
  } else {
    console.warn('[opponent/route] No opponent clan tag available for ghost detection');
  }

  const ghosts: Array<{ tag: string; name: string }> = [];
  
  const roster: OpponentMember[] = warMembers.map((m) => {
    const normalizedTag = normalizeTag(m.tag);
    const enriched = enrichedMap.get(normalizedTag);
    const warTh = toOptionalNumber(m.townHallLevel ?? m.townhallLevel);
    const th = warTh ?? enriched?.th ?? null;
    
    // Check if this player is a ghost (in CWL but not in current clan)
    const isGhost = currentMemberTags.size > 0 && !currentMemberTags.has(normalizedTag);
    if (isGhost) {
      ghosts.push({ tag: normalizedTag, name: m.name });
      console.log('[opponent/route] GHOST DETECTED:', m.name, normalizedTag);
    }
    
    return {
      tag: normalizedTag,
      name: m.name,
      trophies: enriched?.trophies ?? undefined,
      donations: enriched?.donations ?? undefined,
      donationsReceived: enriched?.donationsReceived ?? undefined,
      th,
      heroes: enriched?.heroes,
      readinessScore: enriched?.readinessScore ?? null,
      isMax: enriched?.isMax ?? false,
      isRushed: enriched?.isRushed ?? false,
      isGhost,
    };
  });
  
  console.log('[opponent/route] Ghost detection complete. Ghosts found:', ghosts.length, ghosts.map(g => g.name).join(', ') || 'none');

  const thDistribution: Record<string, number> = {};
  for (const member of roster) {
    if (member.th) thDistribution[String(member.th)] = (thDistribution[String(member.th)] || 0) + 1;
  }

  return {
    roster,
    thDistribution,
    partialPlayerDetails: roster.length > enrichTargets.length,
    ghostCount: ghosts.length,
    ghosts,
    ghostDetectionStatus, // 'available', 'unavailable', or 'error'
  };
}

async function persistOpponentSnapshot(params: {
  clanTag: string;
  seasonId: string;
  warSize: number;
  dayIndex: number;
  opponentTag: string;
  opponentName?: string | null;
  roster: OpponentMember[];
  thDistribution: Record<string, number>;
}) {
  const supabase = getSupabaseAdminClient();
  const seasonPk = await getOrCreateSeasonId(supabase, params.clanTag, params.seasonId, params.warSize);
  await supabase
    .from('cwl_opponents')
    .upsert({
      cwl_season_id: seasonPk,
      day_index: params.dayIndex,
      opponent_tag: normalizeTag(params.opponentTag),
      opponent_name: params.opponentName ?? null,
      th_distribution: params.thDistribution,
      roster_snapshot: params.roster,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'cwl_season_id,day_index' });
}

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/war/opponent');

  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid query parameters' }, { status: 400 });
    }

    const ip = (typeof (request as any).ip === 'string' && (request as any).ip) || 'unknown';
    const key = `war:opponent:${searchParams.get('opponentTag') || 'auto'}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        },
      });
    }

    const {
      opponentTag: rawOpponentTag,
      ourClanTag: rawOurClanTag,
      autoDetect,
      enrich,
      refresh,
      rosterSource,
      dayIndex,
      warTag,
      seasonId,
      warSize,
      persist,
    } = parsed.data;
    const resolvedHomeTag = normalizeTag(cfg.homeClanTag || '');
    const ourClanTag = rawOurClanTag ? normalizeTag(rawOurClanTag) : (resolvedHomeTag || undefined);
    let opponentTag = rawOpponentTag ? normalizeTag(rawOpponentTag) : undefined;
    let detectedOpponentTag: string | null = null;
    let warState: string | null = null;
    const limitations: OpponentProfile['limitations'] = {};
    const useCache = !refresh;
    const cocOptions = refresh ? { bypassCache: true } : undefined;
    const fetchMaybeCached = async <T>(key: string[], fn: () => Promise<T>, ttlSeconds: number) =>
      useCache ? cached(key, fn, ttlSeconds) : fn();

    if (autoDetect && ourClanTag) {
      const cw = await fetchMaybeCached(
        ['coc','currentwar', ourClanTag],
        () => getClanCurrentWar(ourClanTag!, cocOptions),
        10,
      );
      const state = cw?.state?.toLowerCase?.() || null;
      const maybe = cw?.opponent?.tag ? normalizeTag(cw.opponent.tag) : undefined;
      if (maybe && (state === 'preparation' || state === 'inwar' || state === 'warended')) {
        detectedOpponentTag = maybe;
        opponentTag = opponentTag || maybe;
        warState = state;
      } else if (!opponentTag) {
        limitations.couldNotDetectOpponent = true;
      }
    }

    if (!opponentTag) {
      return json({ success: false, error: 'opponentTag required (auto-detect unavailable)' }, { status: 400 });
    }

    let roster: OpponentMember[] = [];
    let thDistribution: Record<string, number> = {};
    const rosterPreference = rosterSource ?? 'clan';

    if (rosterPreference !== 'clan') {
      const cwlRoster = await buildCwlRoster({
        opponentTag,
        ourClanTag: ourClanTag ?? null,
        dayIndex,
        warTag,
        enrich,
        cocOptions,
      });
      if (cwlRoster?.roster?.length) {
        roster = cwlRoster.roster;
        thDistribution = cwlRoster.thDistribution;
        if (cwlRoster.partialPlayerDetails) {
          limitations.partialPlayerDetails = true;
        }
      } else if (rosterPreference === 'cwl') {
        limitations.cwlRosterUnavailable = true;
      }
    }

    // Fetch clan info + roster basics
    const clanInfo = await fetchMaybeCached(
      ['coc','clan', opponentTag],
      () => getClanInfo(opponentTag!, cocOptions),
      30,
    );
    const members = roster.length
      ? []
      : await fetchMaybeCached(
          ['coc','members', opponentTag],
          () => getClanMembers(opponentTag!, cocOptions),
          30,
        );

    // War log (may be private)
    let warlog: any[] = [];
    try {
      warlog = await fetchMaybeCached(
        ['coc','warlog', opponentTag],
        () => getClanWarLog(opponentTag!, 10, cocOptions),
        60,
      );
    } catch {
      // If the helper throws, treat as private
      limitations.privateWarLog = true;
    }

    if (clanInfo && clanInfo.isWarLogPublic === false) {
      limitations.privateWarLog = true;
    }

    if (!roster.length) {
      // Enrich top-N players with hero/TH: choose by trophies desc or role priority
      const ENRICH_DEFAULT = 12;
      const toEnrich = Math.max(1, Math.min(enrich ?? ENRICH_DEFAULT, 50));
      const sorted = [...members].sort((a, b) => (b.trophies || 0) - (a.trophies || 0));
      const enrichTargets = sorted.slice(0, Math.min(sorted.length, toEnrich));

      const enrichedMap = new Map<string, { th: number | null; heroes: OpponentMember['heroes']; readinessScore: number | null; isMax: boolean; isRushed: boolean }>();
      for (const m of enrichTargets) {
        try {
          const p = await getPlayer(m.tag, cocOptions);
          const th = (p as any)?.townHallLevel ?? null;
          const heroes = extractHeroLevels(p as any);
          const readiness = readinessFromHeroes(th, heroes);
          enrichedMap.set(m.tag, { th, heroes, readinessScore: readiness.score, isMax: readiness.isMax, isRushed: readiness.isRushed });
        } catch {
          // ignore individual failures
        }
      }
      if (members.length > enrichTargets.length) {
        limitations.partialPlayerDetails = true;
      }

      roster = members.map((m) => {
        const e = enrichedMap.get(m.tag);
        return {
          tag: m.tag,
          name: m.name,
          role: m.role,
          trophies: m.trophies,
          donations: m.donations,
          donationsReceived: m.donationsReceived,
          th: e?.th ?? null,
          heroes: e?.heroes,
          readinessScore: e?.readinessScore ?? null,
          isMax: e?.isMax ?? false,
          isRushed: e?.isRushed ?? false,
        } as OpponentMember;
      });

      // TH distribution (from enriched only)
      thDistribution = {};
      for (const e of enrichedMap.values()) {
        if (e.th) thDistribution[String(e.th)] = (thDistribution[String(e.th)] || 0) + 1;
      }
    }

    // Recent form from warlog
    let w = 0, l = 0, t = 0; let starsSum = 0; let destrSum = 0; let count = 0; const teamSizes: Record<string, number> = {};
    for (const entry of warlog || []) {
      const res = (entry?.result || '').toUpperCase();
      if (res === 'WIN') w += 1; else if (res === 'LOSS') l += 1; else if (res === 'TIE' || res === 'DRAW') t += 1;
      const clanStats = entry?.clan || {};
      if (typeof clanStats.stars === 'number') { starsSum += clanStats.stars; count += 1; }
      if (typeof clanStats.destructionPercentage === 'number') { destrSum += clanStats.destructionPercentage; }
      if (typeof entry?.teamSize === 'number') { teamSizes[String(entry.teamSize)] = (teamSizes[String(entry.teamSize)] || 0) + 1; }
    }
    const recentForm = {
      lastWars: warlog?.length || 0,
      wlt: { w, l, t },
      avgStars: count > 0 ? starsSum / count : null,
      avgDestruction: count > 0 ? destrSum / count : null,
      teamSizes,
    };

    const profile: OpponentProfile = {
      clan: {
        tag: normalizeTag(clanInfo?.tag || opponentTag!),
        name: clanInfo?.name,
        level: clanInfo?.clanLevel,
        league: clanInfo?.warLeague ? { id: clanInfo.warLeague.id, name: clanInfo.warLeague.name } : null,
        memberCount: clanInfo?.memberCount,
        warRecord: { wins: clanInfo?.warWins, losses: clanInfo?.warLosses, ties: clanInfo?.warTies, winStreak: clanInfo?.warWinStreak },
        warFrequency: clanInfo?.warFrequency || null,
        publicWarLog: clanInfo?.isWarLogPublic ?? null,
      },
      roster,
      thDistribution,
      recentForm,
      limitations,
      detectedOpponentTag,
      briefing: { bullets: [], copy: '' },
      warState,
    };

    profile.briefing = buildBriefing(profile);

    if (
      persist === true &&
      typeof dayIndex === 'number' &&
      Number.isFinite(dayIndex) &&
      ourClanTag &&
      profile.roster.length
    ) {
      const resolvedSeasonId = seasonId || getDefaultCwlSeasonId();
      const resolvedWarSize = typeof warSize === 'number' && (warSize === 15 || warSize === 30) ? warSize : 15;
      try {
        await persistOpponentSnapshot({
          clanTag: ourClanTag,
          seasonId: resolvedSeasonId,
          warSize: resolvedWarSize,
          dayIndex,
          opponentTag: opponentTag || profile.clan.tag,
          opponentName: profile.clan.name,
          roster: profile.roster,
          thDistribution: profile.thDistribution,
        });
      } catch (err) {
        console.warn('[API] Failed to persist CWL opponent snapshot:', err);
      }
    }

    return json({ success: true, data: profile });
  } catch (error: any) {
    console.error('[API] Opponent profile error:', error);
    return json({ success: false, error: error?.message || 'Failed to build opponent profile' }, { status: 500 });
  }
}
