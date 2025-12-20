// web-next/src/app/api/applicants/shortlist/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, Member } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getPlayer, extractHeroLevels } from '@/lib/coc';
import { getLatestSnapshot } from '@/lib/snapshots';
import { cached } from '@/lib/cache';
import { evaluateApplicant } from '@/lib/applicants';

const BodySchema = z.object({
  clanTag: z.string().optional(),
  tags: z.array(z.string()).min(1),
  top: z.number().int().positive().max(200).optional(),
  minTh: z.number().int().optional(),
  maxTh: z.number().int().optional(),
  minScore: z.number().int().optional(),
  minTrophies: z.number().int().optional(),
  includeRoles: z.array(z.string()).optional(), // lowercase role names
  maxRush: z.number().int().optional(), // rush % must be < maxRush
});

export async function POST(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/shortlist');
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const clanTag = parsed.data.clanTag ? normalizeTag(parsed.data.clanTag) : undefined;
    const tags = parsed.data.tags.map(normalizeTag).filter(isValidTag);
    const top = parsed.data.top ?? 20;
    const { minTh, maxTh, minScore, minTrophies, maxRush } = parsed.data;
    const includeRoles = (parsed.data.includeRoles || ['member','elder','coleader']).map(s=>s.toLowerCase());
    if (!tags.length) return json({ success: false, error: 'No valid tags to evaluate' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await rateLimitAllow(`applicants:shortlist:${ip}`, { windowMs: 60_000, max: 10 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 10) },
      });
    }

    // Optional roster context for clan fit
    let rosterMembers: Member[] | undefined = undefined;
    if (clanTag && isValidTag(clanTag)) {
      try {
        const snapshot = await cached(['roster','snapshot','latest', clanTag], () => getLatestSnapshot(clanTag), 10);
        rosterMembers = snapshot?.members as any;
      } catch {}
    }

    // Evaluate candidates sequentially with existing CoC rate limiter at lib level
    const results: Array<{ applicant: Member; evaluation: any }> = [];
    for (const t of tags) {
      try {
        const p = await getPlayer(t.slice(1));
        const heroes = extractHeroLevels(p);
        const applicant: Member = {
          name: p.name,
          tag: t,
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
        const evaluation = evaluateApplicant(applicant, rosterMembers);
        results.push({ applicant, evaluation });
      } catch (e) {
        // Skip failing tag, continue
      }
    }

    const { computeRushPercent } = await import('@/lib/applicants');
    const filtered = results.filter(r => {
      const th = r.applicant.townHallLevel || 0;
      const role = String(r.applicant.role || '').toLowerCase();
      const troph = r.applicant.trophies || 0;
      const rush = computeRushPercent(r.applicant);
      if (minTh !== undefined && th < minTh) return false;
      if (maxTh !== undefined && th > maxTh) return false;
      if (minScore !== undefined && r.evaluation.score < minScore) return false;
      if (minTrophies !== undefined && troph < minTrophies) return false;
      if (includeRoles.length && !includeRoles.includes(role)) return false;
      if (maxRush !== undefined && rush >= maxRush) return false;
      return true;
    });
    filtered.sort((a, b) => b.evaluation.score - a.evaluation.score);
    const shortlist = filtered.slice(0, top);
    logger.info('Shortlist computed', { count: shortlist.length, requested: tags.length });
    return json({ success: true, data: { shortlist } });
  } catch (e: any) {
    return json<ApiResponse>({ success: false, error: e?.message || 'Failed to build shortlist' }, { status: 500 });
  }
}
