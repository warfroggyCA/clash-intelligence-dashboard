import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { readTenureDetails } from '@/lib/tenure';
import { extractHeroLevels } from '@/lib/coc';
import { daysSinceToDate } from '@/lib/date';
import { calculateActivityScore } from '@/lib/business/calculations';
import type { Member, MemberEnriched } from '@/types';
import { extractEnrichedFields } from '@/lib/ingestion/field-extractors';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching

const querySchema = z.object({
  clanTag: z.string().optional(),
});

const SEASON_START_ISO = '2025-10-01T00:00:00Z';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const searchParams = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid query parameters' }, { status: 400 });
    }

    const requestedTag = parsed.data.clanTag || cfg.homeClanTag || '';
    const clanTag = normalizeTag(requestedTag);

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'A valid clanTag is required' }, { status: 400 });
    }

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url, created_at, updated_at')
      .eq('tag', clanTag)
      .single();

    if (clanError) {
      if (clanError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
      }
      throw clanError;
    }

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at, member_count, total_trophies, total_donations, metadata, payload_version, ingestion_version, schema_version, computed_at, season_id, season_start, season_end, payload')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (snapshotError) {
      throw snapshotError;
    }

    const snapshot = snapshotRows?.[0] ?? null;

    const requestedETag = req.headers.get('if-none-match')?.replace(/^W\//, '')?.replace(/^"|"$/g, '') ?? null;
    const snapshotPayloadVersion = snapshot?.payload_version
      ?? snapshot?.metadata?.payloadVersion
      ?? snapshot?.id
      ?? null;
    const snapshotIngestionVersion = snapshot?.ingestion_version
      ?? snapshot?.metadata?.ingestionVersion
      ?? snapshot?.computed_at
      ?? null;

    if (!snapshot) {
      return new NextResponse(
        JSON.stringify({
          success: true,
          data: {
            clan: clanRow,
            snapshot: null,
            members: [],
          },
        }),
        {
          status: 200,
          headers: snapshotPayloadVersion
            ? { ETag: `"${snapshotPayloadVersion}"`, 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: statsRows, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, th_level, role, trophies, donations, donations_received, hero_levels, activity_score, rush_percent, extras, league_id, league_name, league_trophies, battle_mode_trophies, ranked_trophies, ranked_league_id, ranked_league_name, ranked_modifier, equipment_flags, tenure_days, tenure_as_of')
      .eq('snapshot_id', snapshot.id);

    if (statsError) {
      throw statsError;
    }

    const stats = statsRows ?? [];
    const memberIds = stats.map((row) => row.member_id).filter(Boolean) as string[];

    const { data: metricsRows, error: metricsError } = await supabase
      .from('metrics')
      .select('member_id, metric_name, value, metadata')
      .eq('clan_id', clanRow.id)
      .eq('metric_window', 'latest');

    if (metricsError) {
      throw metricsError;
    }

    // Fetch last week's trophy data (most recent Monday snapshot before weekly reset)
    // Monday DOW = 1, captured at 4:30 AM UTC before Tuesday 5 AM reset
    let lastWeekTrophies = new Map<string, number>();
    if (memberIds.length > 0) {
      const { data: mondaySnapshotRows, error: mondayError } = await supabase
        .from('member_snapshot_stats')
        .select('member_id, trophies, snapshot_date')
        .in('member_id', memberIds)
        .filter('snapshot_date', 'gte', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days to find historical Mondays
        .order('snapshot_date', { ascending: false });

      if (!mondayError && mondaySnapshotRows) {
        // Find most recent Monday (DOW=1) for each member
        for (const row of mondaySnapshotRows) {
          const snapshotDate = new Date(row.snapshot_date);
          const dayOfWeek = snapshotDate.getUTCDay();
          if (dayOfWeek === 1 && !lastWeekTrophies.has(row.member_id)) {
            lastWeekTrophies.set(row.member_id, row.trophies ?? 0);
          }
        }
      }
    }

    const seasonTotalMap = new Map<string, number>();
    if (memberIds.length > 0) {
      const seasonDaySeenByMember = new Map<string, Set<string>>();
      const { data: seasonRows, error: seasonError } = await supabase
        .from('member_snapshot_stats')
        .select('member_id, trophies, snapshot_date')
        .in('member_id', memberIds)
        .gte('snapshot_date', SEASON_START_ISO)
        .order('snapshot_date', { ascending: false });

      if (!seasonError && seasonRows) {
        for (const row of seasonRows) {
          if (!row.snapshot_date) continue;
          const snapshotDate = new Date(row.snapshot_date);
          if (Number.isNaN(snapshotDate.valueOf())) continue;
          if (snapshotDate.getUTCDay() === 1) {
            const dayKey = snapshotDate.toISOString().slice(0, 10);
            const seenSet = seasonDaySeenByMember.get(row.member_id) ?? new Set<string>();
            if (!seenSet.has(dayKey)) {
              const current = seasonTotalMap.get(row.member_id) ?? 0;
              seasonTotalMap.set(row.member_id, current + (row.trophies ?? 0));
              seenSet.add(dayKey);
              seasonDaySeenByMember.set(row.member_id, seenSet);
            }
          }
        }
      }
    }

    const metricsByMember = new Map<string, Record<string, { value: number; metadata?: Record<string, any> | null }>>();
    for (const metric of metricsRows ?? []) {
      if (!metric?.member_id || !metric.metric_name) continue;
      const bucket = metricsByMember.get(metric.member_id) || {};
      bucket[metric.metric_name] = {
        value: typeof metric.value === 'number' ? metric.value : 0,
        metadata: metric.metadata ?? null,
      };
      metricsByMember.set(metric.member_id, bucket);
    }

    // Fetch tenure data for all members
    const snapshotDate = snapshot?.fetched_at ? snapshot.fetched_at.slice(0, 10) : undefined;
    const tenureDetails = await readTenureDetails(snapshotDate);

    // Check for a newer full snapshot in clan_snapshots; if newer, prefer it
    let clanSnapshot: any | null = null;
    let clanNewer = false;
    try {
      const safeTag = clanRow.tag.replace('#', '').toUpperCase();
      const { data: cs, error: csError } = await supabase
        .from('clan_snapshots')
        .select('fetched_at, clan, member_summaries, player_details, metadata')
        .eq('clan_tag', safeTag)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!csError && cs) {
        clanSnapshot = cs;
        clanNewer = Boolean(clanSnapshot?.fetched_at && (!snapshot?.fetched_at || clanSnapshot.fetched_at > snapshot.fetched_at));
      }
    } catch {}

    const strongFingerprint = snapshotPayloadVersion ?? snapshotIngestionVersion ?? null;
    if (!clanNewer && strongFingerprint && requestedETag && requestedETag === strongFingerprint) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: `"${strongFingerprint}"` },
      });
    }

    if (clanNewer && clanSnapshot) {
      const summaries: any[] = Array.isArray(clanSnapshot.member_summaries) ? clanSnapshot.member_summaries : [];
      const details: Record<string, any> = (clanSnapshot.player_details && typeof clanSnapshot.player_details === 'object') ? clanSnapshot.player_details : {};
      const mappedMembers = summaries.map((summary) => {
        const tag = normalizeTag(summary.tag);
        const detail = details[tag] || null;
        const heroLevels = detail ? extractHeroLevels(detail) : null;
        const league = summary.league || detail?.league || null;
        const leagueId = typeof league === 'object' ? league?.id : null;
        const leagueName = typeof league === 'object' ? league?.name : (typeof league === 'string' ? league : null);
        const leagueTrophies = typeof league === 'object' ? league?.trophies ?? null : null;
        const leagueIconSmall = typeof league === 'object' ? league?.iconUrls?.small ?? null : null;
        const leagueIconMedium = typeof league === 'object' ? league?.iconUrls?.medium ?? null : null;
        
        // Extract leagueTier (new Oct 2025 ranked system) - CRITICAL for sorting
        const leagueTier = summary.leagueTier || detail?.leagueTier || null;
        const leagueTierId = typeof leagueTier === 'object' ? leagueTier?.id : null;
        const leagueTierName = typeof leagueTier === 'object' ? leagueTier?.name : null;
        
        const seasonTotal = (summary.trophies ?? detail?.trophies ?? 0);

        // Create member object for activity calculation
        const memberForActivity: Member = {
          tag,
          name: summary.name ?? tag,
          role: summary.role ?? null,
          townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? null,
          trophies: summary.trophies ?? detail?.trophies ?? null,
          donations: summary.donations ?? null,
          donationsReceived: summary.donationsReceived ?? null,
          warStars: detail?.warStars ?? null,
          clanCapitalContributions: detail?.capitalContributions ?? null,
          versusTrophies: detail?.versusTrophies ?? null,
          league: league,
          builderBaseLeague: detail?.builderBaseLeague ?? null,
          leagueTier: leagueTier,
          enriched: {
            petLevels: detail?.pets ? Object.fromEntries(
              (detail.pets as any[] || []).map((pet: any) => [pet.name, pet.level])
            ) : null,
            builderHallLevel: detail?.builderHallLevel ?? null,
            versusBattleWins: detail?.versusBattleWins ?? null,
            warStars: detail?.warStars ?? null,
            attackWins: detail?.attackWins ?? null,
            defenseWins: detail?.defenseWins ?? null,
            capitalContributions: detail?.capitalContributions ?? null,
            maxTroopCount: detail?.maxTroopCount ?? null,
            maxSpellCount: detail?.maxSpellCount ?? null,
            superTroopsActive: detail?.superTroopsActive ?? null,
            achievementCount: detail?.achievementCount ?? null,
            achievementScore: detail?.achievementScore ?? null,
            expLevel: detail?.expLevel ?? null,
            bestTrophies: detail?.bestTrophies ?? null,
            bestVersusTrophies: detail?.bestVersusTrophies ?? null,
            equipmentLevels: detail?.equipment ? Object.fromEntries(
              (detail.equipment as any[] || []).map((eq: any) => [eq.name, eq.level])
            ) : null,
          },
        };

        const activityEvidence = calculateActivityScore(memberForActivity);

        return {
          id: `clan:${tag}`,
          tag,
          name: summary.name ?? tag,
          townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? null,
          role: summary.role ?? null,
          trophies: summary.trophies ?? detail?.trophies ?? null,
          lastWeekTrophies: null, // Not available in clan snapshot fallback
          donations: summary.donations ?? null,
          donationsReceived: summary.donationsReceived ?? null,
          heroLevels,
          activity: activityEvidence,
          activityScore: activityEvidence.score,
          rushPercent: null,
          extras: null,
          league,
          builderLeague: detail?.builderBaseLeague ?? null,
          leagueId,
          leagueName,
          leagueTrophies,
          leagueIconSmall,
          leagueIconMedium,
          battleModeTrophies: leagueTrophies ?? null,
          rankedTrophies: leagueTrophies ?? null,
          rankedLeagueId: leagueTierId || leagueId, // Use leagueTier.id first, fallback to legacy
          rankedLeagueName: leagueTierName || leagueName,
          rankedModifier: null,
          seasonResetAt: null,
          equipmentFlags: detail?.equipment ?? null,
          metrics: {},
          tenure_days: null,
          tenure_as_of: null,
          seasonTotalTrophies: seasonTotal,
          enriched: enrichedForMember,
        } as any;
      });

      const metadata = clanSnapshot?.metadata ?? {};
      return new NextResponse(
        JSON.stringify({
          success: true,
          data: {
            clan: clanRow,
            snapshot: {
              id: 'clan_snapshot_fallback',
              fetchedAt: clanSnapshot.fetched_at,
              memberCount: mappedMembers.length,
              totalTrophies: null,
              totalDonations: null,
              metadata,
              payloadVersion: null,
              ingestionVersion: null,
              schemaVersion: null,
              computedAt: null,
              seasonId: metadata?.seasonId ?? null,
              seasonStart: metadata?.seasonStart ?? null,
              seasonEnd: metadata?.seasonEnd ?? null,
            },
            members: mappedMembers,
            seasonId: metadata?.seasonId ?? null,
            seasonStart: metadata?.seasonStart ?? null,
            seasonEnd: metadata?.seasonEnd ?? null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    let memberLookup: Record<string, any> = {};

    if (memberIds.length) {
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('id, tag, name, th_level, role, league, builder_league, league_id, league_name, league_trophies, league_icon_small, league_icon_medium, battle_mode_trophies, ranked_trophies, ranked_league_id, ranked_league_name, ranked_modifier, season_reset_at, equipment_flags, tenure_days, tenure_as_of, created_at, updated_at')
        .in('id', memberIds);

      if (memberError) {
        throw memberError;
      }

      for (const row of memberRows ?? []) {
        memberLookup[row.id] = row;
      }
    }

    // Fast fallback: If no stats available, derive members from snapshot payload (memberSummaries + playerDetails)
    if (!stats.length) {
      const payload: any = (snapshot as any).payload ?? null;
      const summaries: any[] = Array.isArray(payload?.memberSummaries) ? payload.memberSummaries : [];
      const details: Record<string, any> = (payload?.playerDetails && typeof payload.playerDetails === 'object') ? payload.playerDetails : {};

      const mappedMembers = summaries.map((summary) => {
        const tag = normalizeTag(summary.tag);
        const detail = details[tag];
        const heroLevels = detail ? extractHeroLevels(detail) : null;
        const league = summary.league || detail?.league || null;
        const leagueId = typeof league === 'object' ? league?.id : null;
        const leagueName = typeof league === 'object' ? league?.name : (typeof league === 'string' ? league : null);
        const leagueTrophies = typeof league === 'object' ? league?.trophies ?? null : null;
        const leagueIconSmall = typeof league === 'object' ? league?.iconUrls?.small ?? null : null;
        const leagueIconMedium = typeof league === 'object' ? league?.iconUrls?.medium ?? null : null;

        // Extract leagueTier (new Oct 2025 ranked system) - CRITICAL for sorting
        const leagueTier = summary.leagueTier || detail?.leagueTier || null;
        const leagueTierId = typeof leagueTier === 'object' ? leagueTier?.id : null;
        const leagueTierName = typeof leagueTier === 'object' ? leagueTier?.name : null;

        const extracted = detail ? extractEnrichedFields(detail) : null;
        const enrichedForMember: MemberEnriched = {
          petLevels: extracted?.petLevels ?? null,
          builderHallLevel: extracted?.builderHallLevel ?? null,
          versusTrophies: extracted?.versusTrophies ?? null,
          versusBattleWins: extracted?.versusBattleWins ?? null,
          builderLeagueId: extracted?.builderLeagueId ?? null,
          warStars: extracted?.warStars ?? null,
          attackWins: extracted?.attackWins ?? null,
          defenseWins: extracted?.defenseWins ?? null,
          capitalContributions: extracted?.capitalContributions ?? null,
          maxTroopCount: extracted?.maxTroopCount ?? null,
          maxSpellCount: extracted?.maxSpellCount ?? null,
          superTroopsActive: extracted?.superTroopsActive ?? null,
          achievementCount: extracted?.achievementCount ?? null,
          achievementScore: extracted?.achievementScore ?? null,
          expLevel: extracted?.expLevel ?? null,
          bestTrophies: extracted?.bestTrophies ?? null,
          bestVersusTrophies: extracted?.bestVersusTrophies ?? null,
          equipmentLevels: extracted?.equipmentLevels ?? null,
        };

        const memberForActivity: Member = {
          name: summary.name ?? tag,
          tag,
          role: summary.role ?? undefined,
          townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? undefined,
          trophies: summary.trophies ?? detail?.trophies ?? undefined,
          rankedLeagueId: (leagueTierId || leagueId || undefined) ?? undefined,
          rankedLeagueName: leagueTierName || leagueName || undefined,
          rankedTrophies: (leagueTrophies ?? undefined) ?? undefined,
          donations: summary.donations ?? undefined,
          donationsReceived: summary.donationsReceived ?? undefined,
          seasonTotalTrophies: (summary.trophies ?? detail?.trophies ?? 0),
          enriched: enrichedForMember,
        };

        const activityEvidence = calculateActivityScore(memberForActivity);

        return {
          id: `fallback:${tag}`,
          tag,
          name: summary.name ?? tag,
          townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? null,
          role: summary.role ?? null,
          trophies: summary.trophies ?? detail?.trophies ?? null,
          lastWeekTrophies: null, // Not available in payload fallback
          donations: summary.donations ?? null,
          donationsReceived: summary.donationsReceived ?? null,
          heroLevels: heroLevels,
          activity: activityEvidence,
          activityScore: activityEvidence.score,
          rushPercent: null,
          extras: null,
          league,
          builderLeague: detail?.builderBaseLeague ?? null,
          leagueId,
          leagueName,
          leagueTrophies,
          leagueIconSmall,
          leagueIconMedium,
          battleModeTrophies: leagueTrophies ?? null,
          rankedTrophies: leagueTrophies ?? null,
          rankedLeagueId: leagueTierId || leagueId, // Use leagueTier.id first, fallback to legacy
          rankedLeagueName: leagueTierName || leagueName,
          rankedModifier: null,
          seasonResetAt: null,
          equipmentFlags: detail?.equipment ?? null,
          metrics: {},
          tenure_days: null,
          tenure_as_of: null,
          seasonTotalTrophies: (summary.trophies ?? detail?.trophies ?? 0),
          enriched: enrichedForMember,
        } as any;
      });

      const metadata = snapshot?.metadata ?? {};
      const respBody = {
        success: true,
        data: {
          clan: {
            id: clanRow.id,
            tag: clanRow.tag,
            name: clanRow.name ?? null,
            logo_url: null,
          },
          snapshot: {
            id: snapshot.id,
            fetchedAt: snapshot.fetched_at,
            memberCount: Array.isArray(mappedMembers) ? mappedMembers.length : 0,
            totalTrophies: snapshot.total_trophies ?? null,
            totalDonations: snapshot.total_donations ?? null,
            metadata,
            payloadVersion: snapshot.payload_version ?? null,
            ingestionVersion: snapshot.ingestion_version ?? null,
            schemaVersion: snapshot.schema_version ?? null,
            computedAt: snapshot.computed_at ?? null,
            seasonId: (snapshot as any).season_id ?? metadata.seasonId ?? null,
            seasonStart: (snapshot as any).season_start ?? metadata.seasonStart ?? null,
            seasonEnd: (snapshot as any).season_end ?? metadata.seasonEnd ?? null,
          },
          members: mappedMembers,
          seasonId: (snapshot as any).season_id ?? metadata.seasonId ?? null,
          seasonStart: (snapshot as any).season_start ?? metadata.seasonStart ?? null,
          seasonEnd: (snapshot as any).season_end ?? metadata.seasonEnd ?? null,
        },
      };

      return NextResponse.json(respBody, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    // Prepare optional enrichment maps from payload if available
    const payloadEnrich: any = (snapshot as any).payload ?? null;
    const payloadDetailsMap: Record<string, any> = (payloadEnrich?.playerDetails && typeof payloadEnrich.playerDetails === 'object') ? payloadEnrich.playerDetails : {};
    const payloadSummariesArr: any[] = Array.isArray(payloadEnrich?.memberSummaries) ? payloadEnrich.memberSummaries : [];
    const payloadSummaryByTag = new Map<string, any>();
    for (const s of payloadSummariesArr) {
      const t = normalizeTag(s?.tag || '');
      if (t) payloadSummaryByTag.set(t, s);
    }

    const members = stats.map((stat) => {
      const member = memberLookup[stat.member_id] || {};
      const leagueId = stat.league_id ?? member.league_id ?? null;
      const leagueName = stat.league_name ?? member.league_name ?? null;
      const leagueTrophies = stat.league_trophies ?? member.league_trophies ?? null;
      const battleModeTrophies = stat.battle_mode_trophies ?? member.battle_mode_trophies ?? null;
      const rankedTrophies = stat.ranked_trophies ?? member.ranked_trophies ?? null;
      const rankedLeagueId = stat.ranked_league_id ?? member.ranked_league_id ?? null;
      const rankedLeagueNameFromStat = (stat as any).ranked_league_name ?? null;
      const rankedModifier = stat.ranked_modifier ?? member.ranked_modifier ?? null;
      const equipmentFlags = stat.equipment_flags ?? member.equipment_flags ?? null;

      // Get tenure data for this member
      const normalizedTag = member.tag ? normalizeTag(member.tag) : null;
      const tenureData = normalizedTag ? tenureDetails[normalizedTag] : null;
      const statTenureDays = typeof (stat as any).tenure_days === 'number' ? (stat as any).tenure_days : null;
      const statTenureAsOf = (stat as any).tenure_as_of ?? null;

      const tenureAsOf = statTenureAsOf
        ?? tenureData?.as_of
        ?? snapshotDate
        ?? (snapshot?.fetched_at ? snapshot.fetched_at.slice(0, 10) : null);

      const fallbackTenure = (() => {
        if (member.created_at) {
          const createdDate = new Date(member.created_at);
          if (!Number.isNaN(createdDate.getTime())) {
            const target = snapshot?.fetched_at ? new Date(snapshot.fetched_at) : new Date();
            const diffMs = target.getTime() - createdDate.getTime();
            const days = Math.floor(diffMs / 86400000);
            return days >= 0 ? days + 1 : null;
          }
        }
        if (tenureAsOf) {
          const today = snapshotDate ?? new Date().toISOString().slice(0, 10);
          const delta = daysSinceToDate(tenureAsOf, today);
          return delta >= 0 ? delta + 1 : null;
        }
        return null;
      })();

      const rawTenure = statTenureDays ?? tenureData?.days ?? fallbackTenure ?? null;
      const computedTenure = rawTenure != null ? Math.max(1, Math.round(rawTenure)) : null;

      // Enrich from payload when missing
      const pDetail = normalizedTag ? payloadDetailsMap[normalizedTag] : null;
      // Attempt to derive ranked league name from snapshot payload details when missing
      const rankedNameFromDetail = (() => {
        const d = pDetail as any;
        if (!d || typeof d !== 'object') return null;
        // Known candidates from Oct 2025 overhaul
        return (
          d?.rankedLeague?.name ||
          d?.leagueTier?.name ||
          d?.ranked?.league?.name ||
          d?.ranked?.leagueTier?.name ||
          null
        );
      })();
      const pSummary = normalizedTag ? payloadSummaryByTag.get(normalizedTag) : null;
      const enrichedHeroLevels = stat.hero_levels ?? (pDetail ? extractHeroLevels(pDetail) : null);
      const enrichedTh = stat.th_level ?? (pSummary?.townHallLevel ?? pDetail?.townHallLevel ?? null);

      // Extract individual hero levels
      const heroes = enrichedHeroLevels ?? {};
      const bk = typeof heroes === 'object' ? (heroes.bk ?? heroes.BK ?? null) : null;
      const aq = typeof heroes === 'object' ? (heroes.aq ?? heroes.AQ ?? null) : null;
      const gw = typeof heroes === 'object' ? (heroes.gw ?? heroes.GW ?? null) : null;
      const rc = typeof heroes === 'object' ? (heroes.rc ?? heroes.RC ?? null) : null;
      const mp = typeof heroes === 'object' ? (heroes.mp ?? heroes.MP ?? null) : null;

      const enrichedForMember: MemberEnriched = {
        petLevels: (stat as any).pet_levels ?? null,
        builderHallLevel: (stat as any).builder_hall_level ?? null,
        versusTrophies: (stat as any).versus_trophies ?? null,
        versusBattleWins: (stat as any).versus_battle_wins ?? null,
        builderLeagueId: (stat as any).builder_league_id ?? null,
        warStars: (stat as any).war_stars ?? null,
        attackWins: (stat as any).attack_wins ?? null,
        defenseWins: (stat as any).defense_wins ?? null,
        capitalContributions: (stat as any).capital_contributions ?? null,
        maxTroopCount: (stat as any).max_troop_count ?? null,
        maxSpellCount: (stat as any).max_spell_count ?? null,
        superTroopsActive: (stat as any).super_troops_active ?? null,
        achievementCount: (stat as any).achievement_count ?? null,
        achievementScore: (stat as any).achievement_score ?? null,
        expLevel: (stat as any).exp_level ?? null,
        bestTrophies: (stat as any).best_trophies ?? null,
        bestVersusTrophies: (stat as any).best_versus_trophies ?? null,
        equipmentLevels: (stat as any).equipment_flags ?? null,
      };

      const seasonTotal = (seasonTotalMap.get(stat.member_id) ?? 0) + (stat.trophies ?? 0);

      const memberForActivity: Member = {
        name: member.name ?? member.tag ?? '',
        tag: member.tag ?? (normalizedTag ?? ''),
        role: stat.role ?? member.role ?? undefined,
        townHallLevel: enrichedTh ?? member.th_level ?? undefined,
        trophies: stat.trophies ?? undefined,
        rankedLeagueId: rankedLeagueId ?? undefined,
        rankedLeagueName: (rankedLeagueNameFromStat ?? member.ranked_league_name ?? rankedNameFromDetail ?? undefined) || undefined,
        rankedTrophies: rankedTrophies ?? undefined,
        donations: stat.donations ?? undefined,
        donationsReceived: stat.donations_received ?? undefined,
        bk: bk ?? undefined,
        aq: aq ?? undefined,
        gw: gw ?? undefined,
        rc: rc ?? undefined,
        mp: mp ?? undefined,
        seasonTotalTrophies: seasonTotal,
        enriched: enrichedForMember,
      };

      const activityEvidence = calculateActivityScore(memberForActivity);

      return {
        id: stat.member_id,
        tag: member.tag ?? null,
        name: member.name ?? null,
        townHallLevel: enrichedTh ?? member.th_level ?? null,
        role: stat.role ?? member.role ?? null,
        trophies: stat.trophies,
        lastWeekTrophies: lastWeekTrophies.get(stat.member_id) ?? null,
        donations: stat.donations,
        donationsReceived: stat.donations_received,
        heroLevels: enrichedHeroLevels ?? null,
        // Add individual hero levels for easy access
        bk,
        aq,
        gw,
        rc,
        mp,
        activity: activityEvidence,
        activityScore: activityEvidence.score,
        rushPercent: stat.rush_percent ?? null,
        extras: stat.extras ?? null,
        league: member.league ?? null,
        builderLeague: member.builder_league ?? null,
        leagueId,
        leagueName,
        leagueTrophies,
        leagueIconSmall: member.league_icon_small ?? null,
        leagueIconMedium: member.league_icon_medium ?? null,
        battleModeTrophies,
        rankedTrophies,
        rankedLeagueId,
        rankedLeagueName: rankedLeagueNameFromStat ?? member.ranked_league_name ?? rankedNameFromDetail ?? null,
        rankedModifier,
        seasonResetAt: member.season_reset_at ?? null,
        equipmentFlags,
        metrics: metricsByMember.get(stat.member_id) ?? undefined,
        memberCreatedAt: member.created_at ?? null,
        memberUpdatedAt: member.updated_at ?? null,
        // Add tenure data
        tenure_days: computedTenure ?? null,
        tenure_as_of: tenureAsOf,
        seasonTotalTrophies: seasonTotal,
        enriched: enrichedForMember,
      };
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        data: {
          clan: clanRow,
          snapshot: {
            id: snapshot.id,
            fetchedAt: snapshot.fetched_at,
            memberCount: snapshot.member_count,
            totalTrophies: snapshot.total_trophies,
            totalDonations: snapshot.total_donations,
            metadata: snapshot.metadata ?? null,
            payloadVersion: snapshot.payload_version ?? null,
            ingestionVersion: snapshot.ingestion_version ?? null,
            schemaVersion: snapshot.schema_version ?? null,
            computedAt: snapshot.computed_at ?? null,
            seasonId: snapshot.season_id ?? snapshot.metadata?.seasonId ?? null,
            seasonStart: snapshot.season_start ?? snapshot.metadata?.seasonStart ?? null,
            seasonEnd: snapshot.season_end ?? snapshot.metadata?.seasonEnd ?? null,
          },
          members,
          seasonId: snapshot.season_id ?? snapshot.metadata?.seasonId ?? null,
          seasonStart: snapshot.season_start ?? snapshot.metadata?.seasonStart ?? null,
          seasonEnd: snapshot.season_end ?? snapshot.metadata?.seasonEnd ?? null,
        },
      }),
      {
        status: 200,
        headers: strongFingerprint
          ? { ETag: `"${strongFingerprint}"`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          : { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  } catch (error: any) {
    console.error('[api/v2/roster] error', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
