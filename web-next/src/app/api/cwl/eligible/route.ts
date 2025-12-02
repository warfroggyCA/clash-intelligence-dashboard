import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import type { CwlEligibleInput } from '@/types/cwl';

async function getOrCreateSeason(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanTag: string,
  seasonId: string
) {
  const { data: existing } = await supabase
    .from('cwl_seasons')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();
  
  if (existing) return existing.id;
  
  const { data: created, error } = await supabase
    .from('cwl_seasons')
    .insert({ clan_tag: clanTag, season_id: seasonId, war_size: 15 })
    .select('id')
    .single();
  
  if (error) throw new Error('Failed to create season');
  return created.id;
}

/**
 * GET /api/cwl/eligible?clanTag=X&seasonId=Y
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/eligible');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag');
  const seasonId = searchParams.get('seasonId');
  
  if (!clanTagParam || !seasonId) {
    return json({ success: false, error: 'clanTag and seasonId are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    
    const { data: season } = await supabase
      .from('cwl_seasons')
      .select('id')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();
    
    if (!season) {
      return json({ success: true, data: [] });
    }
    
    const { data, error } = await supabase
      .from('cwl_eligible_members')
      .select('*')
      .eq('cwl_season_id', season.id)
      .order('town_hall', { ascending: false });
    
    if (error) {
      console.error('[cwl/eligible] Error fetching:', error);
      return json({ success: false, error: 'Failed to fetch eligible members' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[cwl/eligible] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/cwl/eligible
 * Body: { clanTag, seasonId, members: CwlEligibleInput[] }
 * Replaces the entire eligible pool for the season
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/eligible');
  const body = await request.json().catch(() => null);
  
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  
  const { clanTag: clanTagParam, seasonId, members } = body as {
    clanTag: string;
    seasonId: string;
    members: CwlEligibleInput[];
  };
  
  if (!clanTagParam || !seasonId || !Array.isArray(members)) {
    return json({ success: false, error: 'clanTag, seasonId, and members array are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    const seasonUuid = await getOrCreateSeason(supabase, clanTag, seasonId);
    
    // Delete existing eligible members for this season
    await supabase
      .from('cwl_eligible_members')
      .delete()
      .eq('cwl_season_id', seasonUuid);
    
    // Insert new members
    if (members.length > 0) {
      const rows = members.map(m => ({
        cwl_season_id: seasonUuid,
        player_tag: normalizeTag(m.playerTag) || m.playerTag,
        player_name: m.playerName || null,
        town_hall: m.townHall || null,
        hero_levels: m.heroLevels || null,
      }));
      
      const { data, error } = await supabase
        .from('cwl_eligible_members')
        .insert(rows)
        .select();
      
      if (error) {
        console.error('[cwl/eligible] Error inserting:', error);
        return json({ success: false, error: 'Failed to save eligible members' }, { status: 500 });
      }
      
      return json({ success: true, data });
    }
    
    return json({ success: true, data: [] });
  } catch (error: any) {
    console.error('[cwl/eligible] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

