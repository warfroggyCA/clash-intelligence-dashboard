import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from '@/lib/coc';
import { getLatestSnapshot, loadSnapshot } from '@/lib/snapshots';
import { readTenureDetails } from '@/lib/tenure';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { ymdNowUTC } from '@/lib/date';
import { rateLimiter } from '@/lib/rate-limiter';
import type { Roster, Member } from '@/types';
import { sanitizeForJSON } from '@/lib/sanitize';
import { fetchRosterFromDataSpine } from '@/lib/data-spine-roster';

export async function buildRosterSnapshotFirst(clanTagRaw: string, date: 'latest' | string = 'latest'): Promise<Roster | null> {
  const clanTag = normalizeTag(clanTagRaw);
  if (!isValidTag(clanTag)) return null;

  // Fast path: use the same roster snapshot payload the API surfaces
  if (date === 'latest' || !date || date === 'snapshot') {
    try {
      const apiRoster = await fetchRosterFromDataSpine(clanTag);
      if (apiRoster) {
        return sanitizeForJSON<Roster>(apiRoster);
      }
    } catch (error) {
      console.error('[buildRosterSnapshotFirst] Failed to load roster from data spine, falling back', error);
    }
  }

  // Legacy fallback path
  let snapshot = null as any;
  if (date && date !== 'live') {
    snapshot = date === 'latest' ? await getLatestSnapshot(clanTag) : await loadSnapshot(clanTag, date);
  }
  if (snapshot) {
    const tenure = await readTenureDetails(snapshot.date);
    const members: Member[] = snapshot.members.map((m: any) => {
      const key = normalizeTag(m.tag);
      const t = tenure[key];
      return {
        ...m,
        tag: key,
        tenure_days: typeof t?.days === 'number' ? t.days : 0,
        tenure_as_of: t?.as_of ?? null,
      } as Member;
    });
    const out: Roster = {
      source: 'snapshot',
      date: snapshot.date ?? null,
      clanName: snapshot.clanName ?? null,
      clanTag,
      meta: { clanName: snapshot.clanName ?? null },
      members,
    } as any;
    return sanitizeForJSON<Roster>(out);
  }

  // Fallback to live fetch
  const [info, members] = await Promise.all([
    getClanInfo(clanTag),
    getClanMembers(clanTag)
  ]);
  if (!members?.length) return null;
  const tenureMap = await readTenureDetails();
  const enriched: Member[] = await Promise.all(members.map(async (m: any) => {
    await rateLimiter.acquire();
    try {
      const p = await getPlayer(m.tag);
      const heroes = extractHeroLevels(p);
      const key = normalizeTag(m.tag);
      const t = tenureMap[key];
      return {
        name: m.name ?? key,
        tag: key,
        townHallLevel: p.townHallLevel ?? null,
        trophies: m.trophies ?? null,
        donations: m.donations ?? null,
        donationsReceived: m.donationsReceived ?? null,
        role: m.role ?? null,
        bk: typeof heroes.bk === 'number' ? heroes.bk : null,
        aq: typeof heroes.aq === 'number' ? heroes.aq : null,
        gw: typeof heroes.gw === 'number' ? heroes.gw : null,
        rc: typeof heroes.rc === 'number' ? heroes.rc : null,
        mp: typeof heroes.mp === 'number' ? heroes.mp : null,
        tenure_days: typeof t?.days === 'number' ? t.days : 0,
        tenure_as_of: t?.as_of ?? null,
      } as Member;
    } finally {
      rateLimiter.release();
    }
  }));

  const out: Roster = {
    source: 'live',
    date: ymdNowUTC(),
    clanName: (info as any)?.name ?? null,
    clanTag,
    meta: { clanName: (info as any)?.name ?? null },
    members: enriched,
  } as any;
  return sanitizeForJSON<Roster>(out);
}
