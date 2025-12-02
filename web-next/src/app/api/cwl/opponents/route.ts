import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import type { CwlOpponentInput } from '@/types/cwl';

async function getOrCreateSeason(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanTag: string,
  seasonId: string
) {
  // Try to find existing
  const { data: existing } = await supabase
    .from('cwl_seasons')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('season_id', seasonId)
    .maybeSingle();
  
  if (existing) return existing.id;
  
  // Create new
  const { data: created, error } = await supabase
    .from('cwl_seasons')
    .insert({ clan_tag: clanTag, season_id: seasonId, war_size: 15 })
    .select('id')
    .single();
  
  if (error) throw new Error('Failed to create season');
  return created.id;
}

/**
 * GET /api/cwl/opponents?clanTag=X&seasonId=Y
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/opponents');
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
    
    // Get season ID
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
      .from('cwl_opponents')
      .select('*')
      .eq('cwl_season_id', season.id)
      .order('day_index', { ascending: true });
    
    if (error) {
      console.error('[cwl/opponents] Error fetching:', error);
      return json({ success: false, error: 'Failed to fetch opponents' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[cwl/opponents] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/cwl/opponents
 * Body: { clanTag, seasonId, opponents: CwlOpponentInput[] }
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/opponents');
  const body = await request.json().catch(() => null);
  
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  
  const { clanTag: clanTagParam, seasonId, opponents } = body as {
    clanTag: string;
    seasonId: string;
    opponents: CwlOpponentInput[];
  };
  
  if (!clanTagParam || !seasonId || !Array.isArray(opponents)) {
    return json({ success: false, error: 'clanTag, seasonId, and opponents array are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    const seasonUuid = await getOrCreateSeason(supabase, clanTag, seasonId);
    
    // Upsert each opponent
    const rows = opponents.map(opp => ({
      cwl_season_id: seasonUuid,
      day_index: opp.dayIndex,
      opponent_tag: normalizeTag(opp.opponentTag) || opp.opponentTag,
      opponent_name: opp.opponentName || null,
      th_distribution: opp.thDistribution || null,
      roster_snapshot: opp.rosterSnapshot || null,
      fetched_at: opp.rosterSnapshot ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }));
    
    const { data, error } = await supabase
      .from('cwl_opponents')
      .upsert(rows, { onConflict: 'cwl_season_id,day_index' })
      .select();
    
    if (error) {
      console.error('[cwl/opponents] Error upserting:', error);
      return json({ success: false, error: 'Failed to save opponents' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[cwl/opponents] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

