import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';
import { cfg } from '@/lib/config';
import { linkPlayerTags } from '@/lib/player-aliases';
import { verifyPlayerToken } from '@/lib/coc';

type SubmitPayload = {
  clanTag?: string;
  selectedTags?: string[];
  apiToken?: string;
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

    const foundTags = new Set(members.map((member) => normalizeTag(member.tag)).filter(Boolean));
    const missing = normalizedTags.filter((tag) => !foundTags.has(tag));
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Unknown tags for this clan: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    // VERIFICATION STEP:
    // Verify the primary tag using the provided in-game API token.
    const primaryTag = normalizedTags[0];
    const apiToken = body.apiToken?.trim();

    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: 'API token is required for verification.' },
        { status: 400 },
      );
    }

    try {
      // Force Fixie proxy for verification to ensure we use whitelisted IPs
      const isValid = await verifyPlayerToken(primaryTag, apiToken, true);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid API token for the selected player tag.' },
          { status: 400 },
        );
      }
    } catch (verifyError: any) {
      console.error('[onboarding/submit-tags] Token verification failed:', verifyError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify token with Clash of Clans API. Please try again.' },
        { status: 502 },
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

    // primaryTag already computed above (used for verification)
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
