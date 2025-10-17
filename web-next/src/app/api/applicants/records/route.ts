import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

const ClanTagParam = z.object({
  clanTag: z.string().min(3),
  status: z.union([z.string(), z.array(z.string())]).optional(),
});

const CreateBody = z.object({
  clanTag: z.string().min(3),
  playerTag: z.string().min(3),
  playerName: z.string().optional(),
  status: z.string().optional(),
  score: z.number().optional(),
  recommendation: z.string().optional(),
  rushPercent: z.number().optional(),
  evaluation: z.record(z.any()),
  applicant: z.record(z.any()),
});

const UpdateBody = z.object({
  clanTag: z.string().min(3),
  playerTag: z.string().min(3),
  status: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/records');
  try {
    const parsed = ClanTagParam.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    const clanTag = normalizeTag(parsed.data.clanTag || '');
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Invalid clanTag' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('applicant_evaluations')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });

    if (parsed.data.status) {
      const statuses = Array.isArray(parsed.data.status)
        ? parsed.data.status.map((status) => String(status))
        : String(parsed.data.status).split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch applicant evaluations', { error });
      return json({ success: false, error: 'Failed to load applicants' }, { status: 500 });
    }

    return json({ success: true, data });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to load applicants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/records');
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const clanTag = normalizeTag(parsed.data.clanTag);
    const playerTag = normalizeTag(parsed.data.playerTag);
    if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
      return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('applicant_evaluations')
      .upsert({
        clan_tag: clanTag,
        player_tag: playerTag,
        player_name: parsed.data.playerName ?? null,
        status: parsed.data.status ?? 'shortlisted',
        score: parsed.data.score ?? null,
        recommendation: parsed.data.recommendation ?? null,
        rush_percent: parsed.data.rushPercent ?? null,
        evaluation: parsed.data.evaluation,
        applicant: parsed.data.applicant,
      }, { onConflict: 'clan_tag,player_tag' });

    if (error) {
      logger.error('Failed to upsert applicant evaluation', { error });
      return json({ success: false, error: 'Failed to persist applicant' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to persist applicant' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/records');
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const clanTag = normalizeTag(parsed.data.clanTag);
    const playerTag = normalizeTag(parsed.data.playerTag);
    if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
      return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('applicant_evaluations')
      .update({ status: parsed.data.status })
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag);

    if (error) {
      logger.error('Failed to update applicant status', { error });
      return json({ success: false, error: 'Failed to update applicant' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to update applicant' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/applicants/records');
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = UpdateBody.safeParse({
      clanTag: params.clanTag,
      playerTag: params.playerTag,
      status: 'ignored',
    });
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const clanTag = normalizeTag(parsed.data.clanTag);
    const playerTag = normalizeTag(parsed.data.playerTag);
    if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
      return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('applicant_evaluations')
      .delete()
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag);

    if (error) {
      logger.error('Failed to delete applicant record', { error });
      return json({ success: false, error: 'Failed to delete applicant' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to delete applicant' }, { status: 500 });
  }
}

