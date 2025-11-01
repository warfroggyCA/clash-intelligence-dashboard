import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';
import { normalizeTag } from '@/lib/tags';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    const playerTagParam = searchParams.get('playerTag');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    
    if (!clanTagParam) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam) ?? clanTagParam;
    const playerTag = playerTagParam ? (normalizeTag(playerTagParam) ?? playerTagParam) : null;
    
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
  
  try {
    const body = await request.json();
    const { clanTag: clanTagParam, playerTag: playerTagParam, playerName, note, customFields = {}, createdBy } = body;
    
    if (!clanTagParam || !playerTagParam || !note) {
      return json({ success: false, error: 'clanTag, playerTag, and note are required' }, { status: 400 });
    }
    
    const clanTag = normalizeTag(clanTagParam) ?? clanTagParam;
    const playerTag = normalizeTag(playerTagParam) ?? playerTagParam;
    
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('player_notes')
      .insert({
        clan_tag: clanTag,
        player_tag: playerTag,
        player_name: playerName,
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
  
  try {
    const body = await request.json();
    const { id, note, customFields } = body;
    
    if (!id || !note) {
      return json({ success: false, error: 'id and note are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
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
  
  try {
    const body = await request.json();
    const { id, archivedBy } = body;
    
    if (!id) {
      return json({ success: false, error: 'id is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('player_notes')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: archivedBy || 'System'
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
  
  try {
    const body = await request.json();
    const { id, action } = body; // action: 'unarchive'
    
    if (!id || !action) {
      return json({ success: false, error: 'id and action are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
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
