import { NextRequest, NextResponse } from 'next/server';
import { requireLeadership, getCurrentUserIdentifier } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createApiContext } from '@/lib/api/route-helpers';
import { applyTenureAction } from '@/lib/services/tenure-service';
import { ymdNowUTC } from '@/lib/date';
import { readLedgerEffective } from '@/lib/tenure';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

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
  const { json } = createApiContext(request, '/api/player-actions');
  const { searchParams } = new URL(request.url);
  const clanTagParam = searchParams.get('clanTag');
  const playerTagParam = searchParams.get('playerTag');
  const actionType = searchParams.get('type'); // 'tenure' or 'departure'
  const includeArchived = searchParams.get('includeArchived') === 'true';
  
  if (!clanTagParam) {
    return json({ success: false, error: 'clanTag is required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return json({ success: false, error: 'Invalid clanTag' }, { status: 400 });
  }
  const playerTag = playerTagParam ? (normalizeTag(playerTagParam) ?? playerTagParam) : null;
  
  try {
    // Require leadership to view player actions (tenure/departure notes)
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
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { clanTag, playerTag, playerName, actionType, actionData } = body;
  
  if (!clanTag || !playerTag || !actionType) {
    return json({ success: false, error: 'clanTag, playerTag, and actionType are required' }, { status: 400 });
  }
  
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedPlayerTag = normalizeTag(playerTag ?? '');
  if (!normalizedClanTag || !normalizedPlayerTag) {
    return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
  }
  const clanTagForWrite = normalizedClanTag;
  const playerTagForWrite = normalizedPlayerTag;
  
  try {
    await requireLeadership(request, { clanTag: clanTagForWrite });
    
    // Automatically get the current user's identifier
    const createdBy = await getCurrentUserIdentifier(request, clanTagForWrite);
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (actionType === 'tenure') {
      const { action, reason, tenureDays, asOf } = actionData ?? {};
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

      // If playerName not provided, look it up from tag
      let finalPlayerName = playerName?.trim();
      if (!finalPlayerName || finalPlayerName === 'Unknown Player') {
        const lookedUpName = await lookupPlayerName(clanTagForWrite, playerTagForWrite);
        if (lookedUpName) {
          finalPlayerName = lookedUpName;
        } else {
          finalPlayerName = playerName || null;
        }
      }
      
      // Use createdBy for both grantedBy and createdBy (automatically set from logged-in user)
      const result = await applyTenureAction({
        clanTag: clanTagForWrite,
        playerTag: playerTagForWrite,
        playerName: finalPlayerName,
        baseDays,
        asOf: asOfIso,
        reason: reason ?? null,
        action: resolvedAction,
        grantedBy: createdBy,
        createdBy: createdBy,
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
      
      // If playerName not provided, look it up from tag
      let finalPlayerName = playerName?.trim();
      if (!finalPlayerName || finalPlayerName === 'Unknown Player') {
        const lookedUpName = await lookupPlayerName(clanTagForWrite, playerTagForWrite);
        if (lookedUpName) {
          finalPlayerName = lookedUpName;
        } else {
          finalPlayerName = playerName || null;
        }
      }
      
      // Use createdBy for both recorded_by and created_by (automatically set from logged-in user)
      const { data: result, error } = await supabase
        .from('player_departure_actions')
        .insert({
          clan_tag: clanTagForWrite,
          player_tag: playerTagForWrite,
          player_name: finalPlayerName,
          reason,
          departure_type: departureType,
          recorded_by: createdBy,
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
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { id, actionType, clanTag } = body;
  
  if (!id || !actionType) {
    return json({ success: false, error: 'id and actionType are required' }, { status: 400 });
  }
  
  const normalizedClanTag = normalizeTag(clanTag ?? '');
  if (!normalizedClanTag) {
    return json({ success: false, error: 'Valid clanTag is required' }, { status: 400 });
  }
  
  try {
    await requireLeadership(request, { clanTag: normalizedClanTag });
    
    // Automatically get the current user's identifier
    const archivedBy = await getCurrentUserIdentifier(request, normalizedClanTag);
    
    const supabase = getSupabaseAdminClient();
    let data: any;
    
    if (actionType === 'tenure') {
      const { data: result, error } = await supabase
        .from('player_tenure_actions')
        .update({
          archived_at: new Date().toISOString(),
          archived_by: archivedBy
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
          archived_by: archivedBy
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
  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { id, actionType, action, clanTag: clanTagParam } = body; // action: 'unarchive'
  
  if (!id || !actionType || !action) {
    return json({ success: false, error: 'id, actionType, and action are required' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdminClient();
  let clanTag: string | null = clanTagParam ? normalizeTag(clanTagParam) : null;
  
  if (!clanTag) {
    const sourceTable = actionType === 'tenure' ? 'player_tenure_actions' : actionType === 'departure' ? 'player_departure_actions' : null;
    if (!sourceTable) {
      return json({ success: false, error: 'Invalid action type' }, { status: 400 });
    }
    const { data: actionRecord, error: lookupError } = await supabase
      .from(sourceTable)
      .select('clan_tag')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) {
      console.error('[player-actions] Failed to resolve clan tag for action', lookupError);
      return json({ success: false, error: 'Failed to resolve clan context' }, { status: 500 });
    }
    clanTag = actionRecord?.clan_tag ? normalizeTag(actionRecord.clan_tag) : null;
  }
  
  if (!clanTag) {
    return json({ success: false, error: 'Unable to resolve clan for action' }, { status: 404 });
  }
  
  try {
    await requireLeadership(request, { clanTag });
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
