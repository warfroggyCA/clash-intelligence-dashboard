import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HeroKey = 'bk' | 'aq' | 'gw' | 'rc' | 'mp';

interface HeroUpgradeEvent {
  hero: HeroKey;
  from: number | null;
  to: number;
}

interface PlayerActivityTimelineEvent {
  date: string | null;
  trophies: number;
  rankedTrophies: number | null;
  donations: number;
  donationsReceived: number;
  activityScore: number | null;
  trophyDelta: number;
  rankedTrophyDelta: number;
  donationsDelta: number;
  donationsReceivedDelta: number;
  summary: string;
  heroUpgrades: HeroUpgradeEvent[];
}

interface RawSnapshotRow {
  snapshot_id?: string;
  snapshot_date: string | null;
  trophies: number | null;
  ranked_trophies: number | null;
  donations: number | null;
  donations_received: number | null;
  activity_score: number | null;
  hero_levels: Record<string, unknown> | null;
  role?: string | null;
  th_level?: number | null;
  ranked_league_id?: number | null;
  ranked_league_name?: string | null;
}

interface MemberRow {
  id: string;
  tag: string;
  name: string | null;
  role: string | null;
  th_level: number | null;
  league: Record<string, unknown> | null;
  league_id: number | null;
  league_name: string | null;
  league_trophies: number | null;
  league_icon_small: string | null;
  league_icon_medium: string | null;
  builder_league: Record<string, unknown> | null;
  ranked_trophies: number | null;
  ranked_league_id: number | null;
  ranked_league_name: string | null;
  ranked_modifier: Record<string, unknown> | null;
  equipment_flags: Record<string, unknown> | null;
}

interface MemberStatsRow extends RawSnapshotRow {
  donations: number | null;
  donations_received: number | null;
  role: string | null;
  th_level: number | null;
  ranked_league_id: number | null;
  ranked_league_name: string | null;
}

const HERO_KEYS: HeroKey[] = ['bk', 'aq', 'gw', 'rc', 'mp'];

const HERO_LABELS: Record<HeroKey, string> = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceHeroLevels(raw: Record<string, unknown> | null | undefined): Record<HeroKey, number | null> {
  const result: Record<HeroKey, number | null> = {
    bk: null,
    aq: null,
    gw: null,
    rc: null,
    mp: null,
  };
  if (!raw || typeof raw !== 'object') {
    return result;
  }
  for (const key of HERO_KEYS) {
    const value = toNumber((raw as Record<string, unknown>)[key]);
    result[key] = value;
  }
  return result;
}

