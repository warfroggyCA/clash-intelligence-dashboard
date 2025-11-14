import { NextRequest, NextResponse } from 'next/server';
import { requireLeadership, getCurrentUserIdentifier } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';

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

async function resolveClanTagForNote(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  noteId: string,
  candidate?: string | null
): Promise<string | null> {
  const normalizedCandidate = candidate ? normalizeTag(candidate) : null;
  if (normalizedCandidate) {
    return normalizedCandidate;
  }
  if (!noteId) {
    return null;
  }
  const { data, error } = await supabase
    .from('player_notes')
    .select('clan_tag')
    .eq('id', noteId)
    .maybeSingle();
  if (error) {
    console.error('[player-notes] Failed to resolve clan tag for note', error);
    return null;
  }
  return data?.clan_tag ? normalizeTag(data.clan_tag) : null;
}

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  const { searchParams } = new URL(request.url);
  const clanTagParam = searchParams.get('clanTag');
  const playerTagParam = searchParams.get('playerTag');
  const includeArchived = searchParams.get('includeArchived') === 'true';
  
  if (!clanTagParam) {
    return json({ success: false, error: 'clanTag is required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  const playerTag = playerTagParam ? (normalizeTag(playerTagParam) ?? playerTagParam) : null;
  
  try {
    // Require leadership to view player notes
    await requireLeadership(request, { clanTag });
  } catch (error: any) {
    // Handle 403 Forbidden from requireLeadership
    if (error instanceof Response && error.status === 403) {
      return error;
    }
    if (error instanceof Response && error.status === 401) {
      return error;
    }
    throw error;
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('player_notes')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });
    
    if (playerTag) {
      query = query.eq('player_tag', playerTag);
    }
    
    // Filter out archived items unless explicitly requested
    if (!includeArchived) {
      query = query.is('archived_at', null);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching player notes:', error);
      return json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-notes GET:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  
  const { clanTag: clanTagParam, playerTag: playerTagParam, playerName, note, customFields = {} } = body;
  
  if (!clanTagParam || !playerTagParam || !note) {
    return json({ success: false, error: 'clanTag, playerTag, and note are required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  const playerTag = normalizeTag(playerTagParam);
  
  if (!clanTag || !playerTag) {
    return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
  }
  
  try {
    await requireLeadership(request, { clanTag });
    
    // Automatically get the current user's identifier
    const createdBy = await getCurrentUserIdentifier(request, clanTag);
    
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
    const { data, error } = await supabase
      .from('player_notes')
      .insert({
        clan_tag: clanTag,
        player_tag: playerTag,
        player_name: finalPlayerName,
        note: note.trim(),
        custom_fields: customFields,
        created_by: createdBy
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating player note:', error);
      return json({ success: false, error: 'Failed to create note' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-notes POST:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { id, note, customFields, clanTag: clanTagParam } = body;
  
  if (!id || !note) {
    return json({ success: false, error: 'id and note are required' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdminClient();
  const clanTag = await resolveClanTagForNote(supabase, id, clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Unable to resolve clan for note' }, { status: 404 });
  }
  
  try {
    await requireLeadership(request, { clanTag });
    
    // Note: We don't have updated_by field yet, but we can add it if needed
    // For now, we'll just track the update timestamp
    const { data, error } = await supabase
      .from('player_notes')
      .update({
        note: note.trim(),
        custom_fields: customFields || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating player note:', error);
      return json({ success: false, error: 'Failed to update note' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-notes PUT:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { id, clanTag: clanTagParam } = body;
  
  if (!id) {
    return json({ success: false, error: 'id is required' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdminClient();
  const clanTag = await resolveClanTagForNote(supabase, id, clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Unable to resolve clan for note' }, { status: 404 });
  }
  
  try {
    await requireLeadership(request, { clanTag });
        
    // Automatically get the current user's identifier
    const archivedBy = await getCurrentUserIdentifier(request, clanTag);
    
    const { data, error } = await supabase
      .from('player_notes')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: archivedBy
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error archiving player note:', error);
      return json({ success: false, error: 'Failed to archive note' }, { status: 500 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-notes DELETE (archive):', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { id, action, clanTag: clanTagParam } = body; // action: 'unarchive'
  
  if (!id || !action) {
    return json({ success: false, error: 'id and action are required' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdminClient();
  const clanTag = await resolveClanTagForNote(supabase, id, clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Unable to resolve clan for note' }, { status: 404 });
  }
  
  try {
    await requireLeadership(request, { clanTag });
    let data: any;
    
    if (action === 'unarchive') {
      const { data: result, error } = await supabase
        .from('player_notes')
        .update({
          archived_at: null,
          archived_by: null
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error unarchiving player note:', error);
        return json({ success: false, error: 'Failed to unarchive note' }, { status: 500 });
      }
      
      data = result;
    } else {
      return json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-notes PATCH:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
