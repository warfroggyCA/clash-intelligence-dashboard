import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Backfill endpoint to restore player names for entries with "Unknown Player" or null names.
 * Looks up names from canonical snapshots or members table and updates the records.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
    
    if (expectedToken && expectedToken !== 'your-admin-api-key' && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // In local dev with placeholder, skip auth check
    if (!expectedToken || expectedToken === 'your-admin-api-key') {
      console.warn('[Backfill Names] Running without auth check (development mode)');
    }

    const body = await request.json().catch(() => ({}));
    const clanTagParam = body.clanTag || cfg.homeClanTag;
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    
    if (!clanTagParam) {
      return NextResponse.json({ 
        success: false, 
        error: 'clanTag is required' 
      }, { status: 400 });
    }

    const clanTag = normalizeTag(clanTagParam);
    const supabaseAdmin = getSupabaseAdminClient();
    const supabaseServer = getSupabaseServerClient();

    console.log(`[Backfill Names] Starting name restoration for clan: ${clanTag}`);

    // Step 1: Find all entries with missing or "Unknown Player" names
    const [notesResult, warningsResult, tenureResult, departureResult] = await Promise.all([
      // Notes with missing names
      supabaseAdmin
        .from('player_notes')
        .select('id, player_tag, player_name')
        .eq('clan_tag', clanTag)
        .then(result => {
          if (result.error) throw result.error;
          return (result.data || []).filter((n: any) => 
            !n.player_name || n.player_name.trim() === '' || n.player_name === 'Unknown Player'
          );
        }),
      
      // Warnings with missing names
      supabaseAdmin
        .from('player_warnings')
        .select('id, player_tag, player_name')
        .eq('clan_tag', clanTag)
        .then(result => {
          if (result.error) throw result.error;
          return (result.data || []).filter((w: any) => 
            !w.player_name || w.player_name.trim() === '' || w.player_name === 'Unknown Player'
          );
        }),
      
      // Tenure actions with missing names
      supabaseAdmin
        .from('player_tenure_actions')
        .select('id, player_tag, player_name')
        .eq('clan_tag', clanTag)
        .then(result => {
          if (result.error) throw result.error;
          return (result.data || []).filter((a: any) => 
            !a.player_name || a.player_name.trim() === '' || a.player_name === 'Unknown Player'
          );
        }),
      
      // Departure actions with missing names
      supabaseAdmin
        .from('player_departure_actions')
        .select('id, player_tag, player_name')
        .eq('clan_tag', clanTag)
        .then(result => {
          if (result.error) throw result.error;
          return (result.data || []).filter((a: any) => 
            !a.player_name || a.player_name.trim() === '' || a.player_name === 'Unknown Player'
          );
        }),
    ]);

    // Collect all unique tags that need names
    const tagsNeedingNames = new Set<string>();
    [...notesResult, ...warningsResult, ...tenureResult, ...departureResult].forEach((item: any) => {
      if (item.player_tag) {
        tagsNeedingNames.add(normalizeTag(item.player_tag) || item.player_tag);
      }
    });

    console.log(`[Backfill Names] Found ${tagsNeedingNames.size} unique tags needing names`);
    console.log(`[Backfill Names] Breakdown: ${notesResult.length} notes, ${warningsResult.length} warnings, ${tenureResult.length} tenure actions, ${departureResult.length} departure actions`);

    // Step 2: Lookup names for all tags
    const nameMap = new Map<string, string>();
    const tagsArray = Array.from(tagsNeedingNames);

    if (tagsArray.length > 0) {
      // Try canonical snapshots first - search across ALL clans, not just current clan
      // This helps find names for former members or players from other clans
      const { data: snapshots } = await supabaseServer
        .from('canonical_member_snapshots')
        .select('player_tag, snapshot_date, payload')
        .in('player_tag', tagsArray)
        .order('snapshot_date', { ascending: false })
        .limit(tagsArray.length * 20); // Get more to ensure we find names even if they're in other clans

      if (snapshots) {
        const seenTags = new Set<string>();
        for (const snapshot of snapshots) {
          const tag = snapshot.player_tag;
          if (!seenTags.has(tag) && snapshot.payload?.member?.name) {
            seenTags.add(tag);
            nameMap.set(tag, snapshot.payload.member.name);
          }
        }
      }

      // Fallback to members table for any still missing
      const missingTags = tagsArray.filter(tag => !nameMap.has(tag));
      if (missingTags.length > 0) {
        const { data: clanRow } = await supabaseServer
          .from('clans')
          .select('id')
          .eq('tag', clanTag)
          .maybeSingle();
        
        if (clanRow?.id) {
          const { data: members } = await supabaseServer
            .from('members')
            .select('tag, name')
            .eq('clan_id', clanRow.id)
            .in('tag', missingTags);
          
          if (members) {
            members.forEach((member: any) => {
              if (member.tag && member.name) {
                const normalizedTag = normalizeTag(member.tag);
                if (normalizedTag && !nameMap.has(normalizedTag)) {
                  nameMap.set(normalizedTag, member.name);
                }
              }
            });
          }
        }
        
        // Last resort: Try CoC API for remaining tags (limited to avoid rate limits)
        const stillMissing = tagsArray.filter(tag => !nameMap.has(tag));
        if (stillMissing.length > 0) {
          console.log(`[Backfill Names] Attempting CoC API lookup for ${stillMissing.length} remaining tags:`, stillMissing.slice(0, 5));
          const { getPlayer } = await import('@/lib/coc');
          
          // Process in batches of 10 with delays between batches
          const batchSize = 10;
          for (let i = 0; i < Math.min(stillMissing.length, 30); i += batchSize) { // Max 30 to avoid rate limits
            const batch = stillMissing.slice(i, i + batchSize);
            console.log(`[Backfill Names] Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tags`);
            
            for (const tag of batch) {
              try {
                const cleanTag = tag.replace('#', '');
                const playerData = await getPlayer(cleanTag);
                if (playerData?.name) {
                  nameMap.set(tag, playerData.name);
                  console.log(`[Backfill Names] ✅ Found name via CoC API: ${tag} → ${playerData.name}`);
                } else {
                  console.log(`[Backfill Names] ⚠️  No name in CoC API response for ${tag}`);
                }
                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (error: any) {
                console.warn(`[Backfill Names] ❌ Failed to lookup ${tag} via CoC API:`, error.message);
              }
            }
            
            // Delay between batches
            if (i + batchSize < stillMissing.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
    }

    console.log(`[Backfill Names] Resolved ${nameMap.size} names out of ${tagsArray.length} tags`);

    // Step 3: Update records
    const stats = {
      notes: { total: notesResult.length, updated: 0, errors: [] as string[] },
      warnings: { total: warningsResult.length, updated: 0, errors: [] as string[] },
      tenureActions: { total: tenureResult.length, updated: 0, errors: [] as string[] },
      departureActions: { total: departureResult.length, updated: 0, errors: [] as string[] },
    };

    if (dryRun) {
      // Count what would be updated
      notesResult.forEach((note: any) => {
        const tag = normalizeTag(note.player_tag) || note.player_tag;
        if (nameMap.has(tag)) stats.notes.updated++;
      });
      warningsResult.forEach((warning: any) => {
        const tag = normalizeTag(warning.player_tag) || warning.player_tag;
        if (nameMap.has(tag)) stats.warnings.updated++;
      });
      tenureResult.forEach((action: any) => {
        const tag = normalizeTag(action.player_tag) || action.player_tag;
        if (nameMap.has(tag)) stats.tenureActions.updated++;
      });
      departureResult.forEach((action: any) => {
        const tag = normalizeTag(action.player_tag) || action.player_tag;
        if (nameMap.has(tag)) stats.departureActions.updated++;
      });

      return NextResponse.json({
        success: true,
        message: 'DRY RUN - No data was modified',
        stats,
        nameResolution: {
          tagsNeedingNames: tagsArray.length,
          namesResolved: nameMap.size,
          sampleNames: Array.from(nameMap.entries()).slice(0, 10).map(([tag, name]) => ({ tag, name })),
        },
        instructions: 'Set "dryRun": false in the request body to actually update the records',
      });
    }

    // Actually update the records
    // Update notes
    for (const note of notesResult) {
      const tag = normalizeTag(note.player_tag) || note.player_tag;
      const name = nameMap.get(tag);
      if (name) {
        const { error } = await supabaseAdmin
          .from('player_notes')
          .update({ player_name: name })
          .eq('id', note.id);
        
        if (error) {
          stats.notes.errors.push(`Note ${note.id}: ${error.message}`);
        } else {
          stats.notes.updated++;
        }
      }
    }

    // Update warnings
    for (const warning of warningsResult) {
      const tag = normalizeTag(warning.player_tag) || warning.player_tag;
      const name = nameMap.get(tag);
      if (name) {
        const { error } = await supabaseAdmin
          .from('player_warnings')
          .update({ player_name: name })
          .eq('id', warning.id);
        
        if (error) {
          stats.warnings.errors.push(`Warning ${warning.id}: ${error.message}`);
        } else {
          stats.warnings.updated++;
        }
      }
    }

    // Update tenure actions
    for (const action of tenureResult) {
      const tag = normalizeTag(action.player_tag) || action.player_tag;
      const name = nameMap.get(tag);
      if (name) {
        const { error } = await supabaseAdmin
          .from('player_tenure_actions')
          .update({ player_name: name })
          .eq('id', action.id);
        
        if (error) {
          stats.tenureActions.errors.push(`Tenure ${action.id}: ${error.message}`);
        } else {
          stats.tenureActions.updated++;
        }
      }
    }

    // Update departure actions
    for (const action of departureResult) {
      const tag = normalizeTag(action.player_tag) || action.player_tag;
      const name = nameMap.get(tag);
      if (name) {
        const { error } = await supabaseAdmin
          .from('player_departure_actions')
          .update({ player_name: name })
          .eq('id', action.id);
        
        if (error) {
          stats.departureActions.errors.push(`Departure ${action.id}: ${error.message}`);
        } else {
          stats.departureActions.updated++;
        }
      }
    }

    const totalUpdated = stats.notes.updated + stats.warnings.updated + stats.tenureActions.updated + stats.departureActions.updated;
    const totalErrors = stats.notes.errors.length + stats.warnings.errors.length + stats.tenureActions.errors.length + stats.departureActions.errors.length;

    return NextResponse.json({
      success: true,
      message: `Name restoration completed: ${totalUpdated} records updated, ${totalErrors} errors`,
      stats,
      nameResolution: {
        tagsNeedingNames: tagsArray.length,
        namesResolved: nameMap.size,
      },
      errors: totalErrors > 0 ? [
        ...stats.notes.errors.slice(0, 5),
        ...stats.warnings.errors.slice(0, 5),
        ...stats.tenureActions.errors.slice(0, 5),
        ...stats.departureActions.errors.slice(0, 5),
      ] : undefined,
    });
  } catch (error: any) {
    console.error('[Backfill Names] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unexpected error during name restoration' 
    }, { status: 500 });
  }
}

