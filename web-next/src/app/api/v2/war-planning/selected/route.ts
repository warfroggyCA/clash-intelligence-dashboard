import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/api/role-check';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SelectedPayload {
  selectedTags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = (await req.json().catch(() => ({}))) as SelectedPayload & { clanTag?: string };
    const rawTags = Array.isArray(body.selectedTags) ? body.selectedTags : [];
    const normalizedTags = rawTags
      .map((tag) => normalizeTag(tag))
      .filter((tag): tag is string => Boolean(tag));

    if (!normalizedTags.length) {
      return NextResponse.json(
        { success: false, error: 'selectedTags array with at least one valid player tag is required.' },
        { status: 400 },
      );
    }

    const ourClanTag = normalizeTag(body.clanTag ?? '') || cfg.homeClanTag;
    await requirePermission(req, 'canManageWarPlans', { clanTag: ourClanTag ?? undefined });

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .in('player_tag', normalizedTags)
      .order('snapshot_date', { ascending: false })
      .limit(normalizedTags.length * 3); // grab a few entries per player

    if (snapshotError) {
      throw snapshotError;
    }

    const latestByPlayer = new Map<string, (typeof snapshotRows)[number]>();
    snapshotRows?.forEach((row) => {
      const normalized = normalizeTag(row?.player_tag ?? '');
      if (!normalized || latestByPlayer.has(normalized)) return;
      latestByPlayer.set(normalized, row);
    });

    const opponents = normalizedTags
      .map((tag) => {
        const row = latestByPlayer.get(tag);
        if (!row) return null;

        const payload = (row.payload as any) ?? {};
        const member = payload.member ?? {};
        const ranked = member.ranked ?? {};
        const war = member.war ?? {};
        const builderBase = member.builderBase ?? {};

        const heroes = member.heroLevels ?? payload.heroLevels ?? {};
        const heroValue = (value: unknown) =>
          typeof value === 'number' && Number.isFinite(value) ? value : null;

        const baseSummary = {
          tag,
          name: member.name ?? tag,
          thLevel: member.townHallLevel ?? null,
          trophies: ranked.trophies ?? member.trophies ?? null,
          warStars: war.stars ?? null,
          attackWins: war.attackWins ?? null,
          defenseWins: war.defenseWins ?? null,
          builderHallLevel: builderBase.hallLevel ?? null,
          lastUpdated: row.snapshot_date ?? null,
          heroLevels: {
            bk: heroValue(heroes?.bk),
            aq: heroValue(heroes?.aq),
            gw: heroValue(heroes?.gw),
            rc: heroValue(heroes?.rc),
            mp: heroValue(heroes?.mp),
          },
          rankedTrophies: ranked.trophies ?? null,
          role: member.role ?? null,
        };

        return {
          ...baseSummary,
          warHistory: {
            last30Days: payload.warHistory?.last30Days ?? [],
            attackSuccessRate: payload.warHistory?.attackSuccessRate ?? null,
            defenseSuccessRate: payload.warHistory?.defenseSuccessRate ?? null,
            averageStars: payload.warHistory?.averageStars ?? null,
            favoriteAttacks: payload.warHistory?.favoriteAttacks ?? [],
            warFrequency: payload.warHistory?.warFrequency ?? null,
          },
          attackPatterns: {
            preferredArmyComps: payload.attackPatterns?.preferredArmyComps ?? [],
            attackTiming: payload.attackPatterns?.attackTiming ?? null,
            targetSelection: payload.attackPatterns?.targetSelection ?? null,
            backupStrategies: payload.attackPatterns?.backupStrategies ?? [],
            recentInnovations: payload.attackPatterns?.recentInnovations ?? [],
          },
          baseLayouts: {
            currentLayout: payload.baseLayouts?.currentLayout ?? null,
            layoutHistory: payload.baseLayouts?.layoutHistory ?? [],
            weakSpots: payload.baseLayouts?.weakSpots ?? [],
            defensiveStrengths: payload.baseLayouts?.defensiveStrengths ?? [],
            trapPlacements: payload.baseLayouts?.trapPlacements ?? [],
            ccTroops: payload.baseLayouts?.ccTroops ?? [],
          },
          activityPatterns: {
            onlineHours: payload.activityPatterns?.onlineHours ?? [],
            warParticipation: payload.activityPatterns?.warParticipation ?? null,
            donationPatterns: payload.activityPatterns?.donationPatterns ?? null,
            clanChatActivity: payload.activityPatterns?.clanChatActivity ?? null,
            leadershipRole: payload.activityPatterns?.leadershipRole ?? member.role ?? null,
          },
          threatAssessment: {
            threatLevel: payload.threatAssessment?.threatLevel ?? null,
            priorityTarget: payload.threatAssessment?.priorityTarget ?? null,
            recommendedCounters: payload.threatAssessment?.recommendedCounters ?? [],
            attackDifficulty: payload.threatAssessment?.attackDifficulty ?? null,
            defenseStrength: payload.threatAssessment?.defenseStrength ?? null,
          },
          recentPerformance: {
            recentAttacks: payload.recentPerformance?.recentAttacks ?? [],
            recentDefenses: payload.recentPerformance?.recentDefenses ?? [],
            performanceTrends: payload.recentPerformance?.performanceTrends ?? null,
            seasonalStats: payload.recentPerformance?.seasonalStats ?? null,
          },
          strategicInsights: {
            vulnerabilities: payload.strategicInsights?.vulnerabilities ?? [],
            strengths: payload.strategicInsights?.strengths ?? [],
            counterStrategies: payload.strategicInsights?.counterStrategies ?? [],
            warRole: payload.strategicInsights?.warRole ?? null,
            targetPriority: payload.strategicInsights?.targetPriority ?? null,
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const missingTags = normalizedTags.filter((tag) => !latestByPlayer.has(tag));

    return NextResponse.json({
      success: true,
      data: {
        opponents,
        missing: missingTags,
      },
    });
  } catch (error) {
    if (error instanceof Response && (error.status === 401 || error.status === 403)) {
      return error;
    }
    console.error('[war-planning/selected] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load selected opponents. Please try again.',
      },
      { status: 500 },
    );
  }
}
