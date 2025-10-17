import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

const StatusEnum = z.enum(['active', 'departed', 'applicant', 'rejected']);

const getQuerySchema = z.object({
  clanTag: z.string(),
  playerTag: z.string().optional(),
  status: z.string().optional(),
});

const upsertSchema = z.object({
  clanTag: z.string(),
  playerTag: z.string(),
  primaryName: z.string(),
  status: StatusEnum.optional(),
  totalTenure: z.number().int().nonnegative().optional(),
  currentStint: z.record(z.any()).nullable().optional(),
  movements: z.array(z.record(z.any())).optional(),
  aliases: z.array(z.record(z.any())).optional(),
  notes: z.array(z.record(z.any())).optional(),
});

const updateSchema = z.object({
  clanTag: z.string(),
  playerTag: z.string(),
  status: StatusEnum.optional(),
  movements: z.array(z.record(z.any())).optional(),
  aliases: z.array(z.record(z.any())).optional(),
  notes: z.array(z.record(z.any())).optional(),
  totalTenure: z.number().int().nonnegative().optional(),
  currentStint: z.record(z.any()).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-history');
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getQuerySchema.safeParse(params);
  if (!parsed.success) {
    return json({ success: false, error: 'clanTag is required' }, { status: 400 });
  }

  const clanTag = normalizeTag(parsed.data.clanTag);
  if (!clanTag || !isValidTag(clanTag)) {
    return json({ success: false, error: 'Invalid clanTag' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('player_history')
    .select('*')
    .eq('clan_tag', clanTag)
    .order('updated_at', { ascending: false });

  if (parsed.data.playerTag) {
    const playerTag = normalizeTag(parsed.data.playerTag);
    if (!playerTag || !isValidTag(playerTag)) {
      return json({ success: false, error: 'Invalid playerTag' }, { status: 400 });
    }
    query = query.eq('player_tag', playerTag);
  }

  if (parsed.data.status) {
    const statuses = parsed.data.status
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('status', statuses);
    }
  }

  const { data, error } = await query;
  if (error) {
    return json({ success: false, error: 'Failed to load player history' }, { status: 500 });
  }

  return json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-history');
  const payload = await request.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(payload);
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
    .from('player_history')
    .upsert({
      clan_tag: clanTag,
      player_tag: playerTag,
      primary_name: parsed.data.primaryName,
      status: parsed.data.status ?? 'applicant',
      total_tenure: parsed.data.totalTenure ?? 0,
      current_stint: parsed.data.currentStint ?? null,
      movements: parsed.data.movements ?? [],
      aliases: parsed.data.aliases ?? [],
      notes: parsed.data.notes ?? [],
    }, { onConflict: 'clan_tag,player_tag' });

  if (error) {
    return json({ success: false, error: 'Failed to upsert player history' }, { status: 500 });
  }

  return json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-history');
  const payload = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const clanTag = normalizeTag(parsed.data.clanTag);
  const playerTag = normalizeTag(parsed.data.playerTag);
  if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
    return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.movements) updates.movements = parsed.data.movements;
  if (parsed.data.aliases) updates.aliases = parsed.data.aliases;
  if (parsed.data.notes) updates.notes = parsed.data.notes;
  if (parsed.data.totalTenure !== undefined) updates.total_tenure = parsed.data.totalTenure;
  if (parsed.data.currentStint !== undefined) updates.current_stint = parsed.data.currentStint;

  if (Object.keys(updates).length === 0) {
    return json({ success: false, error: 'No updates provided' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('player_history')
    .update(updates)
    .eq('clan_tag', clanTag)
    .eq('player_tag', playerTag);

  if (error) {
    return json({ success: false, error: 'Failed to update player history' }, { status: 500 });
  }

  return json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-history');
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getQuerySchema.safeParse(params);
  if (!parsed.success || !parsed.data.playerTag) {
    return json({ success: false, error: 'clanTag and playerTag are required' }, { status: 400 });
  }

  const clanTag = normalizeTag(parsed.data.clanTag);
  const playerTag = normalizeTag(parsed.data.playerTag);
  if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
    return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('player_history')
    .delete()
    .eq('clan_tag', clanTag)
    .eq('player_tag', playerTag);

  if (error) {
    return json({ success: false, error: 'Failed to delete player history record' }, { status: 500 });
  }

  return json({ success: true });
}

