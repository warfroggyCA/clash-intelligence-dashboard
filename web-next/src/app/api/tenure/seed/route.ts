// web-next/src/app/api/tenure/seed/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fsp } from 'fs';
import { cfg } from '@/lib/config';
import { getClanMembers } from '@/lib/coc';
import { normalizeTag, isValidTag, safeTagForFilename } from '@/lib/tags';
import { ymdNowUTC, daysSince, daysSinceToDate } from '@/lib/date';
import { readTenureDetails, appendTenureLedgerEntry } from '@/lib/tenure';

async function listSnapshotDates(clanTag: string): Promise<string[]> {
  const dir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
  const safe = safeTagForFilename(clanTag);
  try {
    const files = await fsp.readdir(dir);
    const dates = files
      .filter(f => f.startsWith(safe + '_') && f.endsWith('.json'))
      .map(f => f.substring(safe.length + 1, f.length - 5))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return dates;
  } catch {
    return [];
  }
}

async function firstSeenDateForTags(clanTag: string, tags: string[]): Promise<Record<string, string | undefined>> {
  const dir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
  const safe = safeTagForFilename(clanTag);
  const out: Record<string, string | undefined> = {};
  const needed = new Set(tags.map(normalizeTag));
  const dates = await listSnapshotDates(clanTag);
  for (const date of dates) {
    if (needed.size === 0) break;
    try {
      const p = path.join(dir, `${safe}_${date}.json`);
      const raw = await fsp.readFile(p, 'utf-8');
      const snap = JSON.parse(raw);
      const present = new Set<string>((snap.members || []).map((m: any) => normalizeTag(m.tag)));
      for (const t of Array.from(needed)) {
        if (present.has(t)) {
          out[t] = date;
          needed.delete(t);
        }
      }
    } catch {}
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.clanTag || cfg.homeClanTag || '';
    const clanTag = normalizeTag(raw);
    if (!isValidTag(clanTag)) {
      return NextResponse.json({ error: 'Invalid clanTag' }, { status: 400 });
    }

    const members = await getClanMembers(clanTag);
    const tenure = await readTenureDetails();
    const today = ymdNowUTC();

    const currentTags = members.map((m: any) => normalizeTag(m.tag));
    const missing = currentTags.filter(t => !tenure[t]);

    if (missing.length === 0) {
      return NextResponse.json({ ok: true, message: 'No missing tenure entries', seeded: 0 });
    }

    // Determine first-seen dates from snapshots
    const firstSeen = await firstSeenDateForTags(clanTag, missing);
    const clanDates = await listSnapshotDates(clanTag);
    const earliestClanDate = clanDates[0];

    let seeded = 0;
    for (const tag of missing) {
      // If we have a first-seen snapshot date, use it to compute base
      const seen = firstSeen[tag];
      let base = 0;
      if (seen) {
        base = daysSinceToDate(seen, today);
      } else if (earliestClanDate) {
        // Fall back to earliest clan snapshot date if member never seen (approximate)
        base = daysSinceToDate(earliestClanDate, today);
      } else {
        // As a last resort, set base to 1 to avoid zeros immediately
        base = 1;
      }
      await appendTenureLedgerEntry(tag, base, today);
      seeded++;
    }

    return NextResponse.json({ ok: true, clanTag, seeded, missingCount: missing.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to seed tenure' }, { status: 500 });
  }
}

