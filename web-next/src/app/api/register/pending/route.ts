import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getActiveClanConfig } from '@/lib/active-clan';
import { requireRole } from '@/lib/auth/guards';
import { normalizeTag } from '@/lib/tags';
import type { ApiResponse, PendingRegistration } from '@/types';

export const dynamic = 'force-dynamic';

const StatusFilterSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.toLowerCase() : 'pending'))
  .refine((value) => ['pending', 'approved', 'rejected', 'expired', 'all'].includes(value), {
    message: 'Invalid status filter',
  });

interface PendingRegistrationRow {
  id: string;
  clan_tag: string;
  player_tag: string;
  verification_code: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
}

function mapRegistration(row: PendingRegistrationRow): PendingRegistration {
  return {
    id: row.id,
    clanTag: row.clan_tag,
    playerTag: row.player_tag,
    verificationCode: row.verification_code,
    status: row.status as PendingRegistration['status'],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at,
  };
}

async function fetchPlayerDetails(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  playerTag: string,
) {
  try {
    const { data } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('player_tag', playerTag)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { playerName: null, snapshotDate: null };
    }

    const playerName = data.payload?.member?.name ?? null;
    const snapshotDate = data.snapshot_date ?? null;
    return { playerName, snapshotDate };
  } catch (error) {
    console.warn('[register/pending] Failed to load player context', { playerTag, error });
    return { playerName: null, snapshotDate: null };
  }
}

export async function GET(req: NextRequest) {
  const { json, logger } = createApiContext(req, 'register:pending');
  try {
    const { searchParams } = new URL(req.url);
    const requestedStatus = StatusFilterSchema.parse(searchParams.get('status'));
    const clanTagParam = searchParams.get('clanTag') || getActiveClanConfig().clanTag;
    const normalizedClan = normalizeTag(clanTagParam || '');

    if (!normalizedClan) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    await requireRole(req, ['leader', 'coleader'], { clanTag: normalizedClan });

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('pending_registrations')
      .select('*')
      .eq('clan_tag', normalizedClan)
      .order('created_at', { ascending: false });

    if (requestedStatus !== 'all') {
      query = query.eq('status', requestedStatus);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to load pending registrations', { error: error.message });
      return json({ success: false, error: 'Failed to load registrations' }, { status: 500 });
    }

    const rows = data ?? [];
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const details = await fetchPlayerDetails(supabase, row.player_tag);
        return {
          ...mapRegistration(row),
          playerName: details.playerName,
          snapshotDate: details.snapshotDate,
        };
      }),
    );

    return json<{ registrations: Array<PendingRegistration & { playerName: string | null; snapshotDate: string | null }> }>({
      success: true,
      data: { registrations: enriched },
    });
  } catch (error: any) {
    if (error instanceof Response || error instanceof NextResponse) {
      throw error;
    }
    logger.error('Unexpected error loading pending registrations', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
