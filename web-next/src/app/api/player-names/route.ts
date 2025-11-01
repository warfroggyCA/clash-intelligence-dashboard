import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tagsParam = searchParams.get('tags');
    
    if (!tagsParam) {
      return NextResponse.json({ success: false, error: 'tags parameter is required' }, { status: 400 });
    }

    const tags = tagsParam.split(',').map(tag => normalizeTag(tag.trim())).filter(Boolean);
    
    // Filter out invalid test tags
    const validTags = tags.filter(tag => {
      const upperTag = tag.toUpperCase();
      return !upperTag.includes('TEST');
    });
    
    if (validTags.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    console.log(`[player-names] Fetching names for ${validTags.length} tags (filtered ${tags.length - validTags.length} invalid test tags):`, validTags.slice(0, 5));

    const supabase = getSupabaseServerClient();

    // Fetch latest canonical snapshots for all tags
    // We'll fetch all snapshots and then group by player_tag to get the latest
    const { data: snapshots, error } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, snapshot_date, payload')
      .in('player_tag', validTags)
      .order('snapshot_date', { ascending: false })
      .limit(1000); // Reasonable limit to prevent excessive data

    if (error) {
      console.error('Error fetching player names:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[player-names] Found ${snapshots?.length || 0} snapshots`);

    // Group by player_tag and get the latest snapshot for each
    const nameMap = new Map<string, string>();
    const seenTags = new Set<string>();
    
    if (snapshots) {
      for (const snapshot of snapshots) {
        const tag = snapshot.player_tag;
        if (!seenTags.has(tag) && snapshot.payload?.member?.name) {
          seenTags.add(tag);
          nameMap.set(tag, snapshot.payload.member.name);
        }
      }
    }

    console.log(`[player-names] Resolved ${nameMap.size} names out of ${validTags.length} requested`);

    // If we didn't find all names in canonical snapshots, try the members table as fallback
    const missingTags = validTags.filter(tag => !nameMap.has(tag));
    if (missingTags.length > 0) {
      console.log(`[player-names] Trying members table for ${missingTags.length} missing tags`);
      
      // Get clan info to query members table
      const { cfg } = await import('@/lib/config');
      const clanTag = cfg.homeClanTag ? normalizeTag(cfg.homeClanTag) : null;
      
      if (clanTag) {
        // First get clan_id
        const { data: clanRow } = await supabase
          .from('clans')
          .select('id')
          .eq('tag', clanTag)
          .maybeSingle();
        
        if (clanRow?.id) {
          // Query members table
          const { data: members, error: membersError } = await supabase
            .from('members')
            .select('tag, name')
            .eq('clan_id', clanRow.id)
            .in('tag', missingTags);
          
          if (!membersError && members) {
            members.forEach((member: any) => {
              if (member.tag && member.name && !nameMap.has(member.tag)) {
                const normalizedTag = normalizeTag(member.tag);
                nameMap.set(normalizedTag, member.name);
              }
            });
            console.log(`[player-names] Found ${members.length} additional names from members table`);
          }
        }
      }
    }

    console.log(`[player-names] Final result: ${nameMap.size} names out of ${validTags.length} requested`);

    // Return as array of objects
    const result = Array.from(nameMap.entries()).map(([tag, name]) => ({
      tag,
      name,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in player-names API:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

