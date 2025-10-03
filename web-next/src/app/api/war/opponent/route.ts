// web-next/src/app/api/war/opponent/route.ts
// Returns a consolidated opponent profile for war planning.

export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { cached } from '@/lib/cache';
import { normalizeTag } from '@/lib/tags';
import {
  getClanInfo,
  getClanMembers,
  getClanWarLog,
  getClanCurrentWar,
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
  limitations: { privateWarLog?: boolean; couldNotDetectOpponent?: boolean; partialPlayerDetails?: boolean };
  detectedOpponentTag?: string | null;
};

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

    const { opponentTag: rawOpponentTag, ourClanTag: rawOurClanTag, autoDetect, enrich } = parsed.data;
    const ourClanTag = rawOurClanTag ? normalizeTag(rawOurClanTag) : undefined;
    let opponentTag = rawOpponentTag ? normalizeTag(rawOpponentTag) : undefined;
    let detectedOpponentTag: string | null = null;
    const limitations: OpponentProfile['limitations'] = {};

    if (autoDetect && ourClanTag) {
      const cw = await cached(['coc','currentwar', ourClanTag], () => getClanCurrentWar(ourClanTag!), 10);
      const state = cw?.state?.toLowerCase?.() || null;
      const maybe = cw?.opponent?.tag ? normalizeTag(cw.opponent.tag) : undefined;
      if (maybe && (state === 'preparation' || state === 'inwar' || state === 'warended')) {
        detectedOpponentTag = maybe;
        opponentTag = opponentTag || maybe;
      } else if (!opponentTag) {
        limitations.couldNotDetectOpponent = true;
      }
    }

    if (!opponentTag) {
      return json({ success: false, error: 'opponentTag required (auto-detect unavailable)' }, { status: 400 });
    }

    // Fetch clan info + roster basics
    const clanInfo = await cached(['coc','clan', opponentTag], () => getClanInfo(opponentTag!), 30);
    const members = await cached(['coc','members', opponentTag], () => getClanMembers(opponentTag!), 30);

    // War log (may be private)
    let warlog: any[] = [];
    try {
      warlog = await cached(['coc','warlog', opponentTag], () => getClanWarLog(opponentTag!, 10), 60);
    } catch {
      // If the helper throws, treat as private
      limitations.privateWarLog = true;
    }

    if (clanInfo && clanInfo.isWarLogPublic === false) {
      limitations.privateWarLog = true;
    }

    // Enrich top-N players with hero/TH: choose by trophies desc or role priority
    const ENRICH_DEFAULT = 12;
    const toEnrich = Math.max(1, Math.min(enrich ?? ENRICH_DEFAULT, 50));
    const sorted = [...members].sort((a, b) => (b.trophies || 0) - (a.trophies || 0));
    const enrichTargets = sorted.slice(0, Math.min(sorted.length, toEnrich));

    const enrichedMap = new Map<string, { th: number | null; heroes: OpponentMember['heroes']; readinessScore: number | null; isMax: boolean; isRushed: boolean }>();
    for (const m of enrichTargets) {
      try {
        const p = await getPlayer(m.tag);
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

    const roster: OpponentMember[] = members.map((m) => {
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
    const thDistribution: Record<string, number> = {};
    for (const e of enrichedMap.values()) {
      if (e.th) thDistribution[String(e.th)] = (thDistribution[String(e.th)] || 0) + 1;
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
    };

    profile.briefing = buildBriefing(profile);

    return json({ success: true, data: profile });
  } catch (error: any) {
    console.error('[API] Opponent profile error:', error);
    return json({ success: false, error: error?.message || 'Failed to build opponent profile' }, { status: 500 });
  }
}

