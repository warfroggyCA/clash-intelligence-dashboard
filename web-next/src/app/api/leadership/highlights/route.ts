import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { requireLeadership } from '@/lib/api/role-check';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';

export const dynamic = 'force-dynamic';

const isPreviewBypass =
  process.env.NEXT_PUBLIC_LEADERSHIP_PREVIEW === 'true' ||
  process.env.NODE_ENV === 'development';

type HighlightEvent = {
  tag: string;
  name: string;
  value: string;
  occurredAt: string | null;
  detail?: string | null;
};

const HERO_LABELS: Record<string, string> = {
  bk: 'BK',
  aq: 'AQ',
  gw: 'GW',
  rc: 'RC',
  mp: 'MP',
};

function buildHeroDetail(breakdown: Record<string, number>): string | null {
  const entries = Object.entries(breakdown)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([hero, value]) => `${HERO_LABELS[hero] ?? hero.toUpperCase()} +${value}`);
  return entries.length ? entries.join(' • ') : null;
}

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/leadership/highlights');

  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag || '';
    const clanTag = normalizeTag(clanTagParam);
    const daysParam = searchParams.get('days');
    const days = daysParam ? Math.max(1, Number(daysParam)) : 7;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    if (!isPreviewBypass) {
      await requireLeadership(request, { clanTag });
    }

    const supabase = getSupabaseServerClient();
    const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase });
    if (!latestSnapshot) {
      return json({
        success: true,
        data: {
          windowStart: null,
          windowEnd: null,
          snapshotFetchedAt: null,
          snapshotDate: null,
          memberCount: 0,
          promotions: [],
          demotions: [],
          heroUpgrades: [],
          newJoiners: [],
        },
      });
    }

    const { members } = await resolveRosterMembers({
      supabase,
      clanTag: latestSnapshot.clanTag,
      snapshotId: latestSnapshot.snapshotId,
      snapshotDate: latestSnapshot.snapshotDate,
    });

    const rosterTags = members.map((member) => member.tag);
    const rosterTagSet = new Set(rosterTags);
    const tagToName = new Map(members.map((member) => [member.tag, member.name]));

    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - days);
    const windowStart = start.toISOString();
    const windowEnd = now.toISOString();
    const windowStartDate = windowStart.split('T')[0];

    if (!rosterTags.length) {
      return json({
        success: true,
        data: {
          windowStart,
          windowEnd,
          snapshotFetchedAt: latestSnapshot.fetchedAt ?? null,
          snapshotDate: latestSnapshot.snapshotDate ?? null,
          memberCount: members.length,
          promotions: [],
          demotions: [],
          heroUpgrades: [],
          newJoiners: [],
        },
      });
    }

    const [
      { data: leagueEvents },
      { data: heroRows },
      { data: joinerRows },
    ] = await Promise.all([
      supabase
        .from('player_activity_events')
        .select('player_tag, event_type, occurred_at, metadata')
        .eq('clan_tag', clanTag)
        .in('event_type', ['league_promotion', 'league_demotion'])
        .gte('occurred_at', windowStart)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('player_day')
        .select('player_tag, date, deltas, events')
        .eq('clan_tag', clanTag)
        .gte('date', windowStartDate)
        .in('player_tag', rosterTags),
      supabase
        .from('joiner_events')
        .select('player_tag, detected_at, status')
        .eq('clan_tag', clanTag)
        .gte('detected_at', windowStart)
        .order('detected_at', { ascending: false }),
    ]);

    const promotions: HighlightEvent[] = [];
    const demotions: HighlightEvent[] = [];
    (leagueEvents || []).forEach((event) => {
      const tag = normalizeTag(event.player_tag) || event.player_tag;
      if (!tag || !rosterTagSet.has(tag)) return;
      const name = tagToName.get(tag) ?? tag;
      const fromLeague = event.metadata?.from ?? null;
      const toLeague = event.metadata?.to ?? null;
      const value = fromLeague && toLeague ? `${fromLeague} → ${toLeague}` : 'League change';
      const entry: HighlightEvent = {
        tag,
        name,
        value,
        occurredAt: event.occurred_at ?? null,
      };
      if (event.event_type === 'league_demotion') {
        demotions.push(entry);
      } else {
        promotions.push(entry);
      }
    });

    const heroMap = new Map<string, { total: number; breakdown: Record<string, number>; lastDate: string | null }>();
    (heroRows || []).forEach((row) => {
      const tag = normalizeTag(row.player_tag) || row.player_tag;
      if (!tag || !rosterTagSet.has(tag)) return;
      const events = Array.isArray(row.events) ? row.events : [];
      if (!events.includes('hero_level_up')) return;

      const deltas = row.deltas && typeof row.deltas === 'object' ? row.deltas : {};
      let deltaTotal = 0;
      const breakdown: Record<string, number> = {};
      Object.entries(deltas).forEach(([key, value]) => {
        if (!key.startsWith('hero_')) return;
        const heroKey = key.replace('hero_', '');
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          deltaTotal += numeric;
          breakdown[heroKey] = (breakdown[heroKey] ?? 0) + numeric;
        }
      });

      if (deltaTotal === 0) {
        deltaTotal = 1;
      }

      const existing = heroMap.get(tag);
      if (existing) {
        existing.total += deltaTotal;
        Object.entries(breakdown).forEach(([hero, count]) => {
          existing.breakdown[hero] = (existing.breakdown[hero] ?? 0) + count;
        });
        if (row.date && (!existing.lastDate || row.date > existing.lastDate)) {
          existing.lastDate = row.date;
        }
      } else {
        heroMap.set(tag, {
          total: deltaTotal,
          breakdown,
          lastDate: row.date ?? null,
        });
      }
    });

    const heroUpgrades: HighlightEvent[] = Array.from(heroMap.entries())
      .map(([tag, data]) => ({
        tag,
        name: tagToName.get(tag) ?? tag,
        value: `+${data.total} hero levels`,
        occurredAt: data.lastDate,
        detail: buildHeroDetail(data.breakdown),
      }))
      .sort((a, b) => {
        const aValue = Number(a.value.replace('+', '').split(' ')[0]) || 0;
        const bValue = Number(b.value.replace('+', '').split(' ')[0]) || 0;
        return bValue - aValue;
      });

    const seenJoiners = new Set<string>();
    const newJoiners: HighlightEvent[] = [];
    (joinerRows || []).forEach((row) => {
      const tag = normalizeTag(row.player_tag) || row.player_tag;
      if (!tag || !rosterTagSet.has(tag) || seenJoiners.has(tag)) return;
      seenJoiners.add(tag);
      const name = tagToName.get(tag) ?? tag;
      newJoiners.push({
        tag,
        name,
        value: row.status === 'pending' ? 'Pending review' : 'Joined',
        occurredAt: row.detected_at ?? null,
      });
    });

    const capList = (items: HighlightEvent[], max = 5) => items.slice(0, max);

    return json({
      success: true,
      data: {
        windowStart,
        windowEnd,
        snapshotFetchedAt: latestSnapshot.fetchedAt ?? null,
        snapshotDate: latestSnapshot.snapshotDate ?? null,
        memberCount: members.length,
        promotions: capList(promotions),
        demotions: capList(demotions),
        heroUpgrades: capList(heroUpgrades),
        newJoiners: capList(newJoiners),
      },
    });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }

    console.error('[leadership-highlights] Error:', error);
    return json({
      success: false,
      error: error?.message || 'Failed to load leadership highlights',
    }, { status: error?.status || 500 });
  }
}
