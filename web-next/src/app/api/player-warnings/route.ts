import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-warnings');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    
    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
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
    const { clanTag, playerTag, playerName, warningNote, createdBy } = body;
    
    if (!clanTag || !playerTag || !warningNote) {
      return json({ success: false, error: 'clanTag, playerTag, and warningNote are required' }, { status: 400 });
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
        player_name: playerName,
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
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    
    if (!clanTag || !playerTag) {
      return json({ success: false, error: 'clanTag and playerTag are required' }, { status: 400 });
    }
    
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
