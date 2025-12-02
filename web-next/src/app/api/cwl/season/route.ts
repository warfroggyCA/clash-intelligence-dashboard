import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import type { CwlSeasonInput } from '@/types/cwl';

/**
 * GET /api/cwl/season?clanTag=X&seasonId=Y
 * Fetch season row with optional alt associations
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/season');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag');
  const seasonId = searchParams.get('seasonId');
  const includeAlts = searchParams.get('includeAlts') === 'true';
  
  if (!clanTagParam || !seasonId) {
    return json({ success: false, error: 'clanTag and seasonId are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Fetch season
    const { data: season, error } = await supabase
      .from('cwl_seasons')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('season_id', seasonId)
      .maybeSingle();
    
    if (error) {
      console.error('[cwl/season] Error fetching season:', error);
      return json({ success: false, error: 'Failed to fetch season' }, { status: 500 });
    }
    
    if (!season) {
      return json({ success: true, data: null });
    }
    
    // Optionally fetch alt associations for eligible members
    let altGroups: Record<string, string[]> = {};
    if (includeAlts && season.id) {
      const { data: eligible } = await supabase
        .from('cwl_eligible_members')
        .select('player_tag')
        .eq('cwl_season_id', season.id);
      
      if (eligible?.length) {
        const tags = eligible.map(e => e.player_tag);
        const { data: links } = await supabase
          .from('player_alias_links')
          .select('player_tag_1, player_tag_2')
          .eq('clan_tag', clanTag);
        
        // Build alt groups from links that match our eligible tags
        if (links?.length) {
          const unionFind = new Map<string, string>();
          const find = (x: string): string => {
            if (!unionFind.has(x)) unionFind.set(x, x);
            if (unionFind.get(x) !== x) unionFind.set(x, find(unionFind.get(x)!));
            return unionFind.get(x)!;
          };
          const union = (a: string, b: string) => {
            unionFind.set(find(a), find(b));
          };
          
          for (const link of links) {
            if (tags.includes(link.player_tag_1) || tags.includes(link.player_tag_2)) {
              union(link.player_tag_1, link.player_tag_2);
            }
          }
          
          const groups = new Map<string, string[]>();
          for (const tag of tags) {
            const root = find(tag);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root)!.push(tag);
          }
          
          for (const [root, members] of groups) {
            if (members.length > 1) {
              altGroups[root] = members;
            }
          }
        }
      }
    }
    
    return json({ 
      success: true, 
      data: { 
        season, 
        ...(includeAlts ? { altGroups } : {})
      } 
    });
  } catch (error: any) {
    console.error('[cwl/season] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/cwl/season
 * Upsert season row
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/season');
  const body = await request.json().catch(() => null) as CwlSeasonInput | null;
  
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  
  const { clanTag: clanTagParam, seasonId, warSize = 15 } = body;
  
  if (!clanTagParam || !seasonId) {
    return json({ success: false, error: 'clanTag and seasonId are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  if (warSize !== 15 && warSize !== 30) {
    return json({ success: false, error: 'warSize must be 15 or 30' }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('cwl_seasons')
      .upsert({
        clan_tag: clanTag,
        season_id: seasonId,
        war_size: warSize,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'clan_tag,season_id',
      })
      .select()
      .single();
    
    if (error) {
      console.error('[cwl/season] Error upserting season:', error);
      return json({ success: false, error: 'Failed to save season' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('[cwl/season] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

