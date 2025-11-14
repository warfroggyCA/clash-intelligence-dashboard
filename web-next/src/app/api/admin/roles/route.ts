import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth/guards';

const RoleEnum = z.enum(['leader', 'coleader', 'elder', 'member', 'viewer']);

async function getClanId(supabase: ReturnType<typeof getSupabaseServerClient>, clanTag: string) {
  const normalized = normalizeTag(clanTag);
  const { data: clanRow, error } = await supabase
    .from('clans')
    .select('id')
    .eq('tag', normalized)
    .single();
  if (error || !clanRow) {
    throw new Error('Clan not found');
  }
  return { id: clanRow.id, tag: normalized };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag;
    const clanTag = normalizeTag(clanTagParam || '');
    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }
    await requireRole(req, ['leader', 'coleader'], { clanTag });
    const clan = await getClanId(supabase, clanTag);

    const { data, error } = await supabase
      .from('user_roles')
      .select('id, user_id, player_tag, role')
      .eq('clan_id', clan.id)
      .order('role', { ascending: false });

    if (error) {
      throw error;
    }

    const roles = await Promise.all(
      (data ?? []).map(async (entry) => {
        const userResponse = await supabase.auth.admin.getUserById(entry.user_id);
        const email = userResponse?.data?.user?.email ?? null;
        return {
          id: entry.id,
          userId: entry.user_id,
          email,
          playerTag: entry.player_tag || '',
          role: entry.role,
        };
      })
    );

    return NextResponse.json({ success: true, data: { roles } });
  } catch (error: any) {
    // Handle NextResponse errors (from requireRole)
    if (error instanceof NextResponse) {
      return error;
    }
    // Handle plain Response errors (legacy)
    if (error instanceof Response) {
      return error;
    }
    const status = error?.message === 'Clan not found' ? 404 : 500;
    const message = error?.message || 'Internal Server Error';
    console.error('[admin/roles] GET error', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

const createSchema = z.object({
  email: z.string().email(),
  playerTag: z.string().optional(),
  role: RoleEnum,
  clanTag: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  playerTag: z.string().optional(),
  role: RoleEnum,
});

export async function POST(req: NextRequest) {
  try {
    const payload = createSchema.parse(await req.json());
    const supabase = getSupabaseServerClient();
    const clanTag = normalizeTag(payload.clanTag || cfg.homeClanTag || '');
    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }
    await requireRole(req, ['leader'], { clanTag });
    const clan = await getClanId(supabase, clanTag);

    const userResponse = await supabase.auth.admin.listUsers();
    const user = userResponse?.data?.users?.find(u => u.email === payload.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found for provided email' }, { status: 404 });
    }

    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: user.id,
        clan_id: clan.id,
        player_tag: payload.playerTag ? normalizeTag(payload.playerTag) : null,
        role: payload.role,
      }, { onConflict: 'user_id,clan_id', ignoreDuplicates: false });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle NextResponse errors (from requireRole)
    if (error instanceof NextResponse) {
      return error;
    }
    // Handle plain Response errors (legacy)
    if (error instanceof Response) {
      return error;
    }
    console.error('[admin/roles] POST error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = updateSchema.parse(await req.json());
    const supabase = getSupabaseServerClient();

    const { data: roleRecord, error: roleError } = await supabase
      .from('user_roles')
      .select('id, clan_id, clans(tag)')
      .eq('id', payload.id)
      .maybeSingle();

    if (roleError || !roleRecord?.clans?.tag) {
      return NextResponse.json({ success: false, error: 'Role entry not found' }, { status: 404 });
    }

    const clanTag = normalizeTag(roleRecord.clans.tag);
    await requireRole(req, ['leader'], { clanTag });

    const { error } = await supabase
      .from('user_roles')
      .update({
        role: payload.role,
        player_tag: payload.playerTag ? normalizeTag(payload.playerTag) : null,
      })
      .eq('id', payload.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle NextResponse errors (from requireRole)
    if (error instanceof NextResponse) {
      return error;
    }
    // Handle plain Response errors (legacy)
    if (error instanceof Response) {
      return error;
    }
    console.error('[admin/roles] PATCH error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id parameter' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: roleRecord, error: roleError } = await supabase
      .from('user_roles')
      .select('id, clans(tag)')
      .eq('id', id)
      .maybeSingle();

    if (roleError || !roleRecord?.clans?.tag) {
      return NextResponse.json({ success: false, error: 'Role entry not found' }, { status: 404 });
    }

    const clanTag = normalizeTag(roleRecord.clans.tag);
    await requireRole(req, ['leader'], { clanTag });

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle NextResponse errors (from requireRole)
    if (error instanceof NextResponse) {
      return error;
    }
    // Handle plain Response errors (legacy)
    if (error instanceof Response) {
      return error;
    }
    console.error('[admin/roles] DELETE error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

