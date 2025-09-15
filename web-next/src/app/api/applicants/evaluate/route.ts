// web-next/src/app/api/applicants/evaluate/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, Member, Roster } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getPlayer, extractHeroLevels } from '@/lib/coc';
import { getLatestSnapshot } from '@/lib/snapshots';
import { cached } from '@/lib/cache';
import { evaluateApplicant } from '@/lib/applicants';

export async function GET(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/evaluate');
  try {
    const { searchParams } = new URL(request.url);
    const Schema = z.object({ tag: z.string(), clanTag: z.string().optional() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'tag is required' }, { status: 400 });
    }
    const playerTag = normalizeTag(parsed.data.tag);
    const clanTag = parsed.data.clanTag ? normalizeTag(parsed.data.clanTag) : undefined;
    if (!isValidTag(playerTag)) {
      return json({ success: false, error: 'Provide a valid player tag like #XXXXXXX' }, { status: 400 });
    }

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `applicants:evaluate:${playerTag}:${clanTag || 'none'}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 30),
        }
      });
    }

    // Fetch player and build a Member-like object
    const cleanTag = playerTag.slice(1);
    const p = await getPlayer(cleanTag);
    const heroes = extractHeroLevels(p);
    const applicant: Member = {
      name: p.name,
      tag: playerTag,
      townHallLevel: p.townHallLevel,
      trophies: p.trophies,
      donations: p.donations,
      donationsReceived: p.donationsReceived,
      role: 'member',
      bk: typeof heroes.bk === 'number' ? heroes.bk : null,
      aq: typeof heroes.aq === 'number' ? heroes.aq : null,
      gw: typeof heroes.gw === 'number' ? heroes.gw : null,
      rc: typeof heroes.rc === 'number' ? heroes.rc : null,
      mp: typeof heroes.mp === 'number' ? heroes.mp : null,
      tenure_days: 0,
      tenure_as_of: undefined,
    } as Member;

    let rosterMembers: Member[] | undefined = undefined;
    if (clanTag && isValidTag(clanTag)) {
      try {
        const snapshot = await cached(['roster','snapshot','latest', clanTag], () => getLatestSnapshot(clanTag), 10);
        if (snapshot && Array.isArray(snapshot.members)) {
          rosterMembers = snapshot.members as any;
        }
      } catch {}
    }

    const result = evaluateApplicant(applicant, rosterMembers);
    logger.info('Evaluated applicant', { tag: playerTag, clanTag, score: result.score });
    return json({ success: true, data: { applicant, evaluation: result } satisfies { applicant: Member; evaluation: any } });
  } catch (e: any) {
    return json<ApiResponse>({ success: false, error: e?.message || 'Failed to evaluate applicant' }, { status: 500 });
  }
}

