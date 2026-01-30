import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';
import { verifyPlayerToken } from '@/lib/coc';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';

export const dynamic = 'force-dynamic';

type Body = {
  clanTag?: string;
  playerTag?: string;
  playerApiToken?: string;
};

function resolveClanTag(req: NextRequest, bodyTag?: string | null): string | null {
  const headerTag = req.headers.get('x-clan-tag');
  const normalizedHeader = headerTag ? normalizeTag(headerTag) : null;
  if (normalizedHeader) return normalizedHeader;
  if (bodyTag) {
    const normalizedBody = normalizeTag(bodyTag);
    if (normalizedBody) return normalizedBody;
  }
  return normalizeTag(cfg.homeClanTag || '');
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const clanTag = resolveClanTag(req, body.clanTag || null);
    const playerTag = body.playerTag ? normalizeTag(body.playerTag) : null;
    const playerApiToken = typeof body.playerApiToken === 'string' ? body.playerApiToken.trim() : '';

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag unavailable. Contact support.' }, { status: 400 });
    }

    if (!playerTag || !isValidTag(playerTag)) {
      return NextResponse.json({ success: false, error: 'Invalid player tag.' }, { status: 400 });
    }

    if (!playerApiToken) {
      return NextResponse.json({ success: false, error: 'Player API token is required.' }, { status: 400 });
    }

    // Verify the token against CoC.
    const ok = await verifyPlayerToken(playerTag, playerApiToken);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Token verification failed. Double-check the in-game API token.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Resolve clan_id from clans table
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) throw clanError;
    if (!clanRow) {
      return NextResponse.json({ success: false, error: 'Clan not found.' }, { status: 404 });
    }

    // Ensure this playerTag belongs to this clan (based on latest roster snapshot)
    const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase });
    if (!latestSnapshot) {
      return NextResponse.json(
        { success: false, error: 'Roster snapshot not found. Try again after the next refresh.' },
        { status: 404 },
      );
    }

    const { members } = await resolveRosterMembers({
      supabase,
      clanTag,
      snapshotId: latestSnapshot.snapshotId,
      snapshotDate: latestSnapshot.snapshotDate,
    });

    const foundTags = new Set(members.map((m) => normalizeTag(m.tag)).filter(Boolean));
    if (!foundTags.has(playerTag)) {
      return NextResponse.json(
        { success: false, error: `That player tag is not currently on the roster for ${clanTag}.` },
        { status: 400 },
      );
    }

    // Update the user's clan role row
    const { data: userRole, error: userRoleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('clan_id', clanRow.id)
      .maybeSingle();

    if (userRoleError) throw userRoleError;
    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'No access record found for this clan.' },
        { status: 403 },
      );
    }

    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ player_tag: playerTag })
      .eq('id', userRole.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: { clanTag, playerTag } });
  } catch (error: any) {
    console.error('[api/account/link-player] POST failed', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to link player.' },
      { status: 500 },
    );
  }
}
