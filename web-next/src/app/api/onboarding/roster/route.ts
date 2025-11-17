import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';

type OnboardingRosterMember = {
  tag: string;
  name: string | null;
  thLevel: number | null;
  role: string | null;
  warPreference?: string | null;
  lastUpdated: string | null;
};

function resolveClanTag(req: NextRequest): string | null {
  const headerTag = req.headers.get('x-clan-tag');
  const normalizedHeader = headerTag ? normalizeTag(headerTag) : null;
  if (normalizedHeader) return normalizedHeader;
  return normalizeTag(cfg.homeClanTag || '');
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const clanTag = resolveClanTag(req);
    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'Clan tag unavailable. Contact support.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) throw clanError;
    if (!clanRow) {
      return NextResponse.json(
        { success: false, error: 'Clan not found' },
        { status: 404 },
      );
    }

    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) throw snapshotError;

    if (!latestSnapshot) {
      return NextResponse.json({
        success: true,
        data: { clan: { tag: clanRow.tag, name: clanRow.name }, roster: [] },
      });
    }

    const { data: statsRows, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, th_level, role, war_preference')
      .eq('snapshot_id', latestSnapshot.id);

    if (statsError) throw statsError;

    if (!statsRows?.length) {
      return NextResponse.json({
        success: true,
        data: { clan: { tag: clanRow.tag, name: clanRow.name }, roster: [] },
      });
    }

    const memberIds = statsRows.map((row) => row.member_id).filter(Boolean);
    const { data: members, error: memberError } = await supabase
      .from('members')
      .select('id, tag, name')
      .in('id', memberIds);

    if (memberError) throw memberError;

    const memberLookup = new Map((members || []).map((m) => [m.id, m]));

    const roster: OnboardingRosterMember[] = statsRows.reduce<OnboardingRosterMember[]>((acc, row) => {
      const member = memberLookup.get(row.member_id);
      if (!member) return acc;
      const tag = normalizeTag(member.tag ?? '');
      if (!tag) return acc;
      acc.push({
        tag,
        name: member.name ?? tag,
        thLevel: row.th_level ?? null,
        role: row.role ?? null,
        warPreference: row.war_preference ?? null,
        lastUpdated: latestSnapshot.fetched_at ?? null,
      });
      return acc;
    }, []);

    roster.sort((a, b) => (b.thLevel ?? 0) - (a.thLevel ?? 0));

    return NextResponse.json({
      success: true,
      data: {
        clan: { tag: clanRow.tag, name: clanRow.name },
        roster,
      },
    });
  } catch (error) {
    console.error('[onboarding/roster] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load onboarding roster.',
      },
      { status: 500 },
    );
  }
}

