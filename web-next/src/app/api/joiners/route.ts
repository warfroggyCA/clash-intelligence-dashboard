import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

const getSchema = z.object({
  clanTag: z.string(),
  status: z.string().optional(),
  days: z.coerce.number().optional(),
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'reviewed']),
  reviewedBy: z.string().optional(),
});

const insertSchema = z.object({
  clanTag: z.string(),
  playerTag: z.string(),
  detectedAt: z.string().datetime().optional(),
  sourceSnapshotId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

function normalizeForQuery(tag: string) {
  const normalized = normalizeTag(tag);
  if (!normalized || !isValidTag(normalized)) {
    throw new Error('Invalid clanTag or playerTag');
  }
  return normalized;
}

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/joiners');
  const parsed = getSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return json({ success: false, error: 'clanTag is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const clanTag = normalizeForQuery(parsed.data.clanTag);
    const statusFilters = parsed.data.status
      ? parsed.data.status.split(',').map((value) => value.trim()).filter(Boolean)
      : null;

    let query = supabase
      .from('joiner_events')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('detected_at', { ascending: false });

    if (statusFilters?.length === 1) {
      query = query.eq('status', statusFilters[0]);
    } else if (statusFilters && statusFilters.length > 1) {
      query = query.in('status', statusFilters);
    }

    if (parsed.data.days) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - parsed.data.days);
      query = query.gte('detected_at', cutoff.toISOString());
    }

    const { data: joiners, error } = await query;
    if (error) throw error;

    if (!joiners || joiners.length === 0) {
      return json({ success: true, data: [] });
    }

    const supabaseHistory = await getSupabaseAdminClient()
      .from('player_history')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', joiners.map((joiner) => joiner.player_tag));

    if (supabaseHistory.error) {
      throw supabaseHistory.error;
    }

    const historyMap = new Map(
      (supabaseHistory.data ?? []).map((record) => [record.player_tag, record])
    );

    const playerNotes = await getSupabaseAdminClient()
      .from('player_notes')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', joiners.map((joiner) => joiner.player_tag));

    if (playerNotes.error) {
      throw playerNotes.error;
    }

    const notesMap = new Map<string, any[]>();
    (playerNotes.data ?? []).forEach((note) => {
      const tag = note.player_tag;
      if (!notesMap.has(tag)) {
        notesMap.set(tag, []);
      }
      notesMap.get(tag)!.push(note);
    });

    const playerWarnings = await getSupabaseAdminClient()
      .from('player_warnings')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', joiners.map((joiner) => joiner.player_tag));

    if (playerWarnings.error) {
      throw playerWarnings.error;
    }

    const warningMap = new Map<string, any[]>();
    (playerWarnings.data ?? []).forEach((warning) => {
      const tag = warning.player_tag;
      if (!warningMap.has(tag)) {
        warningMap.set(tag, []);
      }
      warningMap.get(tag)!.push(warning);
    });

    const enrichedJoiners = joiners.map((joiner) => ({
      ...joiner,
      history: historyMap.get(joiner.player_tag) ?? null,
      notes: (notesMap.get(joiner.player_tag) ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      warnings: warningMap.get(joiner.player_tag) ?? [],
    }));

    return json({ success: true, data: enrichedJoiners });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to load joiners' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { json } = createApiContext(request, '/api/joiners');
  const payload = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const updates: Record<string, unknown> = {
      status: parsed.data.status,
    };
    if (parsed.data.status === 'reviewed') {
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = parsed.data.reviewedBy ?? 'System';
    }

    const { error } = await supabase
      .from('joiner_events')
      .update(updates)
      .eq('id', parsed.data.id);

    if (error) throw error;
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to update joiner' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/joiners');
  const payload = await request.json().catch(() => ({}));
  const parsed = insertSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const clanTag = normalizeForQuery(parsed.data.clanTag);
    const playerTag = normalizeForQuery(parsed.data.playerTag);

    const { error } = await supabase
      .from('joiner_events')
      .insert({
        clan_tag: clanTag,
        player_tag: playerTag,
        detected_at: parsed.data.detectedAt ?? new Date().toISOString(),
        source_snapshot_id: parsed.data.sourceSnapshotId ?? null,
        metadata: parsed.data.metadata ?? {},
      });
    if (error) throw error;
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to create joiner record' }, { status: 500 });
  }
}

