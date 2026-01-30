import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { verifyPlayerToken } from '@/lib/coc';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { cfg } from '@/lib/config';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';

// Determinstic email generation based on player tag
const getAuthEmail = (tag: string) => `${tag.replace('#', '').toLowerCase()}@clashintelligence.local`;

export const dynamic = 'force-dynamic';

type Body = {
  playerTag?: string;
  apiToken?: string;
  clanTag?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const clanTag = normalizeTag(body.clanTag || cfg.homeClanTag || '');
    const playerTag = body.playerTag ? normalizeTag(body.playerTag) : null;
    const apiToken = typeof body.apiToken === 'string' ? body.apiToken.trim() : '';

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag not configured.' }, { status: 400 });
    }

    if (!playerTag || !isValidTag(playerTag)) {
      return NextResponse.json({ success: false, error: 'Invalid player tag.' }, { status: 400 });
    }

    if (!apiToken) {
      return NextResponse.json({ success: false, error: 'API token is required.' }, { status: 400 });
    }

    // 1. Verify token ownership with CoC API (via Fixie)
    const ok = await verifyPlayerToken(playerTag, apiToken);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Token verification failed. Please check the token in your game settings.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // 2. Verify the tag belongs to the current clan roster.
    const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase: supabaseAdmin });
    if (!latestSnapshot) {
      return NextResponse.json(
        { success: false, error: 'Clan roster data not available. Try again later.' },
        { status: 404 },
      );
    }

    const { members } = await resolveRosterMembers({
      supabase: supabaseAdmin,
      clanTag,
      snapshotId: latestSnapshot.snapshotId,
      snapshotDate: latestSnapshot.snapshotDate,
    });

    const rosterMember = members.find((m) => normalizeTag(m.tag) === playerTag);
    if (!rosterMember) {
      return NextResponse.json(
        { success: false, error: 'This player is not currently on the clan roster.' },
        { status: 403 },
      );
    }

    // 3. Ensure Auth User exists & update password to current token
    const email = getAuthEmail(playerTag);
    
    // Look up existing auth user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === email);
    let userId: string;

    if (existingUser) {
      // User exists - update their password to the current valid token
      const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: apiToken }
      );
      if (updateError) throw updateError;
      userId = updated.user.id;
    } else {
      // Create new auth user using token as password
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: apiToken,
        email_confirm: true,
        user_metadata: { name: rosterMember.name }
      });
      if (createError) throw createError;
      userId = created.user.id;
    }

    // 4. Ensure user_roles record exists and has the correct player_tag
    const { data: clanRow } = await supabaseAdmin.from('clans').select('id').eq('tag', clanTag).maybeSingle();
    if (clanRow) {
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('clan_id', clanRow.id)
        .maybeSingle();

      if (existingRole) {
        await supabaseAdmin.from('user_roles').update({ player_tag: playerTag }).eq('id', existingRole.id);
      } else {
        await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          clan_id: clanRow.id,
          player_tag: playerTag,
          role: 'member'
        });
      }
    }

    // Return the email so the client can perform the sign-in with the token they already have
    return NextResponse.json({ 
      success: true, 
      data: { 
        email,
        playerTag 
      } 
    });
  } catch (error: any) {
    console.error('[api/auth/magic-link] POST failed', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to authenticate.' }, { status: 500 });
  }
}
