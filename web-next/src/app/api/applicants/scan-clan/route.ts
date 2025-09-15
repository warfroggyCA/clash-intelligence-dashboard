// web-next/src/app/api/applicants/scan-clan/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, Member } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getClanMembers, getPlayer, extractHeroLevels } from '@/lib/coc';
import { getLatestSnapshot } from '@/lib/snapshots';
import { cached } from '@/lib/cache';
import { evaluateApplicant } from '@/lib/applicants';
import { rateLimiter } from '@/lib/rate-limiter';

const Query = z.object({
  sourceClanTag: z.string(), // clan to scan
  contextClanTag: z.string().optional(), // optional fit context (your clan)
  top: z.string().optional(),
  minTh: z.string().optional(),
  maxTh: z.string().optional(),
  minScore: z.string().optional(),
  minTrophies: z.string().optional(),
  includeRoles: z.string().optional(), // comma-separated: member,elder,coleader,leader
  maxRush: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/scan-clan');
  try {
    const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return json({ success: false, error: 'sourceClanTag is required' }, { status: 400 });
    const sourceClanTag = normalizeTag(parsed.data.sourceClanTag);
    const contextClanTag = parsed.data.contextClanTag ? normalizeTag(parsed.data.contextClanTag) : undefined;
    const top = Math.max(1, Math.min(50, Number(parsed.data.top || '20') || 20));
    const minTh = parsed.data.minTh ? Number(parsed.data.minTh) : undefined;
    const maxTh = parsed.data.maxTh ? Number(parsed.data.maxTh) : undefined;
    const minScore = parsed.data.minScore ? Number(parsed.data.minScore) : undefined;
    const minTrophies = parsed.data.minTrophies ? Number(parsed.data.minTrophies) : undefined;
    const includeRoles = (parsed.data.includeRoles || 'member,elder,coleader').split(',').map(s=>s.trim().toLowerCase());
    const maxRush = parsed.data.maxRush ? Number(parsed.data.maxRush) : undefined;
    if (!isValidTag(sourceClanTag)) return json({ success: false, error: 'Provide a valid sourceClanTag like #2PR8R8V8P' }, { status: 400 });

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `applicants:scan:${sourceClanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 6 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 6),
        }
      });
    }

    const members = await getClanMembers(sourceClanTag);
    if (!members?.length) return json({ success: false, error: 'No members found for source clan' }, { status: 404 });

    // Optional roster context for fit
    let rosterMembers: Member[] | undefined = undefined;
    if (contextClanTag && isValidTag(contextClanTag)) {
      try {
        const snapshot = await cached(['roster','snapshot','latest', contextClanTag], () => getLatestSnapshot(contextClanTag), 10);
        rosterMembers = snapshot?.members as any;
      } catch {}
    }

    // Evaluate each member
    const results: Array<{ applicant: Member; evaluation: any }> = [];
    for (const m of members) {
      try {
        await rateLimiter.acquire();
        const p = await getPlayer((m.tag || '').replace('#',''));
        const heroes = extractHeroLevels(p);
        const applicant: Member = {
          name: m.name,
          tag: (m.tag || '').toUpperCase(),
          townHallLevel: p.townHallLevel,
          trophies: m.trophies,
          donations: m.donations,
          donationsReceived: m.donationsReceived,
          role: m.role,
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
        // ignore individual failures
      } finally {
        rateLimiter.release();
      }
    }

    // Apply filters
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
    logger.info('Scan-clan shortlist computed', { sourceClanTag, top: shortlist.length, total: results.length, filtered: filtered.length });
    return json({ success: true, data: { shortlist, total: results.length, filtered: filtered.length } });
  } catch (e: any) {
    return json<ApiResponse>({ success: false, error: e?.message || 'Scan failed' }, { status: 500 });
  }
}
