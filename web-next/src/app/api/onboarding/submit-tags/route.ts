import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';
import { linkPlayerTags } from '@/lib/player-aliases';

type SubmitPayload = {
  clanTag?: string;
  selectedTags?: string[];
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

    const body = (await req.json().catch(() => ({}))) as SubmitPayload;
    const clanTag = resolveClanTag(req, body.clanTag);
    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'Clan tag unavailable. Contact support.' },
        { status: 400 },
      );
    }

    const rawTags = Array.isArray(body.selectedTags) ? body.selectedTags : [];
    const normalizedTags = Array.from(
      new Set(
        rawTags
          .map((tag) => normalizeTag(tag))
          .filter((tag): tag is string => Boolean(tag) && isValidTag(tag)),
      ),
    );

    if (!normalizedTags.length) {
      return NextResponse.json(
        { success: false, error: 'Select at least one valid player tag.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) throw clanError;
    if (!clanRow) {
      return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
    }

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag')
      .eq('clan_tag', clanTag)
      .in('player_tag', normalizedTags)
      .order('snapshot_date', { ascending: false })
      .limit(normalizedTags.length * 3);

    if (snapshotError) throw snapshotError;

    const foundTags = new Set((snapshotRows || []).map((row) => normalizeTag(row.player_tag)));
    const missing = normalizedTags.filter((tag) => !foundTags.has(tag));
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Unknown tags for this clan: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const { data: userRole, error: userRoleError } = await supabase
      .from('user_roles')
      .select('id, player_tag')
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

    const primaryTag = normalizedTags[0];

    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ player_tag: primaryTag })
      .eq('id', userRole.id);

    if (updateError) throw updateError;

    if (normalizedTags.length > 1) {
      for (let i = 1; i < normalizedTags.length; i += 1) {
        try {
          await linkPlayerTags(clanTag, primaryTag, normalizedTags[i], user.email || user.id);
        } catch (linkError) {
          console.warn('[onboarding/submit-tags] Failed to link alias', linkError);
        }
      }
    }

    return NextResponse.json({ success: true, data: { primaryTag, linkedCount: normalizedTags.length } });
  } catch (error) {
    console.error('[onboarding/submit-tags] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to submit onboarding tags.',
      },
      { status: 500 },
    );
  }
}

