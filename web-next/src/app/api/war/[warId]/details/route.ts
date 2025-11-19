import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { createApiContext } from '@/lib/api/route-helpers';

/**
 * Fetch detailed war data (members + attacks) for a specific war
 * Used to enrich war log entries that only have summary data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { warId: string } }
) {
  const { json } = createApiContext(request, '/api/war/[warId]/details');
  
  try {
    const warId = decodeURIComponent(params.warId);
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const supabase = getSupabaseAdminClient();

    // Find the war by ID (UUID) or by endTime + clanTag
    let warQuery = supabase
      .from('clan_wars')
      .select('id, battle_end, clan_tag, opponent_tag')
      .limit(1);

    // If warId is a UUID, use it directly
    if (warId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      warQuery = warQuery.eq('id', warId);
    } else {
      // Convert Clash API timestamp format (20251117T213601.000Z) to ISO format (2025-11-17T21:36:01.000Z)
      let isoTimestamp = warId;
      const clashFormatMatch = warId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/);
      if (clashFormatMatch) {
        const [, year, month, day, hour, minute, second, millis] = clashFormatMatch;
        isoTimestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}Z`;
      }
      
      // Match by battle_end timestamp, optionally filtered by clan_tag
      // Use a range query to handle slight timestamp differences
      const timestampDate = new Date(isoTimestamp);
      const startRange = new Date(timestampDate.getTime() - 60000); // 1 minute before
      const endRange = new Date(timestampDate.getTime() + 60000); // 1 minute after
      
      warQuery = warQuery
        .gte('battle_end', startRange.toISOString())
        .lte('battle_end', endRange.toISOString());
      if (clanTag) {
        warQuery = warQuery.eq('clan_tag', normalizeTag(clanTag));
      }
    }

    const { data: war, error: warError } = await warQuery.maybeSingle();

    if (warError || !war) {
      return json({ success: false, error: 'War not found' }, { status: 404 });
    }

    // Fetch members for this war (home clan only)
    const { data: members, error: membersError } = await supabase
      .from('clan_war_members')
      .select('*')
      .eq('war_id', war.id)
      .eq('is_home', true)
      .order('map_position', { ascending: true });

    if (membersError) {
      console.warn('[WarDetails] Failed to fetch members', membersError);
    }

    // Fetch attacks for this war (home clan attacks only)
    const { data: attacks, error: attacksError } = await supabase
      .from('clan_war_attacks')
      .select('*')
      .eq('war_id', war.id)
      .eq('attacker_clan_tag', war.clan_tag)
      .order('order_index', { ascending: true });

    if (attacksError) {
      console.warn('[WarDetails] Failed to fetch attacks', attacksError);
    }

    // Transform to match the structure expected by deriveWarResultNotes
    const enrichedMembers = (members || []).map((member) => {
      // Get attacks for this member
      const memberAttacks = (attacks || [])
        .filter((a) => normalizeTag(a.attacker_tag) === normalizeTag(member.player_tag))
        .map((attack) => ({
          order: attack.order_index ?? 0,
          attackerTag: attack.attacker_tag,
          defenderTag: attack.defender_tag,
          stars: attack.stars ?? 0,
          destructionPercentage: attack.destruction ?? 0,
          duration: attack.duration ?? 0,
          isBestAttack: attack.is_best_attack ?? false,
          timestamp: attack.attack_time,
          battleTime: attack.attack_time,
        }));

      return {
        tag: member.player_tag,
        name: member.player_name || member.player_tag,
        townhallLevel: member.town_hall_level ?? 0,
        mapPosition: member.map_position ?? 0,
        stars: member.stars ?? 0,
        destructionPercentage: member.destruction ?? 0,
        attacks: memberAttacks,
        attackCount: member.attacks ?? 0,
        defenseCount: member.defense_count ?? 0,
        defenseDestruction: member.defense_destruction ?? 0,
      };
    });

    return json({
      success: true,
      data: {
        warId: war.id,
        members: enrichedMembers,
      },
    });
  } catch (error: any) {
    console.error('[WarDetails] Error', error);
    return json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

