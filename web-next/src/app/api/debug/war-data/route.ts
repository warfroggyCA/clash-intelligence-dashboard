import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/debug/war-data');
  try {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const daysBack = searchParams.get('daysBack') ? Number(searchParams.get('daysBack')) : 120;
    const periodStart = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    
    const warsQuery = supabase
      .from('clan_wars')
      .select('id, clan_tag, war_type, battle_start')
      .gte('battle_start', periodStart)
      .order('battle_start', { ascending: false })
      .limit(50);
    if (clanTag) {
      warsQuery.eq('clan_tag', clanTag);
    }
    const { data: wars, error: warsError } = await warsQuery;
    const warIds = (wars || []).map((w) => w.id);

    const [clanWarClansResult, clanWarMembersResult, clanWarAttacksResult, playerActivityResult] = await Promise.all([
      supabase.from('clan_war_clans').select('*').limit(5),
      warIds.length
        ? supabase.from('clan_war_members').select('war_id, player_tag', { count: 'exact' }).in('war_id', warIds)
        : supabase.from('clan_war_members').select('war_id, player_tag', { count: 'exact' }).limit(5),
      warIds.length
        ? supabase.from('clan_war_attacks').select('war_id, attacker_tag', { count: 'exact' }).in('war_id', warIds)
        : supabase.from('clan_war_attacks').select('war_id, attacker_tag', { count: 'exact' }).limit(5),
      supabase.from('player_activity_events').select('*').limit(5),
    ]);

    const playerMemberCount = playerTag && warIds.length
      ? await supabase
          .from('clan_war_members')
          .select('war_id, player_tag', { count: 'exact' })
          .in('war_id', warIds)
          .eq('player_tag', playerTag)
      : null;
    const playerAttackCount = playerTag && warIds.length
      ? await supabase
          .from('clan_war_attacks')
          .select('war_id, attacker_tag', { count: 'exact' })
          .in('war_id', warIds)
          .eq('attacker_tag', playerTag)
      : null;
    const playerMembersDetail = playerTag && warIds.length
      ? await supabase
          .from('clan_war_members')
          .select('war_id, player_tag, attacks, stars, destruction, raw')
          .in('war_id', warIds)
          .eq('player_tag', playerTag)
          .order('war_id', { ascending: false })
          .limit(10)
      : null;
    const playerAttacksDetail = playerTag && warIds.length
      ? await supabase
          .from('clan_war_attacks')
          .select('war_id, attacker_tag, stars, destruction, attack_time')
          .in('war_id', warIds)
          .eq('attacker_tag', playerTag)
          .order('attack_time', { ascending: false })
          .limit(10)
      : null;

    const result = {
      clan_wars: {
        count: wars?.length || 0,
        data: wars || [],
        error: warsError?.message || null
      },
      clan_war_clans: {
        count: clanWarClansResult.data?.length || 0,
        data: clanWarClansResult.data || [],
        error: clanWarClansResult.error?.message || null
      },
        clan_war_members: {
            count: (clanWarMembersResult.count ?? clanWarMembersResult.data?.length) || 0,
        data: clanWarMembersResult.data || [],
        error: clanWarMembersResult.error?.message || null
      },
        clan_war_attacks: {
            count: (clanWarAttacksResult.count ?? clanWarAttacksResult.data?.length) || 0,
        data: clanWarAttacksResult.data || [],
        error: clanWarAttacksResult.error?.message || null
      },
      player_war_members: playerMemberCount
        ? { count: playerMemberCount.count ?? 0, error: playerMemberCount.error?.message || null }
        : null,
      player_war_attacks: playerAttackCount
        ? { count: playerAttackCount.count ?? 0, error: playerAttackCount.error?.message || null }
        : null,
      player_members_detail: playerMembersDetail
        ? {
            count: playerMembersDetail.data?.length ?? 0,
            data: (playerMembersDetail.data || []).map((row: any) => ({
              war_id: row.war_id,
              attacks: row.attacks,
              stars: row.stars,
              destruction: row.destruction,
              raw_attacks_len: Array.isArray(row.raw?.attacks) ? row.raw.attacks.length : 0,
            })),
            error: playerMembersDetail.error?.message || null,
          }
        : null,
      player_attacks_detail: playerAttacksDetail
        ? {
            count: playerAttacksDetail.data?.length ?? 0,
            data: playerAttacksDetail.data || [],
            error: playerAttacksDetail.error?.message || null,
          }
        : null,
      player_activity_events: {
        count: playerActivityResult.data?.length || 0,
        data: playerActivityResult.data || [],
        error: playerActivityResult.error?.message || null
      }
    };

    return json({ success: true, data: result });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
