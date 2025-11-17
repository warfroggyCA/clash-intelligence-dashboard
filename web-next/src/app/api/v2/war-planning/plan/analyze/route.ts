import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  fetchWarPlanRecord,
} from '@/lib/war-planning/service';
import type { WarPlanProfile } from '@/lib/war-planning/analysis';
import { queueWarPlanAnalysis } from '@/lib/war-planning/analysis-job';
import { requirePermission } from '@/lib/api/role-check';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = await req.json().catch(() => ({}));
    const rawUseAI = body?.useAI;
    let useAI = true;
    if (typeof rawUseAI === 'boolean') {
      useAI = rawUseAI;
    } else if (typeof rawUseAI === 'string') {
      useAI = !['false', '0', 'no', 'off'].includes(rawUseAI.trim().toLowerCase());
    }

    const ourClanTag = normalizeTag(String(body?.ourClanTag ?? ''));
    const opponentClanTag = normalizeTag(String(body?.opponentClanTag ?? ''));

    if (!ourClanTag) {
      return NextResponse.json(
        { success: false, error: 'ourClanTag is required.' },
        { status: 400 },
      );
    }

    await requirePermission(req, 'canRunWarAnalysis', { clanTag: ourClanTag });

    const plan = await fetchWarPlanRecord(supabase, ourClanTag, opponentClanTag || undefined);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'War plan not found.' },
        { status: 404 },
      );
    }

    const mapFallback = (input: unknown): WarPlanProfile[] => {
      if (!Array.isArray(input)) return [];
      const profiles: WarPlanProfile[] = [];
      for (const entry of input) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const tag = normalizeTag(String(record.tag ?? ''));
        if (!tag) continue;
        profiles.push({
          tag,
          name: typeof record.name === 'string' ? record.name : null,
          clanTag: typeof record.clanTag === 'string' ? normalizeTag(record.clanTag) : null,
          thLevel: typeof record.thLevel === 'number' ? record.thLevel : null,
          rankedTrophies: typeof record.rankedTrophies === 'number' ? record.rankedTrophies : null,
          warStars: typeof record.warStars === 'number' ? record.warStars : null,
          heroLevels:
            record.heroLevels && typeof record.heroLevels === 'object'
              ? (record.heroLevels as Record<string, number | null>)
              : null,
        });
      }
      return profiles;
    };

    const { plan: queuedPlan } = await queueWarPlanAnalysis(supabase, plan, {
      ourFallback: mapFallback(body?.ourRoster),
      opponentFallback: mapFallback(body?.opponentRoster),
      initiatedBy: 'plan:manual',
      dedupe: false,
      useAI,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: queuedPlan.id,
        ourClanTag: queuedPlan.our_clan_tag,
        opponentClanTag: queuedPlan.opponent_clan_tag,
        ourSelection: queuedPlan.our_selection,
        opponentSelection: queuedPlan.opponent_selection,
        analysis: queuedPlan.analysis,
        analysisStatus: queuedPlan.analysis_status ?? 'queued',
        analysisJobId: queuedPlan.analysis_job_id ?? null,
        analysisStartedAt: queuedPlan.analysis_started_at ?? null,
        analysisCompletedAt: queuedPlan.analysis_completed_at ?? null,
        analysisVersion: queuedPlan.analysis_version ?? null,
        updatedAt: queuedPlan.updated_at,
        useAI,
      },
    });
  } catch (error) {
    if (error instanceof Response && (error.status === 401 || error.status === 403)) {
      return error;
    }
    console.error('[war-planning/plan/analyze] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to regenerate analysis. Please try again.',
      },
      { status: 500 },
    );
  }
}
