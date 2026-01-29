import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles, hasRole } from '@/lib/auth/roles';
import type {
  PlayerTimelinePoint,
  PlayerSummarySupabase,
  SupabasePlayerProfilePayload,
  PlayerLeadershipBundle,
  PlayerEvaluationRecord,
  PlayerJoinerEventRecord,
  PlayerHistoryRecordSupabase,
} from '@/types/player-profile-supabase';

export const dynamic = 'force-dynamic';

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function readDonationsGiven(value: any): number | null {
  // CanonicalMemberRecord.donations = { given, received }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const candidate = (value as any).given;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function readDonationsReceived(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const candidate = (value as any).received;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const { tag: paramTag } = await params;
    const normalizedTag = normalizeTag(paramTag) || decodeURIComponent(paramTag);

    const url = new URL(req.url);
    const clanTagParam = normalizeTag(url.searchParams.get('clanTag') || '') || null;

    const supabase = getSupabaseServerClient();

    // Find latest canonical snapshot for this player (optionally within requested clan)
    let canonicalQuery = supabase
      .from('canonical_member_snapshots')
      .select('clan_tag, snapshot_date, payload')
      .eq('player_tag', normalizedTag)
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (clanTagParam) {
      canonicalQuery = canonicalQuery.eq('clan_tag', clanTagParam);
    }

    const { data: canonicalSnapshot, error: canonicalError } = await canonicalQuery.maybeSingle();

    if (canonicalError) {
      throw canonicalError;
    }

    if (!canonicalSnapshot) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const resolvedClanTag = normalizeTag((canonicalSnapshot as any).clan_tag) || (canonicalSnapshot as any).clan_tag;
    const member = (canonicalSnapshot as any).payload?.member ?? null;
    if (!member) {
      return NextResponse.json({ success: false, error: 'Malformed snapshot payload' }, { status: 500 });
    }

    // Timeline from canonical snapshots (last 90)
    const { data: historicalSnapshots, error: historicalError } = await supabase
      .from('canonical_member_snapshots')
      .select('snapshot_date, payload')
      .eq('player_tag', normalizedTag)
      .eq('clan_tag', resolvedClanTag)
      .order('snapshot_date', { ascending: false })
      .limit(90);

    if (historicalError) {
      throw historicalError;
    }

    const timeline: PlayerTimelinePoint[] = (historicalSnapshots ?? [])
      .map((row: any) => {
        const m = row.payload?.member ?? {};
        const donationsGiven = readDonationsGiven(m.donations);
        const donationsReceived = readDonationsReceived(m.donations);

        return {
          snapshotDate: row.snapshot_date ?? null,
          trophies: m.trophies ?? null,
          rankedTrophies: m.ranked?.trophies ?? null,
          donations: donationsGiven,
          donationsReceived: donationsReceived,
          activityScore: m.activityScore ?? null,
          heroLevels: m.heroLevels ?? null,
          warStars: m.war?.stars ?? null,
          attackWins: m.war?.attackWins ?? null,
          defenseWins: m.war?.defenseWins ?? null,
          capitalContributions: m.capitalContributions ?? null,
          builderHallLevel: m.builderBase?.hallLevel ?? null,
          builderTrophies: m.builderBase?.trophies ?? null,
          builderBattleWins: m.builderBase?.battleWins ?? null,
          bestTrophies: m.bestTrophies ?? null,
          bestVersusTrophies: m.bestVersusTrophies ?? null,
          leagueName: m.league?.name ?? null,
          leagueTrophies: m.league?.trophies ?? null,
          leagueId: m.league?.id ?? null,
          rankedLeagueId: m.ranked?.leagueId ?? null,
          rankedLeagueName: m.ranked?.leagueName ?? null,
          superTroopsActive: m.superTroopsActive ?? null,
          petLevels: m.pets ?? null,
          equipmentLevels: m.equipmentLevels ?? null,
          achievementCount: m.achievements?.count ?? null,
          achievementScore: m.achievements?.score ?? null,
          expLevel: m.expLevel ?? null,
          rushPercent: m.rushPercent ?? null,
          events: null,
          notability: null,
          deltas: null,
        };
      })
      .reverse();

    const lastKnown = <T extends number | null | undefined>(values: Array<T>): number | null => {
      for (let i = values.length - 1; i >= 0; i--) {
        const v: any = values[i];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
      }
      return null;
    };

    const timelineLatestTrophies = lastKnown(timeline.map((p) => p.trophies));
    const timelineLatestRankedTrophies = lastKnown(timeline.map((p) => p.rankedTrophies));
    const timelineLatestDonationsGiven = lastKnown(timeline.map((p) => p.donations));
    const timelineLatestDonationsReceived = lastKnown(timeline.map((p) => p.donationsReceived));

    // Donations are an object in canonical snapshots
    const donationsGiven = readDonationsGiven(member.donations);
    const donationsReceived = readDonationsReceived(member.donations);

    // IN-GAME TROPHY LOGIC: Prefer ranked (village) trophies
    // NOTE: In our canonical snapshot schema, member.trophies is the *ranked (home village)* trophies.
    // Older/other endpoints also call this "resolvedTrophies".
    const resolvedTrophies = (typeof member.trophies === 'number' && member.trophies > 0 ? member.trophies : null) ?? timelineLatestTrophies;
    const rankedTrophiesValue = resolvedTrophies;
    const officialTrophies = resolvedTrophies;

    // Last seen: Find most recent date from any timeline or snapshot
    const lastSnapshotDate = (historicalSnapshots ?? [])[0]?.snapshot_date ?? null;

    const summary: PlayerSummarySupabase = {
      name: member.name ?? null,
      tag: member.tag ?? normalizedTag,
      clanName: (canonicalSnapshot as any).payload?.clanName ?? null,
      clanTag: resolvedClanTag,
      role: member.role ?? null,
      townHallLevel: member.townHallLevel ?? null,
      trophies: officialTrophies,
      rankedTrophies: rankedTrophiesValue,
      resolvedTrophies: resolvedTrophies, // Added field for "in-game" consistency
      seasonTotalTrophies: null,
      lastWeekTrophies: null,
      rushPercent: member.rushPercent ?? null,
      league: {
        id: member.league?.id ?? null,
        name: member.league?.name ?? null,
        trophies: member.league?.trophies ?? null,
        iconSmall: member.league?.iconSmall ?? null,
        iconMedium: member.league?.iconMedium ?? null,
      },
      rankedLeague: {
        id: member.ranked?.leagueId ?? null,
        name: member.ranked?.leagueName ?? null,
        trophies: member.ranked?.trophies ?? null,
        iconSmall: member.ranked?.iconSmall ?? null,
        iconMedium: member.ranked?.iconMedium ?? null,
      },
      battleModeTrophies: member.battleModeTrophies ?? null,
      donations: {
        given: donationsGiven ?? timelineLatestDonationsGiven,
        received: donationsReceived ?? timelineLatestDonationsReceived,
        balance:
          typeof donationsGiven === 'number' && typeof donationsReceived === 'number'
            ? donationsGiven - donationsReceived
            : null,
      },
      war: {
        stars: member.war?.stars ?? null,
        attackWins: member.war?.attackWins ?? null,
        defenseWins: member.war?.defenseWins ?? null,
        preference: member.war?.preference ?? null,
      },
      builderBase: {
        hallLevel: member.builderBase?.hallLevel ?? null,
        trophies: member.builderBase?.trophies ?? null,
        battleWins: member.builderBase?.battleWins ?? null,
        leagueId: member.builderBase?.leagueId ?? null,
        leagueName: member.builderBase?.leagueName ?? null,
      },
      capitalContributions: member.capitalContributions ?? null,
      activityScore: member.activityScore ?? null,
      activity: null,
      lastSeen: lastSnapshotDate, // Smarter fallback for header date
      tenureDays: member.tenure?.days ?? null,
      tenureAsOf: member.tenure?.asOf ?? null,
      heroLevels: member.heroLevels ?? null,
      heroPower: null,
      bestTrophies: member.bestTrophies ?? null,
      bestVersusTrophies: member.bestVersusTrophies ?? null,
      pets: member.pets ?? null,
      superTroopsActive: member.superTroopsActive ?? null,
      equipmentLevels: member.equipmentLevels ?? null,
      achievements: {
        count: member.achievements?.count ?? null,
        score: member.achievements?.score ?? null,
      },
      expLevel: member.expLevel ?? null,
    };

    // Default bundles for non-leaders
    let leadership: PlayerLeadershipBundle = {
      notes: [],
      warnings: [],
      tenureActions: [],
      departureActions: [],
    };
    let evaluations: PlayerEvaluationRecord[] = [];
    let joinerEvents: PlayerJoinerEventRecord[] = [];
    let history: PlayerHistoryRecordSupabase | null = null;

    // Only leaders/co-leaders can see leadership-only data.
    try {
      const user = await getAuthenticatedUser();
      if (user && resolvedClanTag) {
        const roles = await getUserClanRoles(user.id);
        const canSeeSensitive = hasRole(roles, resolvedClanTag, ['leader', 'coleader']);

        if (canSeeSensitive) {
          const [notesRes, warningsRes, tenureRes, departureRes, evalRes, joinerRes, historyRes] = await Promise.all([
            supabase
              .from('player_notes')
              .select('id, created_at, note, custom_fields, created_by')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('created_at', { ascending: false }),
            supabase
              .from('player_warnings')
              .select('id, created_at, warning_note, is_active, created_by')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('created_at', { ascending: false }),
            supabase
              .from('player_tenure_actions')
              .select('id, created_at, action, reason, granted_by, created_by')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('created_at', { ascending: false }),
            supabase
              .from('player_departure_actions')
              .select('id, created_at, reason, departure_type, recorded_by, created_by')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('created_at', { ascending: false }),
            supabase
              .from('applicant_evaluations')
              .select('id, status, score, recommendation, rush_percent, evaluation, applicant, created_at, updated_at')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('created_at', { ascending: false }),
            supabase
              .from('joiner_events')
              .select('id, detected_at, status, metadata')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .order('detected_at', { ascending: false }),
            supabase
              .from('player_history')
              .select('*')
              .eq('clan_tag', resolvedClanTag)
              .eq('player_tag', normalizedTag)
              .maybeSingle(),
          ]);

          leadership = {
            notes: (notesRes.data ?? []).map((row: any) => ({
              id: row.id,
              note: row.note ?? null,
              customFields: row.custom_fields ?? null,
              createdAt: toIso(row.created_at),
              createdBy: row.created_by ?? null,
            })),
            warnings: (warningsRes.data ?? []).map((row: any) => ({
              id: row.id,
              warningNote: row.warning_note ?? null,
              isActive: row.is_active ?? true,
              createdAt: toIso(row.created_at),
              createdBy: row.created_by ?? null,
            })),
            tenureActions: (tenureRes.data ?? []).map((row: any) => ({
              id: row.id,
              action: row.action ?? null,
              reason: row.reason ?? null,
              grantedBy: row.granted_by ?? null,
              createdAt: toIso(row.created_at),
              createdBy: row.created_by ?? null,
            })),
            departureActions: (departureRes.data ?? []).map((row: any) => ({
              id: row.id,
              departureType: row.departure_type ?? null,
              reason: row.reason ?? null,
              recordedBy: row.recorded_by ?? null,
              createdAt: toIso(row.created_at),
              createdBy: row.created_by ?? null,
            })),
          };

          evaluations = (evalRes.data ?? []).map((row: any) => ({
            id: row.id,
            status: row.status ?? null,
            score: row.score ?? null,
            recommendation: row.recommendation ?? null,
            rushPercent: row.rush_percent ?? null,
            evaluation: row.evaluation ?? null,
            applicant: row.applicant ?? null,
            createdAt: toIso(row.created_at),
            updatedAt: toIso(row.updated_at),
          }));

          joinerEvents = (joinerRes.data ?? []).map((row: any) => ({
            id: row.id,
            detectedAt: toIso(row.detected_at),
            status: row.status ?? 'pending',
            metadata: row.metadata ?? {},
          }));

          history = historyRes.data
            ? {
                clanTag: historyRes.data.clan_tag,
                playerTag: historyRes.data.player_tag,
                primaryName: historyRes.data.primary_name,
                status: historyRes.data.status,
                totalTenure: historyRes.data.total_tenure,
                currentStint: historyRes.data.current_stint ?? null,
                movements: historyRes.data.movements ?? [],
                aliases: historyRes.data.aliases ?? [],
                notes: historyRes.data.notes ?? [],
                createdAt: toIso(historyRes.data.created_at),
                updatedAt: toIso(historyRes.data.updated_at),
              }
            : null;
        }
      }
    } catch (authError) {
      console.warn('[profile-snapshot] auth/leadership enrichment failed', authError);
    }

    const payload: SupabasePlayerProfilePayload = {
      summary,
      timeline,
      history,
      leadership,
      evaluations,
      joinerEvents,
      clanHeroAverages: {},
      vip: { current: null, history: [] },
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    console.error('[api/player/profile-snapshot] error', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load player snapshot profile' },
      { status: 500 },
    );
  }
}
