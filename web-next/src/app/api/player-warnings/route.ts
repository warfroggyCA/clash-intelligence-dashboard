import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createApiContext } from '@/lib/api-context';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getLinkedTags } from '@/lib/player-aliases';

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

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-warnings');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    const playerTagParam = searchParams.get('playerTag');
    
    if (!clanTagParam) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam) ?? clanTagParam;
    const playerTag = playerTagParam ? (normalizeTag(playerTagParam) ?? playerTagParam) : null;
    
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('player_warnings')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });
    
    if (playerTag) {
      query = query.eq('player_tag', playerTag);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching player warnings:', error);
      return json({ success: false, error: 'Failed to fetch warnings' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-warnings GET:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-warnings');
  
  try {
    const body = await request.json();
    const { clanTag: clanTagParam, playerTag: playerTagParam, playerName, warningNote, createdBy } = body;
    
    if (!clanTagParam || !playerTagParam || !warningNote) {
      return json({ success: false, error: 'clanTag, playerTag, and warningNote are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam) ?? clanTagParam;
    const playerTag = normalizeTag(playerTagParam) ?? playerTagParam;
    
    // If playerName not provided, look it up from tag
    let finalPlayerName = playerName?.trim();
    if (!finalPlayerName || finalPlayerName === 'Unknown Player') {
      const lookedUpName = await lookupPlayerName(clanTag, playerTag);
      if (lookedUpName) {
        finalPlayerName = lookedUpName;
      } else {
        finalPlayerName = playerName || null; // Store what was provided, even if null
      }
    }
    
    const supabase = getSupabaseAdminClient();
    
    // First, deactivate any existing warning for this player
    await supabase
      .from('player_warnings')
      .update({ is_active: false })
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag);
    
    // Then create the new warning
    const { data, error } = await supabase
      .from('player_warnings')
      .insert({
        clan_tag: clanTag,
        player_tag: playerTag,
        player_name: finalPlayerName,
        warning_note: warningNote.trim(),
        is_active: true,
        created_by: createdBy
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating player warning:', error);
      return json({ success: false, error: 'Failed to create warning' }, { status: 500 });
    }

    // Propagate warning to all linked alias accounts
    try {
      const linkedTags = await getLinkedTags(clanTag, playerTag);
      
      if (linkedTags.length > 0) {
        console.log(`[Warning Propagation] Found ${linkedTags.length} linked alias accounts for ${playerTag}`);
        
        // Lookup names for linked tags
        const linkedWarnings = await Promise.all(
          linkedTags.map(async (linkedTag) => {
            const linkedName = await lookupPlayerName(clanTag, linkedTag);
            
            // Deactivate any existing warning for this linked tag
            await supabase
              .from('player_warnings')
              .update({ is_active: false })
              .eq('clan_tag', clanTag)
              .eq('player_tag', linkedTag);
            
            // Create propagated warning
            // Store propagation metadata in the warning note prefix
            return {
              clan_tag: clanTag,
              player_tag: linkedTag,
              player_name: linkedName,
              warning_note: `[Propagated from ${playerTag}] ${warningNote.trim()}`,
              is_active: true,
              created_by: createdBy || 'System',
            };
          })
        );

        // Insert all propagated warnings
        const { error: propagateError } = await supabase
          .from('player_warnings')
          .insert(linkedWarnings);

        if (propagateError) {
          console.error('Error propagating warnings to linked accounts:', propagateError);
          // Don't fail the main warning creation, just log the error
        } else {
          console.log(`[Warning Propagation] Successfully propagated warning to ${linkedWarnings.length} linked accounts`);
        }
      }
    } catch (propagateError: any) {
      console.error('Error during warning propagation:', propagateError);
      // Don't fail the main warning creation, just log the error
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-warnings POST:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-warnings');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    const playerTagParam = searchParams.get('playerTag');
    
    if (!clanTagParam || !playerTagParam) {
      return json({ success: false, error: 'clanTag and playerTag are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam) ?? clanTagParam;
    const playerTag = normalizeTag(playerTagParam) ?? playerTagParam;
    
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('player_warnings')
      .update({ is_active: false })
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag);
    
    if (error) {
      console.error('Error deactivating player warning:', error);
      return json({ success: false, error: 'Failed to remove warning' }, { status: 500 });
    }
    
    return json({ success: true });
  } catch (error: any) {
    console.error('Error in player-warnings DELETE:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
