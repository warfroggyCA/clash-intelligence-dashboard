import { cfg } from '@/lib/config';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles, hasRole } from '@/lib/auth/roles';
import { readDepartures } from '@/lib/departures';
import { getCurrentRosterData } from '@/lib/roster-current';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag, safeTagForFilename } from '@/lib/tags';
import type { RosterData } from '@/types/roster';
import { buildDashboardMetrics, type DashboardMetrics } from './metrics';
import { buildWarSummary, type WarSummary } from './war-summary';

interface SnapshotDetails {
  currentWar: any | null;
  warLog: any[];
}

export interface ClanHealthSummary {
  warRecord: { wins: number; losses: number; ties: number; total: number } | null;
  averageStarsPerAttack: number | null;
  donationsGiven: number | null;
  donationsReceived: number | null;
  activeMembers: number;
  totalMembers: number;
}

export interface ReviewItem {
  tag: string;
  name: string;
  occurredAt: string | null;
  detail?: string;
  flags?: {
    returning?: boolean;
    warnings?: number;
    notes?: number;
    previousName?: string | null;
    nameChanged?: boolean;
  };
}

export interface LeaderReviewSummary {
  timeframeDays: number;
  joiners: ReviewItem[];
  departures: ReviewItem[];
}

export interface DashboardData {
  roster: RosterData | null;
  metrics: DashboardMetrics;
  warSummary: WarSummary;
  clanHealth: ClanHealthSummary;
  leaderReview: LeaderReviewSummary | null;
}

const EMPTY_WAR_SUMMARY: WarSummary = {
  activeWar: null,
  record: null,
  averageStarsPerAttack: null,
};

const EMPTY_METRICS = buildDashboardMetrics(null);

const EMPTY_CLAN_HEALTH: ClanHealthSummary = {
  warRecord: null,
  averageStarsPerAttack: null,
  donationsGiven: null,
  donationsReceived: null,
  activeMembers: 0,
  totalMembers: 0,
};

const toIsoDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseDepartureDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return null;
};

async function loadSnapshotDetails(clanTag: string): Promise<SnapshotDetails | null> {
  const supabase = getSupabaseServerClient();
  const safeClanTag = safeTagForFilename(clanTag);
  const { data, error } = await supabase
    .from('clan_snapshots')
    .select('current_war, war_log')
    .eq('clan_tag', safeClanTag)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    currentWar: data.current_war ?? null,
    warLog: Array.isArray(data.war_log) ? data.war_log : [],
  };
}

function buildClanHealth(metrics: DashboardMetrics, warSummary: WarSummary): ClanHealthSummary {
  return {
    warRecord: warSummary.record,
    averageStarsPerAttack: warSummary.averageStarsPerAttack,
    donationsGiven: metrics.totalDonations,
    donationsReceived: metrics.totalDonationsReceived,
    activeMembers: metrics.activeMembers,
    totalMembers: metrics.totalMembers,
  };
}

