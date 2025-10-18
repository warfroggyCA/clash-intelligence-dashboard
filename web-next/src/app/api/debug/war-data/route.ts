import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/debug/war-data');
  try {
    const supabase = getSupabaseAdminClient();
    
    // Check war tables
    const [clanWarsResult, clanWarClansResult, clanWarMembersResult, clanWarAttacksResult, playerActivityResult] = await Promise.all([
      supabase.from('clan_wars').select('*').limit(5),
      supabase.from('clan_war_clans').select('*').limit(5),
      supabase.from('clan_war_members').select('*').limit(5),
      supabase.from('clan_war_attacks').select('*').limit(5),
      supabase.from('player_activity_events').select('*').limit(5)
    ]);

    const result = {
      clan_wars: {
        count: clanWarsResult.data?.length || 0,
        data: clanWarsResult.data || [],
        error: clanWarsResult.error?.message || null
      },
      clan_war_clans: {
        count: clanWarClansResult.data?.length || 0,
        data: clanWarClansResult.data || [],
        error: clanWarClansResult.error?.message || null
      },
      clan_war_members: {
        count: clanWarMembersResult.data?.length || 0,
        data: clanWarMembersResult.data || [],
        error: clanWarMembersResult.error?.message || null
      },
      clan_war_attacks: {
        count: clanWarAttacksResult.data?.length || 0,
        data: clanWarAttacksResult.data || [],
        error: clanWarAttacksResult.error?.message || null
      },
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
