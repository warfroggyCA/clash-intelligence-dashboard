import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import type { CwlResultInput } from '@/types/cwl';

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
 * GET /api/cwl/result?clanTag=X&seasonId=Y&dayIndex=N (optional)
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/result');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag');
  const seasonId = searchParams.get('seasonId');
  const dayIndex = searchParams.get('dayIndex');
  
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
      return json({ success: true, data: dayIndex ? null : [] });
    }
    
    let query = supabase
      .from('cwl_day_results')
      .select('*')
      .eq('cwl_season_id', season.id);
    
    if (dayIndex) {
      query = query.eq('day_index', parseInt(dayIndex, 10));
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error('[cwl/result] Error fetching:', error);
        return json({ success: false, error: 'Failed to fetch result' }, { status: 500 });
      }
      
      return json({ success: true, data });
    } else {
      query = query.order('day_index', { ascending: true });
      const { data, error } = await query;
      
      if (error) {
        console.error('[cwl/result] Error fetching:', error);
        return json({ success: false, error: 'Failed to fetch results' }, { status: 500 });
      }
      
      return json({ success: true, data });
    }
  } catch (error: any) {
    console.error('[cwl/result] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/cwl/result
 * Body: { clanTag, seasonId, result: CwlResultInput, enteredBy?: string }
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/result');
  const body = await request.json().catch(() => null);
  
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  
  const { clanTag: clanTagParam, seasonId, result, enteredBy } = body as {
    clanTag: string;
    seasonId: string;
    result: CwlResultInput;
    enteredBy?: string;
  };
  
  if (!clanTagParam || !seasonId || !result?.dayIndex) {
    return json({ success: false, error: 'clanTag, seasonId, and result with dayIndex are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    const seasonUuid = await getOrCreateSeason(supabase, clanTag, seasonId);
    
    const row = {
      cwl_season_id: seasonUuid,
      day_index: result.dayIndex,
      result: result.result || null,
      our_stars: result.ourStars ?? null,
      opponent_stars: result.opponentStars ?? null,
      our_destruction_pct: result.ourDestructionPct ?? null,
      opponent_destruction_pct: result.opponentDestructionPct ?? null,
      entered_by: enteredBy || null,
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('cwl_day_results')
      .upsert(row, { onConflict: 'cwl_season_id,day_index' })
      .select()
      .single();
    
    if (error) {
      console.error('[cwl/result] Error upserting:', error);
      return json({ success: false, error: 'Failed to save result' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[cwl/result] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

