import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { requireLeadership, getCurrentUserIdentifier } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';

type AssessmentInsert = {
  clan_tag: string;
  player_tag: string;
  player_name?: string | null;
  notes: string;
  context?: Record<string, any> | null;
};

type AssessmentRow = {
  id: string;
  clan_tag: string;
  player_tag: string;
  player_name: string | null;
  notes: string;
  context: Record<string, any> | null;
  created_by: string | null;
  assessed_at: string;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-assessments');

  try {
    const { searchParams } = new URL(request.url);
    const clanTagRaw = searchParams.get('clanTag') || cfg.homeClanTag;
    const playerTagRaw = searchParams.get('playerTag');
    const playerTagsRaw = searchParams.get('playerTags');
    const limitRaw = searchParams.get('limit');

    const clanTag = normalizeTag(clanTagRaw ?? '');
    const playerTag = normalizeTag(playerTagRaw ?? '');
    const limit = limitRaw ? Math.min(50, Math.max(1, Number.parseInt(limitRaw, 10) || 10)) : 10;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }

    await requireLeadership(request, { clanTag });

    const supabase = getSupabaseAdminClient();

    // Batch lookup (used by /new/assess to avoid N+1 requests)
    if (playerTagsRaw && !playerTagRaw) {
      const tags = playerTagsRaw
        .split(',')
        .map((t) => normalizeTag(t.trim()) || t.trim())
        .filter(Boolean)
        .slice(0, 100);

      if (!tags.length) {
        return json({ success: true, data: { latestByTag: {} } });
      }

      const { data: latestRows, error: latestRowsError } = await supabase
        .from('player_assessment_latest')
        .select('player_tag, assessment_id, assessed_at, updated_at')
        .eq('clan_tag', clanTag)
        .in('player_tag', tags);

      if (latestRowsError) {
        return json({ success: false, error: latestRowsError.message }, { status: 500 });
      }

      const latestByTag: Record<string, any> = {};
      for (const row of latestRows ?? []) {
        if (row?.player_tag) {
          latestByTag[row.player_tag] = row;
        }
      }

      return json({ success: true, data: { latestByTag } });
    }

    // Single-player lookup
    if (!playerTag) {
      return json({ success: false, error: 'playerTag is required' }, { status: 400 });
    }

    const { data: latest, error: latestError } = await supabase
      .from('player_assessment_latest')
      .select('assessment_id, assessed_at, updated_at')
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag)
      .maybeSingle();

    if (latestError) {
      return json({ success: false, error: latestError.message }, { status: 500 });
    }

    const { data: history, error: historyError } = await supabase
      .from('player_assessments')
      .select('id, clan_tag, player_tag, player_name, notes, context, created_by, assessed_at, created_at')
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag)
      .order('assessed_at', { ascending: false })
      .limit(limit);

    if (historyError) {
      return json({ success: false, error: historyError.message }, { status: 500 });
    }

    return json({ success: true, data: { latest, history: history ?? [] } });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) return error;
    }
    console.error('[api/player-assessments] GET error', error);
    return json({ success: false, error: error?.message || 'Failed to load assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-assessments');

  try {
    const body = (await request.json().catch(() => null)) as AssessmentInsert | null;
    if (!body) {
      return json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const clanTag = normalizeTag(body.clan_tag || cfg.homeClanTag || '');
    const playerTag = normalizeTag(body.player_tag || '');
    const notes = (body.notes || '').trim();

    if (!clanTag) {
      return json({ success: false, error: 'clan_tag is required' }, { status: 400 });
    }
    if (!playerTag) {
      return json({ success: false, error: 'player_tag is required' }, { status: 400 });
    }
    if (!notes) {
      return json({ success: false, error: 'notes is required' }, { status: 400 });
    }

    await requireLeadership(request, { clanTag });

    const createdBy = await getCurrentUserIdentifier(request, clanTag);

    const supabase = getSupabaseAdminClient();

    const insertPayload = {
      clan_tag: clanTag,
      player_tag: playerTag,
      player_name: body.player_name?.trim() || null,
      notes,
      context: body.context ?? {},
      created_by: createdBy,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('player_assessments')
      .insert(insertPayload)
      .select('id, assessed_at')
      .single();

    if (insertError) {
      return json({ success: false, error: insertError.message }, { status: 500 });
    }

    const { error: latestError } = await supabase
      .from('player_assessment_latest')
      .upsert(
        {
          clan_tag: clanTag,
          player_tag: playerTag,
          assessment_id: inserted.id,
          assessed_at: inserted.assessed_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clan_tag,player_tag' }
      );

    if (latestError) {
      return json({ success: false, error: latestError.message }, { status: 500 });
    }

    return json({ success: true, data: { id: inserted.id, assessed_at: inserted.assessed_at } });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) return error;
    }
    console.error('[api/player-assessments] POST error', error);
    return json({ success: false, error: error?.message || 'Failed to save assessment' }, { status: 500 });
  }
}
