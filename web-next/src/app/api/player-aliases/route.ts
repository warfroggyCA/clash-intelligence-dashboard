import { NextRequest, NextResponse } from 'next/server';
import { requireLeadership } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createApiContext } from '@/lib/api-context';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { getLinkedTags, getLinkedTagsWithNames, linkPlayerTags, unlinkPlayerTags, areTagsLinked } from '@/lib/player-aliases';

/**
 * Lookup player name from tag using canonical snapshots or members table
 */
async function lookupPlayerName(clanTag: string, playerTag: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  
  // Try canonical snapshots first (most reliable)
  const { data: snapshot } = await supabase
    .from('canonical_member_snapshots')
    .select('payload')
    .eq('player_tag', playerTag)
    .eq('clan_tag', clanTag)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (snapshot?.payload?.member?.name) {
    return snapshot.payload.member.name;
  }
  
  // Fallback to members table
  const { data: clanRow } = await supabase
    .from('clans')
    .select('id')
    .eq('tag', clanTag)
    .maybeSingle();
  
  if (clanRow?.id) {
    const { data: member } = await supabase
      .from('members')
      .select('name')
      .eq('clan_id', clanRow.id)
      .eq('tag', playerTag)
      .maybeSingle();
    
    if (member?.name) {
      return member.name;
    }
  }
  
  return null;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/player-aliases
 * Fetch all aliases (linked tags) for a player tag
 * 
 * Query params:
 * - clanTag: required
 * - playerTag: required
 * - includeNames: optional, if true returns tags with names
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-aliases');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    const playerTagParam = searchParams.get('playerTag');
    const includeNames = searchParams.get('includeNames') === 'true';
    
    if (!clanTagParam || !playerTagParam) {
      return json({ success: false, error: 'clanTag and playerTag are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam);
    const playerTag = normalizeTag(playerTagParam);
    
    if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
      return json({ success: false, error: 'Invalid clan tag or player tag' }, { status: 400 });
    }

    if (includeNames) {
      const linkedTagsWithNames = await getLinkedTagsWithNames(clanTag, playerTag);
      return json({ success: true, data: linkedTagsWithNames });
    } else {
      const linkedTags = await getLinkedTags(clanTag, playerTag);
      return json({ success: true, data: linkedTags });
    }
  } catch (error: any) {
    console.error('Error in player-aliases GET:', error);
    const { sanitizeErrorForApi } = await import('@/lib/security/error-sanitizer');
    return json({ success: false, error: sanitizeErrorForApi(error).message }, { status: 500 });
  }
}

/**
 * POST /api/player-aliases
 * Create a new alias link between two player tags
 * 
 * Body:
 * - clanTag: required
 * - playerTag1: required
 * - playerTag2: required
 * - createdBy: optional
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-aliases');
  
  try {
    // Require leadership role to create alias links
    requireLeadership(request);
    
    const body = await request.json();
    const { clanTag: clanTagParam, playerTag1, playerTag2, createdBy } = body;
    
    if (!clanTagParam || !playerTag1 || !playerTag2) {
      return json({ success: false, error: 'clanTag, playerTag1, and playerTag2 are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam);
    const tag1 = normalizeTag(playerTag1);
    const tag2 = normalizeTag(playerTag2);
    
    if (!clanTag || !tag1 || !tag2 || !isValidTag(clanTag) || !isValidTag(tag1) || !isValidTag(tag2)) {
      return json({ success: false, error: 'Invalid clan tag or player tags' }, { status: 400 });
    }

    // Validate tag format only - allow linking even if tags don't exist in current clan
    // (they might be former members or from other clans)
    const supabase = getSupabaseAdminClient();

    // Create the link
    const result = await linkPlayerTags(clanTag, tag1, tag2, createdBy);
    
    if (!result.success) {
      return json({ success: false, error: result.error || 'Failed to create alias link' }, { status: 400 });
    }

    // After creating the link, check if either tag has an active warning and propagate it
    try {
      const { data: warnings1 } = await supabase
        .from('player_warnings')
        .select('*')
        .eq('clan_tag', clanTag)
        .eq('player_tag', tag1)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: warnings2 } = await supabase
        .from('player_warnings')
        .select('*')
        .eq('clan_tag', clanTag)
        .eq('player_tag', tag2)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If tag1 has a warning, propagate it to tag2
      if (warnings1) {
        const tag2Name = await lookupPlayerName(clanTag, tag2);
        
        // Deactivate any existing warning for tag2
        await supabase
          .from('player_warnings')
          .update({ is_active: false })
          .eq('clan_tag', clanTag)
          .eq('player_tag', tag2);
        
        // Create propagated warning for tag2
        await supabase
          .from('player_warnings')
          .insert({
            clan_tag: clanTag,
            player_tag: tag2,
            player_name: tag2Name,
            warning_note: `[Propagated from ${tag1}] ${warnings1.warning_note}`,
            is_active: true,
            created_by: createdBy || 'System',
          });
        
        console.log(`[Alias Link] Propagated warning from ${tag1} to ${tag2}`);
      }

      // If tag2 has a warning, propagate it to tag1
      if (warnings2) {
        const tag1Name = await lookupPlayerName(clanTag, tag1);
        
        // Deactivate any existing warning for tag1
        await supabase
          .from('player_warnings')
          .update({ is_active: false })
          .eq('clan_tag', clanTag)
          .eq('player_tag', tag1);
        
        // Create propagated warning for tag1
        await supabase
          .from('player_warnings')
          .insert({
            clan_tag: clanTag,
            player_tag: tag1,
            player_name: tag1Name,
            warning_note: `[Propagated from ${tag2}] ${warnings2.warning_note}`,
            is_active: true,
            created_by: createdBy || 'System',
          });
        
        console.log(`[Alias Link] Propagated warning from ${tag2} to ${tag1}`);
      }
    } catch (propagateError: any) {
      console.error('Error propagating warnings when creating alias link:', propagateError);
      // Don't fail the link creation, just log the error
    }

    return json({ success: true, message: 'Alias link created successfully' });
  } catch (error: any) {
    // Handle 403 Forbidden from requireLeadership
    if (error instanceof Response && error.status === 403) {
      return error;
    }
    console.error('Error in player-aliases POST:', error);
    const { sanitizeErrorForApi } = await import('@/lib/security/error-sanitizer');
    return json({ success: false, error: sanitizeErrorForApi(error).message }, { status: error?.status || 500 });
  }
}

/**
 * DELETE /api/player-aliases
 * Remove an alias link between two player tags
 * 
 * Query params:
 * - clanTag: required
 * - playerTag1: required
 * - playerTag2: required
 */
export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-aliases');
  
  try {
    // Require leadership role to delete alias links
    requireLeadership(request);
    
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    const playerTag1Param = searchParams.get('playerTag1');
    const playerTag2Param = searchParams.get('playerTag2');
    
    if (!clanTagParam || !playerTag1Param || !playerTag2Param) {
      return json({ success: false, error: 'clanTag, playerTag1, and playerTag2 are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam);
    const tag1 = normalizeTag(playerTag1Param);
    const tag2 = normalizeTag(playerTag2Param);
    
    if (!clanTag || !tag1 || !tag2 || !isValidTag(clanTag) || !isValidTag(tag1) || !isValidTag(tag2)) {
      return json({ success: false, error: 'Invalid clan tag or player tags' }, { status: 400 });
    }

    const result = await unlinkPlayerTags(clanTag, tag1, tag2);
    
    if (!result.success) {
      return json({ success: false, error: result.error || 'Failed to remove alias link' }, { status: 400 });
    }

    return json({ success: true, message: 'Alias link removed successfully' });
  } catch (error: any) {
    // Handle 403 Forbidden from requireLeadership
    if (error instanceof Response && error.status === 403) {
      return error;
    }
    console.error('Error in player-aliases DELETE:', error);
    const { sanitizeErrorForApi } = await import('@/lib/security/error-sanitizer');
    return json({ success: false, error: sanitizeErrorForApi(error).message }, { status: error?.status || 500 });
  }
}

