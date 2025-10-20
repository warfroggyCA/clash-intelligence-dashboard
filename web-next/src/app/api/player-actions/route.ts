import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';
import { applyTenureAction } from '@/lib/services/tenure-service';
import { ymdNowUTC } from '@/lib/date';
import { readLedgerEffective } from '@/lib/tenure';
import { normalizeTag } from '@/lib/tags';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-actions');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const playerTag = searchParams.get('playerTag');
    const actionType = searchParams.get('type'); // 'tenure' or 'departure'
    const includeArchived = searchParams.get('includeArchived') === 'true';
    
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
      
      // Filter out archived items unless explicitly requested
      if (!includeArchived) {
        tenureQuery = tenureQuery.is('archived_at', null);
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
      
      // Filter out archived items unless explicitly requested
      if (!includeArchived) {
        departureQuery = departureQuery.is('archived_at', null);
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
    const normalizedClanTag = clanTag ? normalizeTag(clanTag) ?? clanTag : clanTag;
    const normalizedPlayerTag = normalizeTag(playerTag ?? '') ?? playerTag;
    const clanTagForWrite = normalizedClanTag ?? clanTag;
    const playerTagForWrite = normalizedPlayerTag ?? playerTag;
    
    if (!clanTag || !playerTag || !actionType) {
      return json({ success: false, error: 'clanTag, playerTag, and actionType are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (actionType === 'tenure') {
      const { action, reason, grantedBy, tenureDays, asOf } = actionData ?? {};
      if (action && !['granted', 'revoked'].includes(action)) {
        return json({ success: false, error: 'Invalid tenure action' }, { status: 400 });
      }

      const resolvedAction: 'granted' | 'revoked' = action === 'revoked' ? 'revoked' : 'granted';
      let baseDaysCandidate: number | null = null;
      if (typeof tenureDays === 'number' && Number.isFinite(tenureDays)) {
        baseDaysCandidate = tenureDays;
      } else if (typeof tenureDays === 'string' && tenureDays.trim()) {
        const parsed = Number.parseInt(tenureDays, 10);
        if (Number.isFinite(parsed)) {
          baseDaysCandidate = parsed;
        }
      }
      if (baseDaysCandidate === null) {
        if (resolvedAction === 'revoked') {
          baseDaysCandidate = 0;
        } else {
          try {
            const ledger = await readLedgerEffective();
            const key = normalizedPlayerTag ?? playerTag;
            baseDaysCandidate = ledger[key] ?? 0;
          } catch (ledgerError) {
            console.warn('[api/player-actions] Failed to look up tenure ledger', ledgerError);
            baseDaysCandidate = 0;
          }
        }
      }
      const baseDays = Math.max(0, Math.round(baseDaysCandidate));
      const asOfIso =
        typeof asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : ymdNowUTC();

      const result = await applyTenureAction({
        clanTag: normalizedClanTag ?? clanTag,
        playerTag: normalizedPlayerTag ?? playerTag,
        playerName,
        baseDays,
        asOf: asOfIso,
        reason: reason ?? null,
        action: resolvedAction,
        grantedBy: grantedBy ?? null,
        createdBy: createdBy ?? grantedBy ?? null,
      });

      data = {
        action_type: 'tenure',
        tenureAction: result.tenureAction ?? null,
        tenureDays: result.tenureDays,
        asOf: result.asOf,
        action: result.action,
        clanTag: result.clanTag,
        playerTag: result.playerTag,
        playerName: result.playerName,
      };
    } else if (actionType === 'departure') {
      const { reason, departureType } = actionData;
      if (!reason || !departureType || !['voluntary', 'involuntary', 'inactive'].includes(departureType)) {
        return json({ success: false, error: 'Invalid departure data' }, { status: 400 });
      }
      
      const { data: result, error } = await supabase
        .from('player_departure_actions')
        .insert({
          clan_tag: clanTagForWrite,
          player_tag: playerTagForWrite,
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

export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-actions');
  
  try {
    const body = await request.json();
    const { id, actionType, archivedBy } = body;
    
    if (!id || !actionType) {
      return json({ success: false, error: 'id and actionType are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (actionType === 'tenure') {
      const { data: result, error } = await supabase
        .from('player_tenure_actions')
        .update({
          archived_at: new Date().toISOString(),
          archived_by: archivedBy || 'System'
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error archiving tenure action:', error);
        return json({ success: false, error: 'Failed to archive tenure action' }, { status: 500 });
      }
      
      data = { ...result, action_type: 'tenure' };
    } else if (actionType === 'departure') {
      const { data: result, error } = await supabase
        .from('player_departure_actions')
        .update({
          archived_at: new Date().toISOString(),
          archived_by: archivedBy || 'System'
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error archiving departure action:', error);
        return json({ success: false, error: 'Failed to archive departure action' }, { status: 500 });
      }
      
      data = { ...result, action_type: 'departure' };
    } else {
      return json({ success: false, error: 'Invalid action type' }, { status: 400 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-actions DELETE (archive):', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-actions');
  
  try {
    const body = await request.json();
    const { id, actionType, action } = body; // action: 'unarchive'
    
    if (!id || !actionType || !action) {
      return json({ success: false, error: 'id, actionType, and action are required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (action === 'unarchive') {
      if (actionType === 'tenure') {
        const { data: result, error } = await supabase
          .from('player_tenure_actions')
          .update({
            archived_at: null,
            archived_by: null
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('Error unarchiving tenure action:', error);
          return json({ success: false, error: 'Failed to unarchive tenure action' }, { status: 500 });
        }
        
        data = { ...result, action_type: 'tenure' };
      } else if (actionType === 'departure') {
        const { data: result, error } = await supabase
          .from('player_departure_actions')
          .update({
            archived_at: null,
            archived_by: null
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('Error unarchiving departure action:', error);
          return json({ success: false, error: 'Failed to unarchive departure action' }, { status: 500 });
        }
        
        data = { ...result, action_type: 'departure' };
      } else {
        return json({ success: false, error: 'Invalid action type' }, { status: 400 });
      }
    } else {
      return json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
    
    return json({ success: true, data });
  } catch (error: any) {
    console.error('Error in player-actions PATCH:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
