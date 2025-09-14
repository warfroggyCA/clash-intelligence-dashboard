// web-next/src/app/api/tenure/update/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { ymdNowUTC } from '@/lib/date';
import { appendTenureLedgerEntry, readLedgerEffective } from '@/lib/tenure';
import { readDepartures } from '@/lib/departures';
import { cfg } from '@/lib/config';

type Body = {
  clanTag?: string;
  memberTag?: string;
  mode?: 'grant-existing' | 'reset';
  asOf?: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const clanTag = normalizeTag(body.clanTag || cfg.homeClanTag || '');
    const memberTag = normalizeTag(body.memberTag || '');
    const mode = body.mode || 'reset';
    const asOf = body.asOf || ymdNowUTC();

    if (!isValidTag(clanTag) || !isValidTag(memberTag)) {
      return NextResponse.json({ error: 'Invalid clanTag or memberTag' }, { status: 400 });
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

    await appendTenureLedgerEntry(memberTag, base, asOf);

    return NextResponse.json({
      ok: true,
      clanTag,
      memberTag,
      mode,
      base,
      asOf,
      message: mode === 'grant-existing' ? 'Granted prior tenure starting today' : 'Reset tenure starting today'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update tenure' }, { status: 500 });
  }
}

