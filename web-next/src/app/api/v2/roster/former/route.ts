import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { sanitizeErrorForApi } from '@/lib/security/error-sanitizer';

export const dynamic = 'force-dynamic';
export const revalidate = 43200;

const querySchema = z.object({
  clanTag: z.string().optional(),
});

type PlayerHistoryRow = {
  player_tag: string;
  primary_name: string | null;
  total_tenure: number | null;
  movements: Array<{ type?: string; date?: string }> | null;
  updated_at: string | null;
};

type MemberRow = {
  tag: string;
  name: string | null;
  role: string | null;
  th_level: number | null;
  league_name: string | null;
  ranked_league_name: string | null;
  ranked_trophies: number | null;
  league_trophies: number | null;
};

const resolveLastDeparture = (movements?: PlayerHistoryRow['movements']): string | null => {
  if (!Array.isArray(movements)) return null;
  let latest: string | null = null;
  for (const movement of movements) {
    if (movement?.type !== 'departed') continue;
    const date = typeof movement?.date === 'string' ? movement.date : null;
    if (!date) continue;
    if (!latest || date > latest) {
      latest = date;
    }
  }
  return latest;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const searchParams = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid query parameters' }, { status: 400 });
    }

    const requestedTag = parsed.data.clanTag || cfg.homeClanTag || '';
    const clanTag = normalizeTag(requestedTag);

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'A valid clanTag is required' }, { status: 400 });
    }

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name, logo_url')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) {
      throw clanError;
    }

    if (!clanRow) {
      return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
    }

    const { data: historyRows, error: historyError } = await supabase
      .from('player_history')
      .select('player_tag, primary_name, total_tenure, movements, updated_at')
      .eq('clan_tag', clanTag)
      .eq('status', 'departed')
      .order('updated_at', { ascending: false })
      .returns<PlayerHistoryRow[]>();

    if (historyError) {
      throw historyError;
    }

    const normalizedTags = Array.from(
      new Set(
        (historyRows ?? [])
          .map((row) => normalizeTag(row.player_tag) || row.player_tag)
          .filter((tag): tag is string => Boolean(tag))
      )
    );

    let memberRows: MemberRow[] = [];
    if (normalizedTags.length > 0) {
      const { data, error } = await supabase
        .from('members')
        .select('tag, name, role, th_level, league_name, ranked_league_name, ranked_trophies, league_trophies')
        .eq('clan_id', clanRow.id)
        .in('tag', normalizedTags)
        .returns<MemberRow[]>();

      if (error) {
        throw error;
      }

      memberRows = data ?? [];
    }

    const memberByTag = new Map(
      memberRows.map((row) => [normalizeTag(row.tag) || row.tag, row])
    );

    const formerMembers = (historyRows ?? []).map((row) => {
      const tag = normalizeTag(row.player_tag) || row.player_tag;
      const member = tag ? memberByTag.get(tag) : null;
      const departedAt = resolveLastDeparture(row.movements);
      return {
        tag,
        name: member?.name ?? row.primary_name ?? tag,
        lastRole: member?.role ?? null,
        lastTownHallLevel: member?.th_level ?? null,
        lastLeagueName: member?.league_name ?? null,
        lastRankedLeagueName: member?.ranked_league_name ?? null,
        lastRankedTrophies: member?.ranked_trophies ?? null,
        lastLeagueTrophies: member?.league_trophies ?? null,
        totalTenureDays: row.total_tenure ?? null,
        departedAt,
        updatedAt: row.updated_at ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        clan: {
          id: clanRow.id,
          tag: clanRow.tag,
          name: clanRow.name,
          logo_url: clanRow.logo_url,
        },
        members: formerMembers,
        meta: {
          memberCount: formerMembers.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[roster-former] Error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorForApi(error).message },
      { status: error?.status || 500 }
    );
  }
}
