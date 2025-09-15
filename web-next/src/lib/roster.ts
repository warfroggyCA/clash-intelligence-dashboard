import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from '@/lib/coc';
import { getLatestSnapshot, loadSnapshot } from '@/lib/snapshots';
import { readTenureDetails } from '@/lib/tenure';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { ymdNowUTC } from '@/lib/date';
import { rateLimiter } from '@/lib/rate-limiter';
import type { Roster, Member } from '@/types';

export async function buildRosterSnapshotFirst(clanTagRaw: string, date: 'latest' | string = 'latest'): Promise<Roster | null> {
  const clanTag = normalizeTag(clanTagRaw);
  if (!isValidTag(clanTag)) return null;

  // Try snapshot first
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
        tenure_days: t?.days || 0,
        tenure_as_of: t?.as_of,
      } as Member;
    });
    return {
      source: 'snapshot',
      date: snapshot.date,
      clanName: snapshot.clanName,
      clanTag,
      meta: { clanTag, clanName: snapshot.clanName },
      members,
    };
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
        name: m.name,
        tag: key,
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
        tenure_days: t?.days || 0,
        tenure_as_of: t?.as_of,
      } as Member;
    } finally {
      rateLimiter.release();
    }
  }));

  return {
    source: 'live',
    date: ymdNowUTC(),
    clanName: (info as any)?.name,
    clanTag,
    meta: { clanTag, clanName: (info as any)?.name },
    members: enriched,
  };
}

