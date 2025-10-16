import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-notes');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    
    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('player_notes')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });
    
    if (playerTag) {
      query = query.eq('player_tag', playerTag);
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
    const { clanTag, playerTag, playerName, note, customFields = {}, createdBy } = body;
    
    if (!clanTag || !playerTag || !note) {
      return json({ success: false, error: 'clanTag, playerTag, and note are required' }, { status: 400 });
    }
    
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return json({ success: false, error: 'id is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('player_notes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting player note:', error);
      return json({ success: false, error: 'Failed to delete note' }, { status: 500 });
    }
    
    return json({ success: true });
  } catch (error: any) {
    console.error('Error in player-notes DELETE:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
