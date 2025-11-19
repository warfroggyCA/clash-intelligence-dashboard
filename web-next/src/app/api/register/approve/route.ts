import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth/guards';
import type { ApiResponse, PendingRegistration } from '@/types';

export const dynamic = 'force-dynamic';

const ApproveSchema = z.object({
  registrationId: z.string().uuid(),
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

export async function POST(req: NextRequest) {
  const { json, logger } = createApiContext(req, 'register:approve');

  try {
    const payload = ApproveSchema.parse(await req.json());
    const supabase = getSupabaseServerClient();

    const { data: registration, error: loadError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('id', payload.registrationId)
      .maybeSingle<PendingRegistrationRow>();

    if (loadError) {
      logger.error('Failed to load registration for approval', { error: loadError.message });
      return json({ success: false, error: 'Failed to load registration' }, { status: 500 });
    }

    if (!registration) {
      return json({ success: false, error: 'Registration not found' }, { status: 404 });
    }

    const { user } = await requireRole(req, ['leader', 'coleader'], { clanTag: registration.clan_tag });

    if (registration.status !== 'pending') {
      return json({ success: false, error: 'Registration is not pending' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('pending_registrations')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by_user_id: user?.id ?? null,
      })
      .eq('id', payload.registrationId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle<PendingRegistrationRow>();

    if (updateError) {
      logger.error('Failed to approve registration', { error: updateError.message });
      return json({ success: false, error: 'Failed to approve registration' }, { status: 500 });
    }

    if (!updated) {
      return json({ success: false, error: 'Registration already processed' }, { status: 409 });
    }

    return json<ApiResponse<{ registration: PendingRegistration }>>({
      success: true,
      data: { registration: mapRegistration(updated) },
      message: 'Registration approved',
    });
  } catch (error: any) {
    if (error instanceof Response || error instanceof NextResponse) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      return json({ success: false, error: error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }
    logger.error('Unexpected error approving registration', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
