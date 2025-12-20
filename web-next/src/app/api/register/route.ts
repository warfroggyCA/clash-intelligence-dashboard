import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getActiveClanConfig } from '@/lib/active-clan';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { generateVerificationCode } from '@/lib/registration/code-generator';
import { validatePlayerInClan } from '@/lib/registration/validate-player';
import type { ApiResponse, PendingRegistration } from '@/types';

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  const { json, logger } = createApiContext(req, 'register:GET');
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return json({ success: false, error: 'Verification code is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('verification_code', code.toUpperCase())
      .limit(1)
      .maybeSingle<PendingRegistrationRow>();

    if (error) {
      logger.error('Failed to lookup registration status', { code, error: error.message });
      return json({ success: false, error: 'Failed to lookup registration status' }, { status: 500 });
    }

    if (!data) {
      return json({ success: false, error: 'Registration not found' }, { status: 404 });
    }

    return json<PendingRegistration>({ success: true, data: mapRegistration(data) });
  } catch (error: any) {
    logger.error('Unexpected GET /api/register error', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

interface RegisterPayload {
  playerTag?: string;
}

export async function POST(req: NextRequest) {
  const { json, logger } = createApiContext(req, 'register:POST');
  try {
    const payload = (await req.json()) as RegisterPayload;
    const submittedTag = payload?.playerTag || '';
    const normalizedPlayerTag = normalizeTag(submittedTag);

    if (!isValidTag(normalizedPlayerTag)) {
      return json({ success: false, error: 'Enter a valid player tag (e.g., #2PR8R8V8P)' }, { status: 400 });
    }

    const clanConfig = await getActiveClanConfig();
    const normalizedClan = normalizeTag(clanConfig?.clanTag || '');
    if (!normalizedClan) {
      return json({ success: false, error: 'Clan context missing. Try again later.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name')
      .eq('tag', normalizedClan)
      .maybeSingle();

    if (clanError || !clanRow) {
      logger.error('Clan not found when attempting registration', { normalizedClan, error: clanError?.message });
      return json({ success: false, error: 'Clan is not registered with Clash Intelligence yet' }, { status: 400 });
    }

    const { data: priorRole, error: roleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('clan_id', clanRow.id)
      .eq('player_tag', normalizedPlayerTag)
      .limit(1)
      .maybeSingle();

    if (roleError && roleError.code !== 'PGRST116') {
      logger.error('Failed to check existing roles', { error: roleError.message });
      return json({ success: false, error: 'Unable to verify existing access' }, { status: 500 });
    }

    if (priorRole) {
      return json({ success: false, error: 'This player already has dashboard access. Contact leadership if you cannot sign in.' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const { data: pendingExisting, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('id, verification_code, expires_at')
      .eq('clan_tag', normalizedClan)
      .eq('player_tag', normalizedPlayerTag)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError && pendingError.code !== 'PGRST116') {
      logger.error('Failed to check existing pending registrations', { error: pendingError.message });
      return json({ success: false, error: 'Unable to verify pending registrations' }, { status: 500 });
    }

    if (pendingExisting) {
      return json({
        success: false,
        error: `You already have a pending code (${pendingExisting.verification_code}). Post it in clan chat or wait for it to expire.`,
      }, { status: 409 });
    }

    const validation = await validatePlayerInClan(normalizedPlayerTag, normalizedClan, { supabase });
    if (!validation.ok) {
      return json({ success: false, error: validation.reason || 'Player not found in clan roster' }, { status: 400 });
    }

    const verificationCode = await generateVerificationCode({
      ensureUnique: async (candidate) => {
        const { data, error } = await supabase
          .from('pending_registrations')
          .select('id')
          .eq('verification_code', candidate)
          .limit(1)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') {
          logger.warn('Verification code uniqueness check failed', { candidate, error: error.message });
          return false;
        }
        return !data;
      },
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from('pending_registrations')
      .insert({
        clan_tag: normalizedClan,
        player_tag: normalizedPlayerTag,
        verification_code: verificationCode,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single<PendingRegistrationRow>();

    if (insertError || !inserted) {
      logger.error('Failed to insert pending registration', { error: insertError?.message });
      return json({ success: false, error: 'Failed to create registration' }, { status: 500 });
    }

    logger.info('Pending registration created', {
      clan: normalizedClan,
      playerTag: normalizedPlayerTag,
      verificationCode,
    });

    return json<{ registration: PendingRegistration }>({
      success: true,
      data: { registration: mapRegistration(inserted) },
      message: 'Share this code in clan chat for leader approval',
    });
  } catch (error: any) {
    logger.error('Unexpected POST /api/register error', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
