import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cfg } from '@/lib/config';

type PublicRosterMember = {
  tag: string;
  name: string | null;
  thLevel: number | null;
  role: string | null;
};

function resolveClanTag(req: NextRequest): string | null {
  // Prefer middleware-injected header (host-aware)
  const headerTag = req.headers.get('x-clan-tag');
  const normalizedHeader = headerTag ? normalizeTag(headerTag) : null;
  if (normalizedHeader) return normalizedHeader;

  // Fallback: home clan (safe default for localhost/dev)
  const home = normalizeTag(cfg.homeClanTag || '');
  return home || null;
}

export async function GET(req: NextRequest) {
  try {
    const clanTag = resolveClanTag(req);
    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'Clan tag unavailable.' },
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
      return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
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
        data: {
          clan: { tag: clanRow.tag, name: clanRow.name },
          roster: [],
          lastUpdated: null,
        },
      });
    }

    const { data: statsRows, error: statsError } = await supabase
      .from('member_snapshot_stats')
      .select('member_id, th_level, role')
      .eq('snapshot_id', latestSnapshot.id);

    if (statsError) throw statsError;

    if (!statsRows?.length) {
      return NextResponse.json({
        success: true,
        data: {
          clan: { tag: clanRow.tag, name: clanRow.name },
          roster: [],
          lastUpdated: latestSnapshot.fetched_at ?? null,
        },
      });
    }

    const memberIds = statsRows.map((row) => row.member_id).filter(Boolean);

    const { data: members, error: memberError } = await supabase
      .from('members')
      .select('id, tag, name')
      .in('id', memberIds);

    if (memberError) throw memberError;

    const memberLookup = new Map((members || []).map((m) => [m.id, m]));

    const roster: PublicRosterMember[] = statsRows.reduce<PublicRosterMember[]>((acc, row) => {
      const member = memberLookup.get(row.member_id);
      if (!member) return acc;
      const tag = normalizeTag(member.tag ?? '');
      if (!tag) return acc;
      acc.push({
        tag,
        name: member.name ?? tag,
        thLevel: row.th_level ?? null,
        role: row.role ?? null,
      });
      return acc;
    }, []);

    roster.sort((a, b) => (b.thLevel ?? 0) - (a.thLevel ?? 0));

    // Public endpoint: minimal payload only.
    return NextResponse.json({
      success: true,
      data: {
        clan: { tag: clanRow.tag, name: clanRow.name },
        roster,
        lastUpdated: latestSnapshot.fetched_at ?? null,
      },
    });
  } catch (error) {
    console.error('[api/public/roster] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load roster.',
      },
      { status: 500 },
    );
  }
}
