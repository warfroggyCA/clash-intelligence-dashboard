import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_LIMIT = 100;

function normalizeHeroLevels(raw: Record<string, any> | undefined | null) {
  const base = { bk: null, aq: null, gw: null, rc: null, mp: null } as Record<string, number | null>;
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base)) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      base[key] = value;
    }
  }
  return base;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawClanTag = searchParams.get('clanTag') ?? '';
    const clanTag = normalizeTag(rawClanTag);

    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'A valid clanTag query parameter is required.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('tag, name')
      .eq('tag', clanTag)
      .maybeSingle();

    if (clanError) {
      throw clanError;
    }

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false })
      .limit(DEFAULT_LIMIT);

    if (snapshotError) {
      throw snapshotError;
    }

    if (!snapshotRows?.length) {
      // Clan not in database - try to fetch from Clash API and store it
      console.log(`[war-planning/opponents] Clan ${clanTag} not found in database, fetching from Clash API...`);
      
      try {
        // Fetch clan data from Clash API
        const clashResponse = await fetch(
          `https://api.clashofclans.com/v1/clans/${encodeURIComponent(clanTag)}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.COC_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!clashResponse.ok) {
          if (clashResponse.status === 404) {
            return NextResponse.json({
              success: false,
              error: 'Clan not found. Please check the clan tag and try again.',
            }, { status: 404 });
          }
          throw new Error(`Clash API error: ${clashResponse.status}`);
        }

        const clashData = await clashResponse.json();
        
        // Store clan in database (only insert columns that exist)
        const { error: insertClanError } = await supabase
          .from('clans')
          .upsert({
            tag: clanTag,
            name: clashData.name,
            logo_url: clashData.badgeUrls?.small || null,
            updated_at: new Date().toISOString(),
          });

        if (insertClanError) {
          console.error('Failed to insert clan:', insertClanError);
        }

        // Return the fresh data
        const members = clashData.memberList || [];
        const opponents = members.map((member: any) => ({
          tag: member.tag,
          name: member.name,
          thLevel: member.townHallLevel,
          role: member.role,
          trophies: member.trophies,
          clanRank: member.clanRank,
          warStars: member.warStars,
          attackWins: member.attackWins,
          defenseWins: member.defenseWins,
          builderHallLevel: member.builderHallLevel,
          lastUpdated: new Date().toISOString(),
          heroLevels: normalizeHeroLevels(null),
        }));

        opponents.sort((a: any, b: any) => (b.trophies ?? 0) - (a.trophies ?? 0));

        return NextResponse.json({
          success: true,
          data: {
            clan: { tag: clanTag, name: clashData.name },
            opponents,
          },
        });

      } catch (error) {
        console.error('[war-planning/opponents] Failed to fetch from Clash API:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch opponent clan data. Please try again.',
        }, { status: 500 });
      }
    }

    const latestByPlayer = new Map<string, (typeof snapshotRows)[number]>();
    for (const row of snapshotRows) {
      if (!row?.player_tag) continue;
      const normalizedTag = normalizeTag(row.player_tag);
      if (!normalizedTag) continue;
      if (!latestByPlayer.has(normalizedTag)) {
        latestByPlayer.set(normalizedTag, row);
      }
    }

    const opponents = Array.from(latestByPlayer.values()).map((row) => {
      const member = (row.payload as any)?.member ?? {};
      const ranked = member.ranked ?? {};
      const war = member.war ?? {};
      const normalizedTag = normalizeTag(row.player_tag);
      const heroes = member.heroLevels ?? (row.payload as any)?.heroLevels ?? {};

      return {
        tag: normalizedTag,
        name: member.name ?? normalizedTag,
        thLevel: member.townHallLevel ?? null,
        role: member.role ?? null,
        trophies: ranked.trophies ?? member.trophies ?? null,
        clanRank: member.clanRank ?? null,
        warStars: war.stars ?? null,
        attackWins: war.attackWins ?? null,
        defenseWins: war.defenseWins ?? null,
        builderHallLevel: member.builderBase?.hallLevel ?? null,
        lastUpdated: row.snapshot_date ?? null,
        heroLevels: normalizeHeroLevels(heroes),
      };
    });

    opponents.sort((a, b) => (b.trophies ?? 0) - (a.trophies ?? 0));

    return NextResponse.json({
      success: true,
      data: {
        clan: clanRow ?? { tag: clanTag, name: null },
        opponents,
      },
    });
  } catch (error) {
    console.error('[war-planning/opponents] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load opponent roster. Please try again.',
      },
      { status: 500 },
    );
  }
}
