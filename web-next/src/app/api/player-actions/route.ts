import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-actions');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const actionType = searchParams.get('type'); // 'tenure' or 'departure'
    
    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let data: any[] = [];
    
    if (!actionType || actionType === 'tenure') {
      let tenureQuery = supabase
        .from('player_tenure_actions')
        .select('*')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false });
      
      if (playerTag) {
        tenureQuery = tenureQuery.eq('player_tag', playerTag);
      }
      
      const { data: tenureData, error: tenureError } = await tenureQuery;
      if (tenureError) {
        console.error('Error fetching tenure actions:', tenureError);
      } else {
        data = [...data, ...(tenureData || []).map(item => ({ ...item, action_type: 'tenure' }))];
      }
    }
    
    if (!actionType || actionType === 'departure') {
      let departureQuery = supabase
        .from('player_departure_actions')
        .select('*')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false });
      
      if (playerTag) {
        departureQuery = departureQuery.eq('player_tag', playerTag);
      }
      
      const { data: departureData, error: departureError } = await departureQuery;
      if (departureError) {
        console.error('Error fetching departure actions:', departureError);
      } else {
        data = [...data, ...(departureData || []).map(item => ({ ...item, action_type: 'departure' }))];
      }
    }
    
    // Sort by created_at descending
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-actions GET:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-actions');
  
  try {
    const body = await request.json();
    const { clanTag, playerTag, playerName, actionType, actionData, createdBy } = body;
    
    if (!clanTag || !playerTag || !actionType) {
      return json({ success: false, error: 'clanTag, playerTag, and actionType are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (actionType === 'tenure') {
      const { action, reason, grantedBy } = actionData;
      if (!action || !['granted', 'revoked'].includes(action)) {
        return json({ success: false, error: 'Invalid tenure action' }, { status: 400 });
      }
      
      const { data: result, error } = await supabase
        .from('player_tenure_actions')
        .insert({
          clan_tag: clanTag,
          player_tag: playerTag,
          player_name: playerName,
          action,
          reason,
          granted_by: grantedBy,
          created_by: createdBy
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating tenure action:', error);
        return json({ success: false, error: 'Failed to create tenure action' }, { status: 500 });
      }
      
      data = { ...result, action_type: 'tenure' };
    } else if (actionType === 'departure') {
      const { reason, departureType } = actionData;
      if (!reason || !departureType || !['voluntary', 'involuntary', 'inactive'].includes(departureType)) {
        return json({ success: false, error: 'Invalid departure data' }, { status: 400 });
      }
      
      const { data: result, error } = await supabase
        .from('player_departure_actions')
        .insert({
          clan_tag: clanTag,
          player_tag: playerTag,
          player_name: playerName,
          reason,
          departure_type: departureType,
          recorded_by: actionData.recordedBy,
          created_by: createdBy
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating departure action:', error);
        return json({ success: false, error: 'Failed to create departure action' }, { status: 500 });
      }
      
      data = { ...result, action_type: 'departure' };
    } else {
      return json({ success: false, error: 'Invalid action type' }, { status: 400 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-actions POST:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
