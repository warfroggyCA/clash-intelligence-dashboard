// web-next/src/app/api/tenure/update/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { ymdNowUTC } from '@/lib/date';
import { readLedgerEffective } from '@/lib/tenure';
import { readDepartures } from '@/lib/departures';
import { cfg } from '@/lib/config';
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';
import { applyTenureAction } from '@/lib/services/tenure-service';

type Body = {
  clanTag?: string;
  memberTag?: string;
  mode?: 'grant-existing' | 'reset';
  asOf?: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  const { json } = createApiContext(req, '/api/tenure/update');
  try {
    const Schema = z.object({
      clanTag: z.string().optional(),
      memberTag: z.string(),
      mode: z.enum(['grant-existing', 'reset']).optional(),
      asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const body = parsed.data as Body;
    const clanTag = normalizeTag(body.clanTag || cfg.homeClanTag || '');
    const memberTag = normalizeTag(body.memberTag || '');
    const mode = body.mode || 'reset';
    const asOf = body.asOf || ymdNowUTC();

    if (!isValidTag(clanTag) || !isValidTag(memberTag)) {
      return json({ success: false, error: 'Invalid clanTag or memberTag' }, { status: 400 });
    }

    let base = 0;
    if (mode === 'grant-existing') {
      // Try to determine tenure as of last departure date if available
      let effectiveDateForLookup: string | undefined = undefined;
      try {
        const departures = await readDepartures(clanTag);
        const latest = departures
          .filter(d => normalizeTag(d.memberTag) === memberTag)
          .sort((a, b) => (a.departureDate < b.departureDate ? 1 : -1))[0];
        if (latest?.departureDate) effectiveDateForLookup = latest.departureDate.slice(0, 10);
      } catch {}

      const map = await readLedgerEffective(effectiveDateForLookup);
      base = map[memberTag] || 0;
    }

    const result = await applyTenureAction({
      clanTag,
      playerTag: memberTag,
      baseDays: base,
      asOf,
      reason: mode === 'grant-existing' ? 'Resuming tenure after return' : 'Reset tenure to day 1',
      action: mode === 'grant-existing' ? 'granted' : 'revoked',
    });

    return json({
      success: true,
      data: {
        clanTag,
        memberTag,
        mode,
        base,
        asOf: result.asOf,
        tenureDays: result.tenureDays,
        message: mode === 'grant-existing' ? 'Granted prior tenure starting today' : 'Reset tenure starting today',
      },
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to update tenure' }, { status: 500 });
  }
}
