import { NextRequest, NextResponse } from 'next/server';
import { requireLeadership, getCurrentUserIdentifier } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag, isValidTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/player-history/mark-returned
 * Mark a player as returned to the clan
 * - Updates player_history status to 'active'
 * - Adds a return movement
 * - Creates an optional note
 * - Updates currentStint
 */
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/player-history/mark-returned');
  const body = await request.json().catch(() => null);
  
  if (!body) {
    return json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
  const { clanTag: clanTagParam, playerTag: playerTagParam, playerName, note, awardPreviousTenure } = body;
  
  if (!clanTagParam || !playerTagParam) {
    return json({ success: false, error: 'clanTag and playerTag are required' }, { status: 400 });
  }

  const clanTag = normalizeTag(clanTagParam);
  const playerTag = normalizeTag(playerTagParam);
  
  if (!clanTag || !playerTag || !isValidTag(clanTag) || !isValidTag(playerTag)) {
    return json({ success: false, error: 'Invalid clanTag or playerTag' }, { status: 400 });
  }
  
  try {
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
    const recordedBy = await getCurrentUserIdentifier(request, clanTag);
    const now = new Date().toISOString();

    // Get existing player history
    const { data: existingHistory, error: fetchError } = await supabase
      .from('player_history')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('player_tag', playerTag)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[mark-returned] Error fetching player history:', fetchError);
      return json({ success: false, error: 'Failed to fetch player history' }, { status: 500 });
    }

    // Prepare return movement
    const returnMovement = {
      type: 'returned',
      date: now,
      notes: note || `Player returned to clan${playerName ? ` as ${playerName}` : ''}`,
      recordedBy,
    };

    // Prepare return note
    const returnNote = {
      timestamp: now,
      note: note || `Player returned to clan${playerName ? ` as ${playerName}` : ''}`,
      customFields: {
        'Movement Type': 'returned',
        'Return Date': now,
        'Previous Tenure Awarded': (awardPreviousTenure || 0).toString(),
        'Recorded By': recordedBy,
      },
      createdBy: recordedBy,
    };

    // Calculate new tenure
    const previousTenure = existingHistory?.total_tenure || 0;
    const tenureToAward = awardPreviousTenure || 0;
    const newTotalTenure = previousTenure + tenureToAward;

    // Prepare updates
    const movements = existingHistory?.movements || [];
    const notes = existingHistory?.notes || [];
    
    const updatedMovements = [...movements, returnMovement];
    const updatedNotes = [...notes, returnNote];

    const updates: Record<string, unknown> = {
      status: 'active',
      movements: updatedMovements,
      notes: updatedNotes,
      total_tenure: newTotalTenure,
      current_stint: {
        startDate: now,
        isActive: true,
      },
      updated_at: now,
    };

    // Update primary name if provided and different
    if (playerName && playerName.trim() && playerName !== existingHistory?.primary_name) {
      // Add old name as alias if it exists
      const aliases = existingHistory?.aliases || [];
      if (existingHistory?.primary_name) {
        const aliasExists = aliases.some((a: any) => a.name === existingHistory.primary_name);
        if (!aliasExists) {
          aliases.push({
            name: existingHistory.primary_name,
            addedAt: now,
          });
        }
      }
      updates.primary_name = playerName.trim();
      updates.aliases = aliases;
    }

    // Upsert player history
    const { error: upsertError } = await supabase
      .from('player_history')
      .upsert({
        clan_tag: clanTag,
        player_tag: playerTag,
        primary_name: playerName?.trim() || existingHistory?.primary_name || 'Unknown Player',
        status: 'active',
        total_tenure: newTotalTenure,
        current_stint: {
          startDate: now,
          isActive: true,
        },
        movements: updatedMovements,
        aliases: updates.aliases || existingHistory?.aliases || [],
        notes: updatedNotes,
        updated_at: now,
      }, { onConflict: 'clan_tag,player_tag' });

    if (upsertError) {
      console.error('[mark-returned] Error upserting player history:', upsertError);
      return json({ success: false, error: 'Failed to update player history' }, { status: 500 });
    }

    // Also create a player note if note was provided
    if (note && note.trim()) {
      try {
        await supabase
          .from('player_notes')
          .insert({
            clan_tag: clanTag,
            player_tag: playerTag,
            player_name: playerName?.trim() || existingHistory?.primary_name || null,
            note: note.trim(),
            custom_fields: {
              'Movement Type': 'returned',
              'Return Date': now,
            },
            created_by: recordedBy,
          });
      } catch (noteError) {
        // Non-fatal - log but don't fail the whole operation
        console.warn('[mark-returned] Failed to create player note:', noteError);
      }
    }

    return json({ 
      success: true, 
      data: { 
        message: 'Player marked as returned',
        playerTag,
        playerName: playerName || existingHistory?.primary_name,
        status: 'active',
        returnDate: now,
      } 
    });
  } catch (error: any) {
    console.error('[mark-returned] Error:', error);
    return json({ success: false, error: error.message || 'Failed to mark player as returned' }, { status: 500 });
  }
}
