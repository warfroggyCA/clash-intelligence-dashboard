import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { resolveRosterMembers } from '@/lib/roster-resolver';
import type { RosterData, RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';
import { mapActivityToBand, resolveHeroPower, resolveLeagueDisplay, resolveTrophies } from '@/lib/roster-derivations';

function formatSupabaseError(error: unknown): string {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function getCurrentRosterData(requestedClanTag?: string): Promise<RosterData | null> {
  try {
    const supabase = getSupabaseServerClient();
    const defaultTag = cfg.homeClanTag ?? '';
    const clanTag = normalizeTag(requestedClanTag ?? defaultTag) ?? defaultTag;

    if (!clanTag) {
      console.warn('[getCurrentRosterData] No clan tag provided');
      return null;
    }

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url, created_at, updated_at')
      .eq('tag', clanTag)
      .single();

    if (clanError) {
      if (clanError.code === 'PGRST116') {
        console.warn('[getCurrentRosterData] Clan not found:', clanTag);
        return null;
      }
      throw new Error(`Clan lookup failed: ${formatSupabaseError(clanError)}`);
    }

    const { data: snapshotRow, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at, member_count, metadata, payload_version, ingestion_version, schema_version, computed_at, season_id, season_start, season_end')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshotError) {
      if (snapshotError.code === 'PGRST116') {
        console.warn('[getCurrentRosterData] No roster snapshots found:', clanTag);
        return null;
      }
      throw new Error(`Snapshot lookup failed: ${formatSupabaseError(snapshotError)}`);
    }

    const snapshotDate = snapshotRow?.fetched_at
      ? new Date(snapshotRow.fetched_at).toISOString().slice(0, 10)
      : null;

    const { members: resolvedMembers, memberTagToId: memberTagToUuidMap } = await resolveRosterMembers({
      supabase,
      clanTag,
      snapshotId: snapshotRow.id,
      snapshotDate,
    });

    const memberIdList = memberTagToUuidMap.size > 0
      ? Array.from(memberTagToUuidMap.values()).filter(Boolean)
      : [];
    const vipScoresByMemberId = new Map<string, {
      score: number;
      rank: number;
      competitive_score: number;
      support_score: number;
      development_score: number;
      trend: 'up' | 'down' | 'stable';
      last_week_score?: number;
    }>();

    if (memberIdList.length > 0) {
      const { data: latestWeekRow, error: weekError } = await supabase
        .from('vip_scores')
        .select('week_start')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!weekError && latestWeekRow?.week_start) {
        const weekStartISO = latestWeekRow.week_start;
        const lastWeekStart = new Date(weekStartISO);
        lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
        const lastWeekStartISO = lastWeekStart.toISOString().split('T')[0];

        const [
          { data: vipRows },
          { data: lastWeekVipRows },
        ] = await Promise.all([
          supabase
            .from('vip_scores')
            .select('member_id, vip_score, competitive_score, support_score, development_score, week_start')
            .in('member_id', memberIdList)
            .eq('week_start', weekStartISO)
            .order('vip_score', { ascending: false }),
          supabase
            .from('vip_scores')
            .select('member_id, vip_score')
            .in('member_id', memberIdList)
            .eq('week_start', lastWeekStartISO),
        ]);

        if (vipRows) {
          let rank = 1;
          for (const row of vipRows) {
            vipScoresByMemberId.set(row.member_id, {
              score: Number(row.vip_score),
              rank: rank++,
              competitive_score: Number(row.competitive_score),
              support_score: Number(row.support_score),
              development_score: Number(row.development_score),
              trend: 'stable',
            });
          }
        }

        if (lastWeekVipRows) {
          const lastWeekScores = new Map(
            lastWeekVipRows.map((row) => [row.member_id, Number(row.vip_score)])
          );

          for (const [memberId, vipData] of vipScoresByMemberId.entries()) {
            const lastWeekScore = lastWeekScores.get(memberId);
            if (lastWeekScore !== undefined) {
              vipData.last_week_score = lastWeekScore;
              if (vipData.score > lastWeekScore + 0.5) {
                vipData.trend = 'up';
              } else if (vipData.score < lastWeekScore - 0.5) {
                vipData.trend = 'down';
              }
            }
          }
        }
      }
    }
    if (memberIdList.length > 0 && vipScoresByMemberId.size === 0) {
      const { data: vipRows } = await supabase
        .from('vip_scores')
        .select('member_id, vip_score, competitive_score, support_score, development_score, week_start')
        .in('member_id', memberIdList)
        .order('week_start', { ascending: false });

      if (vipRows && vipRows.length) {
        const latestByMember = new Map<string, typeof vipRows[number]>();
        for (const row of vipRows) {
          if (!latestByMember.has(row.member_id)) {
            latestByMember.set(row.member_id, row);
          }
        }

        const sorted = Array.from(latestByMember.values()).sort(
          (a, b) => Number(b.vip_score) - Number(a.vip_score)
        );
        let rank = 1;
        for (const row of sorted) {
          vipScoresByMemberId.set(row.member_id, {
            score: Number(row.vip_score),
            rank: rank++,
            competitive_score: Number(row.competitive_score),
            support_score: Number(row.support_score),
            development_score: Number(row.development_score),
            trend: 'stable',
          });
        }
      }
    }

    const members: RosterMember[] = resolvedMembers
      .map((member) => {
        const heroLevels = member.hero_levels ?? {};
        const vip = vipScoresByMemberId.get(member.id);

        const baseMember = {
          name: member.name ?? 'Unknown',
          tag: member.tag,
          townHallLevel: member.th_level ?? null,
          role: member.role ?? null,
          trophies: member.trophies ?? null,
          donations: member.donations ?? null,
          donationsReceived: member.donations_received ?? null,
          cumulativeDonationsGiven: member.cumulative_donations_given ?? null,
          cumulativeDonationsReceived: member.cumulative_donations_received ?? null,
          warStars: member.war_stars ?? null,
          clanCapitalContributions: member.capital_contributions ?? null,
          rankedLeagueId: member.ranked_league_id ?? null,
          rankedLeagueName: member.ranked_league_name ?? null,
          rushPercent: member.rush_percent ?? null,
          rankedTrophies: member.ranked_trophies ?? null,
          lastWeekTrophies: null,
          seasonTotalTrophies: null,
          bk: heroLevels.bk ?? null,
          aq: heroLevels.aq ?? null,
          gw: heroLevels.gw ?? null,
          rc: heroLevels.rc ?? null,
          mp: heroLevels.mp ?? null,
          activityScore: member.activity_score ?? null,
          tenureDays: member.tenure_days ?? null,
          tenureAsOf: member.tenure_as_of ?? null,
          tenure_days: member.tenure_days ?? undefined,
          tenure_as_of: member.tenure_as_of !== null ? member.tenure_as_of : undefined,
          leagueId: member.league_id ?? null,
          leagueName: member.league_name ?? null,
          leagueTrophies: member.league_trophies ?? null,
          leagueIconSmall: undefined,
          leagueIconMedium: undefined,
          battleModeTrophies: member.battle_mode_trophies ?? null,
          vip: vip ? {
            score: vip.score ?? 0,
            rank: vip.rank ?? 0,
            competitive_score: vip.competitive_score ?? 0,
            support_score: vip.support_score ?? 0,
            development_score: vip.development_score ?? 0,
            trend: vip.trend ?? 'stable',
            last_week_score: vip.last_week_score ?? undefined,
          } : null,
        } as RosterMember;

        const activityEvidence = resolveMemberActivity(baseMember);
        const resolvedTrophies = resolveTrophies(baseMember);
        const resolvedLeague = resolveLeagueDisplay(baseMember, { allowProfileFallback: false });
        const heroPower = resolveHeroPower(baseMember);
        const activityBand = mapActivityToBand(activityEvidence);
        return {
          ...baseMember,
          activity: activityEvidence ?? null,
          activityScore: activityEvidence?.score ?? baseMember.activityScore ?? null,
          resolvedTrophies,
          resolvedLeague: resolvedLeague ? {
            name: resolvedLeague.league,
            tier: resolvedLeague.tier ?? undefined,
            hasLeague: resolvedLeague.hasLeague,
          } : null,
          heroPower,
          activityBand: activityBand.band,
          activityTone: activityBand.tone,
        };
      })
      .filter((member): member is RosterMember => Boolean(member));

    return {
      members,
      clanName: clanRow?.name ?? 'Unknown Clan',
      clanTag: clanRow?.tag ?? clanTag,
      date: snapshotRow?.fetched_at ?? null,
      lastUpdated: snapshotRow?.fetched_at ?? null,
      snapshotMetadata: snapshotRow ? {
        snapshotDate,
        fetchedAt: snapshotRow.fetched_at,
        memberCount: snapshotRow.member_count ?? members.length,
        warLogEntries: 0,
        capitalSeasons: 0,
        version: 'current-snapshot',
        payloadVersion: snapshotRow.payload_version ?? null,
        ingestionVersion: snapshotRow.ingestion_version ?? null,
        schemaVersion: snapshotRow.schema_version ?? null,
        computedAt: snapshotRow.computed_at ?? null,
        seasonId: snapshotRow.season_id ?? null,
        seasonStart: snapshotRow.season_start ?? null,
        seasonEnd: snapshotRow.season_end ?? null,
      } : undefined,
      meta: {
        clanName: clanRow?.name ?? null,
        memberCount: members.length,
      },
    } satisfies RosterData;
  } catch (error) {
    const details = formatSupabaseError(error);
    console.error('[getCurrentRosterData] Error:', details);
    return null;
  }
}
