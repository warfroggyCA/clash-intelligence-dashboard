import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/api/role-check';
import { requireLeadership } from '@/lib/api/role-check';
import {
  WAR_PLAN_SELECT_FIELDS,
  fetchWarPlanRecord,
  type WarPlanRecord,
} from '@/lib/war-planning/service';
import { queueWarPlanAnalysis } from '@/lib/war-planning/analysis-job';
import type { WarPlanProfile } from '@/lib/war-planning/analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PlanPayload {
  ourClanTag: string;
  opponentClanTag: string;
  ourSelected: string[];
  opponentSelected: string[];
  ourRoster?: WarPlanProfile[];
  opponentRoster?: WarPlanProfile[];
  useAI?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const ourClanTag = normalizeTag(searchParams.get('ourClanTag') ?? '');
    const opponentClanTagRaw = searchParams.get('opponentClanTag');
    const opponentClanTag = opponentClanTagRaw ? normalizeTag(opponentClanTagRaw) : null;

    if (!ourClanTag) {
      return NextResponse.json(
        { success: false, error: 'ourClanTag query parameter is required.' },
        { status: 400 },
      );
    }

    await requirePermission(req, 'canViewWarPrep', { clanTag: ourClanTag });

    const record = await fetchWarPlanRecord(supabase, ourClanTag, opponentClanTag ?? undefined);

    return NextResponse.json({
      success: true,
      data: record
        ? { ...serializePlan(record), useAI: detectAIUsage(record) }
        : null,
    });
  } catch (error) {
    if (error instanceof Response && (error.status === 401 || error.status === 403)) {
      return error;
    }
    console.error('[war-planning/plan] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load war plan. Please try again.',
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const payload = await parsePlanPayload(req);
    const aiEnabled = payload.useAI ?? true;

    await requirePermission(req, 'canManageWarPlans', { clanTag: payload.ourClanTag });

    const upsertResult = await supabase
      .from('war_plans')
      .upsert(
        {
          our_clan_tag: payload.ourClanTag,
          opponent_clan_tag: payload.opponentClanTag,
          our_selection: payload.ourSelected,
          opponent_selection: payload.opponentSelected,
          analysis_status: 'queued',
          analysis: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'our_clan_tag, opponent_clan_tag', ignoreDuplicates: false },
      )
      .select(WAR_PLAN_SELECT_FIELDS)
      .single<WarPlanRecord>();

    if (upsertResult.error) {
      console.error('[war-planning/plan] Supabase upsert error', upsertResult.error);
      throw upsertResult.error;
    }

    const { plan: queuedPlan } = await queueWarPlanAnalysis(supabase, upsertResult.data, {
      ourFallback: payload.ourRoster,
      opponentFallback: payload.opponentRoster,
      initiatedBy: 'plan:save',
      useAI: aiEnabled,
    });

    return NextResponse.json({
      success: true,
      data: { ...serializePlan(queuedPlan), useAI: aiEnabled },
    });
  } catch (error) {
    if (error instanceof Response && (error.status === 401 || error.status === 403)) {
      return error;
    }
    console.error('[war-planning/plan] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save war plan. Please try again.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = await req.json().catch(() => ({}));
    const ourClanTag = normalizeTag(body?.ourClanTag ?? '');
    const opponentClanTag = normalizeTag(body?.opponentClanTag ?? '');

    if (!ourClanTag) {
      return NextResponse.json(
        { success: false, error: 'ourClanTag is required.' },
        { status: 400 },
      );
    }

    await requirePermission(req, 'canManageWarPlans', { clanTag: ourClanTag });

    const builder = supabase.from('war_plans').delete().eq('our_clan_tag', ourClanTag);
    const query = opponentClanTag ? builder.eq('opponent_clan_tag', opponentClanTag) : builder;
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response && (error.status === 401 || error.status === 403)) {
      return error;
    }
    console.error('[war-planning/plan] DELETE failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete war plan. Please try again.',
      },
      { status: 500 },
    );
  }
}

async function parsePlanPayload(req: NextRequest): Promise<PlanPayload> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const ourClanTag = normalizeTag(String(body?.ourClanTag ?? ''));
  const opponentClanTag = normalizeTag(String(body?.opponentClanTag ?? ''));
  const ourSelected = normalizeTags(body?.ourSelected);
  const opponentSelected = normalizeTags(body?.opponentSelected);
  const rawUseAI = body?.useAI;
  let useAI = true;
  if (typeof rawUseAI === 'boolean') {
    useAI = rawUseAI;
  } else if (typeof rawUseAI === 'string') {
    useAI = !['false', '0', 'no', 'off'].includes(rawUseAI.trim().toLowerCase());
  }

  if (!ourClanTag || !opponentClanTag) {
    throw new Error('ourClanTag and opponentClanTag are required.');
  }
  if (!ourSelected.length || !opponentSelected.length) {
    throw new Error('Both ourSelected and opponentSelected must contain at least one tag.');
  }

  const mapRosterFallback = (input: unknown): WarPlanProfile[] => {
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

  return {
    ourClanTag,
    opponentClanTag,
    ourSelected,
    opponentSelected,
    ourRoster: mapRosterFallback(body?.ourRoster),
    opponentRoster: mapRosterFallback(body?.opponentRoster),
    useAI,
  };
}

function serializePlan(row: WarPlanRecord) {
  return {
    id: row.id,
    ourClanTag: row.our_clan_tag,
    opponentClanTag: row.opponent_clan_tag,
    ourSelection: row.our_selection ?? [],
    opponentSelection: row.opponent_selection ?? [],
    analysis: row.analysis ?? null,
    analysisStatus: row.analysis_status ?? 'pending',
    analysisJobId: row.analysis_job_id ?? null,
    analysisStartedAt: row.analysis_started_at ?? null,
    analysisCompletedAt: row.analysis_completed_at ?? null,
    analysisVersion: row.analysis_version ?? null,
    updatedAt: row.updated_at,
  };
}

function detectAIUsage(row: WarPlanRecord | null): boolean {
  if (!row?.analysis) return true;
  const source = row.analysis?.briefing?.source;
  return source === 'openai';
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === 'string' ? normalizeTag(tag) : ''))
    .filter((tag): tag is string => Boolean(tag));
}
