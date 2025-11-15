import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth/guards';
import type { ClanRoleName } from '@/lib/auth/roles';
import { getCurrentUserIdentifier } from '@/lib/api/role-check';

const VIEW_ROLES: ClanRoleName[] = ['leader', 'coleader', 'elder', 'member', 'viewer'];
const EDIT_ROLES: ClanRoleName[] = ['leader', 'coleader'];

const readSchema = z.object({
  clanTag: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

const createSchema = z.object({
  clanTag: z.string().optional(),
  seasonLabel: z.string().min(2).max(120),
  seasonId: z.string().optional(),
  totalPoints: z.coerce.number().int().min(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid().optional(),
  seasonId: z.string().optional(),
  clanTag: z.string().optional(),
});

type SeasonRow = {
  id: string;
  clan_tag: string;
  season_id: string;
  start_date: string | null;
  end_date: string | null;
  total_points: number | null;
  reward_tier: number | null;
  created_at: string;
  raw: Record<string, any> | null;
};

function mapSeasonRow(row: SeasonRow) {
  return {
    id: row.id,
    clanTag: row.clan_tag,
    seasonId: row.season_id,
    label: row.raw?.label ?? row.season_id,
    startDate: row.start_date,
    endDate: row.end_date,
    totalPoints: row.total_points ?? 0,
    notes: row.raw?.notes ?? null,
    recordedBy: row.raw?.recordedBy ?? null,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = readSchema.safeParse({
    clanTag: searchParams.get('clanTag') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const clanTag = normalizeTag(parsed.data.clanTag || cfg.homeClanTag || '');

  if (!clanTag) {
    return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
  }

  try {
    await requireRole(request, VIEW_ROLES, { clanTag });

    const { data, error } = await supabase
      .from('clan_game_seasons')
      .select('id, clan_tag, season_id, start_date, end_date, total_points, reward_tier, created_at, raw')
      .eq('clan_tag', clanTag)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(parsed.data.limit ?? 12);

    if (error) {
      console.error('[clan-games] GET error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data || []).map(mapSeasonRow) });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    if (error instanceof Response) return error as NextResponse;
    console.error('[clan-games] GET unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clan games history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const payload = createSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const clanTag = normalizeTag(payload.data.clanTag || cfg.homeClanTag || '');

  if (!clanTag) {
    return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
  }

  try {
    await requireRole(request, EDIT_ROLES, { clanTag });
    const recordedBy = await getCurrentUserIdentifier(request, clanTag);
    const label = payload.data.seasonLabel.trim();
    const baseSeasonId = payload.data.seasonId?.trim() || label;
    const normalizedSeasonId = baseSeasonId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      || (payload.data.startDate ?? crypto.randomUUID());

    const { data, error } = await supabase
      .from('clan_game_seasons')
      .insert({
        clan_tag: clanTag,
        season_id: normalizedSeasonId,
        start_date: payload.data.startDate || null,
        end_date: payload.data.endDate || null,
        total_points: payload.data.totalPoints,
        reward_tier: null,
        raw: {
          label,
          notes: payload.data.notes ?? null,
          recordedBy,
        },
      })
      .select('id, clan_tag, season_id, start_date, end_date, total_points, reward_tier, created_at, raw')
      .single();

    if (error) {
      console.error('[clan-games] POST error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: mapSeasonRow(data) });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    if (error instanceof Response) return error as NextResponse;
    console.error('[clan-games] POST unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record clan games entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const parsed = deleteSchema.safeParse({
    id: searchParams.get('id') ?? undefined,
    seasonId: searchParams.get('seasonId') ?? undefined,
    clanTag: searchParams.get('clanTag') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
  }

  if (!parsed.data.id && !parsed.data.seasonId) {
    return NextResponse.json({ success: false, error: 'Provide an id or seasonId' }, { status: 400 });
  }

  const providedClanTag = normalizeTag(parsed.data.clanTag || '');

  try {
    let targetRow: SeasonRow | null = null;

    if (parsed.data.id) {
      const { data, error } = await supabase
        .from('clan_game_seasons')
        .select('id, clan_tag, season_id, start_date, end_date, total_points, reward_tier, created_at, raw')
        .eq('id', parsed.data.id)
        .maybeSingle();

      if (error) throw error;
      targetRow = data;
    } else if (parsed.data.seasonId && providedClanTag) {
      const { data, error } = await supabase
        .from('clan_game_seasons')
        .select('id, clan_tag, season_id, start_date, end_date, total_points, reward_tier, created_at, raw')
        .eq('clan_tag', providedClanTag)
        .eq('season_id', parsed.data.seasonId)
        .maybeSingle();

      if (error) throw error;
      targetRow = data;
    }

    if (!targetRow) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const clanTag = normalizeTag(targetRow.clan_tag);
    await requireRole(request, EDIT_ROLES, { clanTag });

    const { error } = await supabase
      .from('clan_game_seasons')
      .delete()
      .eq('id', targetRow.id)
      .eq('clan_tag', clanTag);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    if (error instanceof Response) return error as NextResponse;
    console.error('[clan-games] DELETE unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete clan games entry' }, { status: 500 });
  }
}