function buildTimelineEvents(rows: RawSnapshotRow[]): PlayerActivityTimelineEvent[] {
  if (!rows.length) return [];

  const validRows = rows.filter((row) => {
    if (!row.snapshot_date) return false;
    const timestamp = new Date(row.snapshot_date);
    return !Number.isNaN(timestamp.valueOf());
  });

  if (!validRows.length) return [];

  const latestPerDay = new Map<string, RawSnapshotRow>();
  for (const row of validRows) {
    const timestamp = new Date(row.snapshot_date!);
    const dayKey = timestamp.toISOString().slice(0, 10);
    const existing = latestPerDay.get(dayKey);
    if (!existing) {
      latestPerDay.set(dayKey, row);
      continue;
    }
    const existingTime = new Date(existing.snapshot_date!).valueOf();
    if (timestamp.valueOf() >= existingTime) {
      latestPerDay.set(dayKey, row);
    }
  }

  const dailyRows = Array.from(latestPerDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, row]) => row);

  const events: PlayerActivityTimelineEvent[] = [];
  let lastEvent: PlayerActivityTimelineEvent | null = null;
  let previous: {
    trophies: number;
    rankedTrophies: number | null;
    donations: number;
    donationsReceived: number;
    heroLevels: Record<HeroKey, number | null>;
  } | null = null;

  for (const row of dailyRows) {
    const heroLevels = coerceHeroLevels(row.hero_levels);

    const rankedPrimary = toNumber(row.ranked_trophies) ?? toNumber(row.trophies);
    const trophies = rankedPrimary ?? previous?.trophies ?? 0;
    const rankedTrophies = trophies;

    const rawDonations = toNumber(row.donations);
    const rawDonationsReceived = toNumber(row.donations_received);

    const donations = rawDonations ?? previous?.donations ?? 0;
    const donationsReceived = rawDonationsReceived ?? previous?.donationsReceived ?? 0;

    const activityScore = toNumber(row.activity_score);

    const trophyDelta = previous ? trophies - previous.trophies : 0;
    const rankedTrophyDelta = trophyDelta;
    const donationsDelta =
      rawDonations !== null && previous ? rawDonations - previous.donations : 0;
    const donationsReceivedDelta =
      rawDonationsReceived !== null && previous
        ? rawDonationsReceived - previous.donationsReceived
        : 0;

    const heroUpgrades: HeroUpgradeEvent[] = [];
    if (previous) {
      for (const key of HERO_KEYS) {
        const before = previous.heroLevels[key];
        const after = heroLevels[key];
        if (after !== null && before !== null && after > before) {
          heroUpgrades.push({ hero: key, from: before, to: after });
        }
      }
    }

    const summaryParts: string[] = [];
    if (heroUpgrades.length) {
      summaryParts.push(
        `Hero upgrades: ${heroUpgrades
          .map((upgrade) => {
            const fromLabel = upgrade.from === null ? '?' : upgrade.from;
            return `${HERO_LABELS[upgrade.hero]} ${fromLabel}→${upgrade.to}`;
          })
          .join(', ')}`
      );
    }
    if (trophyDelta) {
      summaryParts.push(`Ranked trophies ${trophyDelta > 0 ? '+' : ''}${trophyDelta}`);
    }
    if (donationsDelta) {
      summaryParts.push(`Donated ${donationsDelta > 0 ? '+' : ''}${donationsDelta}`);
    }
    if (donationsReceivedDelta) {
      summaryParts.push(`Received ${donationsReceivedDelta > 0 ? '+' : ''}${donationsReceivedDelta}`);
    }
    if (!summaryParts.length) {
      summaryParts.push('Steady progress snapshot');
    }

    const event: PlayerActivityTimelineEvent = {
      date: row.snapshot_date,
      trophies,
      rankedTrophies,
      donations,
      donationsReceived,
      activityScore: activityScore ?? null,
      trophyDelta,
      rankedTrophyDelta,
      donationsDelta,
      donationsReceivedDelta,
      summary: summaryParts.join('\n'),
      heroUpgrades,
    };

    const isSignificant =
      heroUpgrades.length > 0 ||
      trophyDelta !== 0 ||
      donationsDelta !== 0 ||
      donationsReceivedDelta !== 0;

    if (isSignificant) {
      events.push(event);
    }

    lastEvent = event;

    previous = {
      trophies,
      rankedTrophies,
      donations,
      donationsReceived,
      heroLevels,
    };
  }

  if (events.length === 0 && lastEvent) {
    events.push({
      ...lastEvent,
      summary: 'Latest snapshot — no notable changes to report.',
    });
  }

  return events.slice(-60);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const tagParam = params.tag ?? '';
    const tagWithHash = tagParam.startsWith('#') ? tagParam : `#${tagParam}`;
    const normalizedTag = normalizeTag(tagWithHash);

    const { cfg } = await import('@/lib/config');
    const clanTag = normalizeTag(cfg.homeClanTag || '');

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, name')
      .eq('tag', clanTag)
      .single();

    if (clanError || !clanRow) {
      return NextResponse.json(
        { success: false, error: 'Clan not found' },
        { status: 404 }
      );
    }

    const { data: memberRow, error: memberError } = await supabase
      .from('members')
      .select(
        `
          id,
          tag,
          name,
          role,
          th_level,
          league,
          league_id,
          league_name,
          league_trophies,
          league_icon_small,
          league_icon_medium,
          builder_league,
          ranked_trophies,
          ranked_league_id,
          ranked_league_name,
          ranked_modifier,
          equipment_flags
        `
      )
      .eq('tag', normalizedTag)
      .eq('clan_id', clanRow.id)
      .maybeSingle<MemberRow>();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!memberRow) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    if (!snapshotRows || snapshotRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No snapshot data found' },
        { status: 404 }
      );
    }

    const latestSnapshot = snapshotRows[0];

    const { data: statsRow, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('*')
      .eq('snapshot_id', latestSnapshot.id)
      .eq('member_id', memberRow.id)
      .maybeSingle<MemberStatsRow>();

    if (statsError) {
      throw new Error(statsError.message);
    }

    const { data: recentSnapshots, error: recentSnapshotsError } = await supabase
      .from('member_snapshot_stats')
      .select(
        `
          snapshot_id,
          snapshot_date,
          trophies,
          ranked_trophies,
          donations,
          donations_received,
          activity_score,
          hero_levels,
          role,
          th_level,
          ranked_league_id,
          ranked_league_name
        `
      )
      .eq('member_id', memberRow.id)
      .order('snapshot_date', { ascending: false })
      .limit(60);

    if (recentSnapshotsError) {
      throw new Error(recentSnapshotsError.message);
    }

    const timelineEvents = buildTimelineEvents(recentSnapshots ?? []);

    let lastWeekTrophies: number | null = null;
    if (recentSnapshots) {
      for (const snapshot of recentSnapshots) {
        if (!snapshot.snapshot_date) continue;
        const snapshotDate = new Date(snapshot.snapshot_date);
        if (Number.isNaN(snapshotDate.valueOf())) continue;
        if (snapshotDate.getUTCDay() === 1) {
          const mondayTrophies =
            toNumber(snapshot.ranked_trophies) ?? toNumber(snapshot.trophies);
          if (mondayTrophies !== null) {
            lastWeekTrophies = mondayTrophies;
            break;
          }
        }
      }
    }

    const primaryStats = statsRow ?? recentSnapshots?.[0] ?? null;
    const heroLevels = coerceHeroLevels(primaryStats?.hero_levels ?? null);

    const rankedPrimary =
      toNumber(primaryStats?.ranked_trophies) ??
      toNumber(memberRow.ranked_trophies) ??
      toNumber(primaryStats?.trophies) ??
      toNumber(memberRow.league_trophies);
    const trophies = rankedPrimary ?? 0;
    const rankedTrophies = rankedPrimary ?? null;
    const donations = toNumber(primaryStats?.donations);
    const donationsReceived = toNumber(primaryStats?.donations_received);

    const rankedLeagueId =
      primaryStats?.ranked_league_id ?? memberRow.ranked_league_id ?? null;
    const rankedLeagueName =
      primaryStats?.ranked_league_name ?? memberRow.ranked_league_name ?? null;

    const responseData = {
      name: memberRow.name ?? normalizedTag,
      tag: memberRow.tag,
      role: primaryStats?.role ?? memberRow.role ?? null,
      townHallLevel: primaryStats?.th_level ?? memberRow.th_level ?? null,
      trophies,
      lastWeekTrophies,
      rankedTrophies,
      donations,
      donationsReceived,
      rankedLeagueId,
      rankedLeagueName,
      rankedLeague:
        rankedLeagueId !== null || rankedLeagueName
          ? {
              id: rankedLeagueId,
              name: rankedLeagueName,
            }
          : null,
      league: memberRow.league,
      rankedModifier: memberRow.ranked_modifier ?? null,
      bk: heroLevels.bk,
      aq: heroLevels.aq,
      gw: heroLevels.gw,
      rc: heroLevels.rc,
      mp: heroLevels.mp,
      clan: clanRow ? { name: clanRow.name } : null,
      activityTimeline: timelineEvents,
    };

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load player profile';
    console.error('[api/v2/player] error', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