async function loadLeaderReviewSummary(clanTag: string, timeframeDays = 7): Promise<LeaderReviewSummary> {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - timeframeDays);

  const { data: joinerEvents } = await supabase
    .from('joiner_events')
    .select('*')
    .eq('clan_tag', clanTag)
    .eq('status', 'pending')
    .gte('detected_at', cutoff.toISOString())
    .order('detected_at', { ascending: false });

  const joinerTags = (joinerEvents ?? []).map((event) => event.player_tag).filter(Boolean);

  const [historyResult, notesResult, warningsResult] = joinerTags.length
    ? await Promise.all([
        supabase
          .from('player_history')
          .select('player_tag, total_tenure, status, movements, primary_name')
          .eq('clan_tag', clanTag)
          .in('player_tag', joinerTags),
        supabase
          .from('player_notes')
          .select('player_tag')
          .eq('clan_tag', clanTag)
          .in('player_tag', joinerTags),
        supabase
          .from('player_warnings')
          .select('player_tag')
          .eq('clan_tag', clanTag)
          .in('player_tag', joinerTags)
          .eq('is_active', true),
      ])
    : [
        { data: [] } as { data: any[] },
        { data: [] } as { data: any[] },
        { data: [] } as { data: any[] },
      ];

  const historyMap = new Map<string, any>();
  (historyResult.data ?? []).forEach((row) => {
    historyMap.set(row.player_tag, row);
  });

  const notesCountMap = new Map<string, number>();
  (notesResult.data ?? []).forEach((row) => {
    const tag = row.player_tag;
    notesCountMap.set(tag, (notesCountMap.get(tag) ?? 0) + 1);
  });

  const warningsCountMap = new Map<string, number>();
  (warningsResult.data ?? []).forEach((row) => {
    const tag = row.player_tag;
    warningsCountMap.set(tag, (warningsCountMap.get(tag) ?? 0) + 1);
  });

  const joiners: ReviewItem[] = (joinerEvents ?? []).map((event) => {
    const history = historyMap.get(event.player_tag);
    const hasHistory = Boolean(history?.total_tenure && history.total_tenure > 0);
    const metadata = event.metadata ?? {};
    const name =
      event.player_name ||
      metadata.playerName ||
      metadata.player_name ||
      history?.primary_name ||
      'Unknown';
    const warnings = warningsCountMap.get(event.player_tag) ?? 0;
    const notes = notesCountMap.get(event.player_tag) ?? 0;
    const previousName = metadata.previousName || history?.primary_name || null;
    const nameChanged = Boolean(metadata.hasNameChange);

    return {
      tag: event.player_tag,
      name,
      occurredAt: toIsoDate(event.detected_at),
      detail: hasHistory ? `Returning player (${history.total_tenure ?? 0} days prior)` : 'New joiner',
      flags: {
        returning: hasHistory,
        warnings,
        notes,
        previousName,
        nameChanged,
      },
    };
  });

  const departuresRaw = await readDepartures(clanTag);
  const departures: ReviewItem[] = departuresRaw
    .filter((departure) => !departure.resolved)
    .map((departure) => {
      const departureDate = parseDepartureDate(departure.departureDate);
      if (departureDate && departureDate < cutoff) {
        return null;
      }
      return {
        tag: departure.memberTag,
        name: departure.memberName || 'Unknown',
        occurredAt: departureDate ? departureDate.toISOString() : null,
        detail: departure.lastRole ? `Last role: ${departure.lastRole}` : 'Departure logged',
      };
    })
    .filter(Boolean) as ReviewItem[];

  return {
    timeframeDays,
    joiners,
    departures,
  };
}

export async function loadDashboardData(requestedClanTag?: string): Promise<DashboardData> {
  const roster = await getCurrentRosterData(requestedClanTag);
  if (!roster) {
    return {
      roster: null,
      metrics: EMPTY_METRICS,
      warSummary: EMPTY_WAR_SUMMARY,
      clanHealth: EMPTY_CLAN_HEALTH,
      leaderReview: null,
    };
  }

  const clanTag = normalizeTag(requestedClanTag ?? roster.clanTag ?? cfg.homeClanTag ?? '') || roster.clanTag;
  const snapshotDetails = clanTag ? await loadSnapshotDetails(clanTag) : null;
  const warSummary = buildWarSummary({
    currentWar: snapshotDetails?.currentWar ?? null,
    warLog: snapshotDetails?.warLog ?? [],
  });
  const metrics = buildDashboardMetrics(roster);
  const clanHealth = buildClanHealth(metrics, warSummary);

  let leaderReview: LeaderReviewSummary | null = null;
  try {
    const user = await getAuthenticatedUser();
    if (user && clanTag) {
      const roles = await getUserClanRoles(user.id);
      const canReview = hasRole(roles, clanTag, ['leader', 'coleader']);
      if (canReview) {
        leaderReview = await loadLeaderReviewSummary(clanTag, 7);
      }
    }
  } catch (error) {
    console.warn('[dashboard] Failed to load leader review summary', error);
  }

  return {
    roster,
    metrics,
    warSummary,
    clanHealth,
    leaderReview,
  };
}
