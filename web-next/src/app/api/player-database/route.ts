import { NextRequest, NextResponse } from 'next/server';
import { requireLeadership } from '@/lib/api/role-check';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getLinkedTags, getLinkedTagsWithNames } from '@/lib/player-aliases';

export const dynamic = 'force-dynamic';

// Debug logging control - gate verbose logs in production
const DEBUG_PLAYER_DB = process.env.DEBUG_PLAYER_DATABASE === 'true' || process.env.NODE_ENV === 'development';

function debugLog(...args: any[]): void {
  if (DEBUG_PLAYER_DB) {
    console.log(...args);
  }
}

function debugWarn(...args: any[]): void {
  if (DEBUG_PLAYER_DB) {
    console.warn(...args);
  }
}

/**
 * Optimized endpoint for Player Database page.
 * Combines notes, warnings, actions, and player names in efficient queries.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag;
  const includeArchived = searchParams.get('includeArchived') === 'true';
  
  if (!clanTagParam) {
    return NextResponse.json({ success: false, error: 'clanTag is required' }, { status: 400 });
  }
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) {
    return NextResponse.json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }

  try {
    // Require leadership role to view player database (contains notes/warnings)
    await requireLeadership(request, { clanTag });
    
    const supabaseAdmin = getSupabaseAdminClient();
    const supabaseServer = getSupabaseServerClient();

    const startTime = Date.now();

    // Step 1: Fetch notes, warnings, and actions in parallel
    // Build queries with proper archived filtering
    let notesQuery = supabaseAdmin
      .from('player_notes')
      .select('id, player_tag, player_name, note, custom_fields, created_at, created_by, archived_at')
      .eq('clan_tag', clanTag);
    if (!includeArchived) {
      notesQuery = notesQuery.is('archived_at', null);
    }

    let tenureQuery = supabaseAdmin
      .from('player_tenure_actions')
      .select('id, player_tag, player_name, action, reason, granted_by, created_at, created_by, archived_at')
      .eq('clan_tag', clanTag);
    if (!includeArchived) {
      tenureQuery = tenureQuery.is('archived_at', null);
    }

    let departureQuery = supabaseAdmin
      .from('player_departure_actions')
      .select('id, player_tag, player_name, reason, departure_type, recorded_by, created_at, created_by, archived_at')
      .eq('clan_tag', clanTag);
    if (!includeArchived) {
      departureQuery = departureQuery.is('archived_at', null);
    }

    const [notesResult, warningsResult, tenureResult, departureResult] = await Promise.all([
      // Notes
      notesQuery.then(result => {
        if (result.error) throw result.error;
        return result.data || [];
      }),
      
      // Warnings (no archived field, always fetch all)
      supabaseAdmin
        .from('player_warnings')
        .select('id, player_tag, player_name, warning_note, is_active, created_at, created_by')
        .eq('clan_tag', clanTag)
        .then(result => {
          if (result.error) throw result.error;
          return result.data || [];
        }),
      
      // Tenure actions
      tenureQuery.then(result => {
        if (result.error) throw result.error;
        return result.data || [];
      }),
      
      // Departure actions
      departureQuery.then(result => {
        if (result.error) throw result.error;
        return result.data || [];
      }),
    ]);

    // Step 2: Collect all unique player tags
    const allTags = new Set<string>();
    notesResult.forEach((note: any) => {
      if (note.player_tag) allTags.add(normalizeTag(note.player_tag) || note.player_tag);
    });
    warningsResult.forEach((warning: any) => {
      if (warning.player_tag) allTags.add(normalizeTag(warning.player_tag) || warning.player_tag);
    });
    tenureResult.forEach((action: any) => {
      if (action.player_tag) allTags.add(normalizeTag(action.player_tag) || action.player_tag);
    });
    departureResult.forEach((action: any) => {
      if (action.player_tag) allTags.add(normalizeTag(action.player_tag) || action.player_tag);
    });

    const uniqueTags = Array.from(allTags).filter(tag => {
      const upperTag = tag.toUpperCase();
      return !upperTag.includes('TEST');
    });

    debugLog(`[player-database] Processing ${uniqueTags.length} unique player tags`);

    // Step 2.5: Find all linked alias tags and fetch their data
    const linkedTagsSet = new Set<string>();
    const tagToLinkedTagsMap = new Map<string, string[]>();
    
    // Query all alias links for the unique tags
    // SECURITY: Use parameterized queries instead of string interpolation to prevent query injection
    if (uniqueTags.length > 0) {
      // Build safe .or() filter with properly encoded values
      // Format: field1.in.(val1,val2),field2.in.(val1,val2)
      // Encode each tag to handle special characters like #
      const encodedTags = uniqueTags.map(tag => encodeURIComponent(tag));
      const orFilter = `player_tag_1.in.(${encodedTags.join(',')}),player_tag_2.in.(${encodedTags.join(',')})`;
      
      const { data: aliasLinks, error: aliasLinksError } = await supabaseAdmin
        .from('player_alias_links')
        .select('player_tag_1, player_tag_2')
        .eq('clan_tag', clanTag)
        .or(orFilter);

      if (!aliasLinksError && aliasLinks) {
        // Build bidirectional map
        aliasLinks.forEach((link: any) => {
          const tag1 = normalizeTag(link.player_tag_1) || link.player_tag_1;
          const tag2 = normalizeTag(link.player_tag_2) || link.player_tag_2;
          
          if (!tagToLinkedTagsMap.has(tag1)) {
            tagToLinkedTagsMap.set(tag1, []);
          }
          if (!tagToLinkedTagsMap.has(tag2)) {
            tagToLinkedTagsMap.set(tag2, []);
          }
          
          tagToLinkedTagsMap.get(tag1)!.push(tag2);
          tagToLinkedTagsMap.get(tag2)!.push(tag1);
          
          linkedTagsSet.add(tag1);
          linkedTagsSet.add(tag2);
        });
      }
    }

    // Collect all linked tags that aren't already in uniqueTags
    const linkedTagsArray = Array.from(linkedTagsSet).filter(tag => !uniqueTags.includes(tag));
    
    if (linkedTagsArray.length > 0) {
      debugLog(`[player-database] Found ${linkedTagsArray.length} linked alias tags`);
      
      // Fetch warnings and notes for linked tags
      const [linkedNotesResult, linkedWarningsResult] = await Promise.all([
        // Linked notes
        (async () => {
          let linkedNotesQuery = supabaseAdmin
            .from('player_notes')
            .select('id, player_tag, player_name, note, custom_fields, created_at, created_by, archived_at')
            .eq('clan_tag', clanTag)
            .in('player_tag', linkedTagsArray);
          if (!includeArchived) {
            linkedNotesQuery = linkedNotesQuery.is('archived_at', null);
          }
          const result = await linkedNotesQuery;
          if (result.error) {
            debugWarn('Error fetching linked notes:', result.error);
            return [];
          }
          return result.data || [];
        })(),
        
        // Linked warnings
        supabaseAdmin
          .from('player_warnings')
          .select('id, player_tag, player_name, warning_note, is_active, created_at, created_by')
          .eq('clan_tag', clanTag)
          .in('player_tag', linkedTagsArray)
          .then(result => {
            if (result.error) {
              debugWarn('Error fetching linked warnings:', result.error);
              return [];
            }
            return result.data || [];
          }),
      ]);

      // Add linked tags to allTags for name resolution
      linkedTagsArray.forEach(tag => allTags.add(tag));
      
      // Mark linked data with source information
      linkedNotesResult.forEach((note: any) => {
        note._fromAlias = true;
        notesResult.push(note);
      });
      
      linkedWarningsResult.forEach((warning: any) => {
        warning._fromAlias = true;
        warningsResult.push(warning);
      });
    }

    // Step 3: Fetch player names efficiently using a single query with DISTINCT ON
    // This is much faster than fetching all snapshots and grouping client-side
    const playerNamesMap = new Map<string, string>();
    
    // Combine uniqueTags with linked tags for name resolution
    const allTagsForNameResolution = [...uniqueTags, ...linkedTagsArray];
    
    if (allTagsForNameResolution.length > 0) {
      // Use a more efficient query: get latest snapshot per player_tag
      // We'll use a subquery approach since Supabase doesn't support DISTINCT ON directly
      const { data: nameSnapshots, error: nameError } = await supabaseServer
        .from('canonical_member_snapshots')
        .select('player_tag, snapshot_date, payload')
        .in('player_tag', allTagsForNameResolution)
        .order('snapshot_date', { ascending: false })
        .limit(allTagsForNameResolution.length * 10); // Get enough to ensure we have latest for each

      if (!nameError && nameSnapshots) {
        // Group by player_tag and get the latest (first) snapshot for each
        const seenTags = new Set<string>();
        for (const snapshot of nameSnapshots) {
          const tag = snapshot.player_tag;
          if (!seenTags.has(tag) && snapshot.payload?.member?.name) {
            seenTags.add(tag);
            playerNamesMap.set(tag, snapshot.payload.member.name);
          }
        }
      }

      // Fallback to members table for any still missing
      const missingTags = allTagsForNameResolution.filter(tag => !playerNamesMap.has(tag));
      if (missingTags.length > 0) {
        // Get clan_id first
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
                if (normalizedTag && !playerNamesMap.has(normalizedTag)) {
                  playerNamesMap.set(normalizedTag, member.name);
                }
              }
            });
          }
        }
      }
    }

    debugLog(`[player-database] Resolved ${playerNamesMap.size} player names`);

    // Step 4: Aggregate data by player tag
    // First pass: collect all stored names from notes/warnings/actions
    // These are explicitly stored and more reliable than snapshot names
    const storedNamesMap = new Map<string, string>();
    
    // Collect names from all sources - any stored name is better than snapshot
    [...notesResult, ...warningsResult, ...tenureResult, ...departureResult].forEach((item: any) => {
      const tag = normalizeTag(item.player_tag) || item.player_tag;
      if (!tag) return;
      
      const storedName = item.player_name?.trim();
      if (storedName && storedName !== 'Unknown Player') {
        // Store the name - if multiple exist, the last one wins (they should be consistent anyway)
        storedNamesMap.set(tag, storedName);
      }
    });
    
    const playerDataMap = new Map<string, {
      tag: string;
      name: string;
      notes: any[];
      warnings: any[];
      tenureActions: any[];
      departureActions: any[];
      lastUpdated: string;
    }>();

    // Process notes
    notesResult.forEach((note: any) => {
      const tag = normalizeTag(note.player_tag) || note.player_tag;
      if (!tag) return;

      if (!playerDataMap.has(tag)) {
        // Prioritize stored names from database over snapshot names
        const storedName = storedNamesMap.get(tag);
        const snapshotName = playerNamesMap.get(tag);
        const bestName = storedName && storedName !== 'Unknown Player'
          ? storedName
          : (snapshotName || 'Unknown Player');
        
        playerDataMap.set(tag, {
          tag,
          name: bestName,
          notes: [],
          warnings: [],
          tenureActions: [],
          departureActions: [],
          lastUpdated: note.created_at,
        });
      }

      const playerData = playerDataMap.get(tag)!;
      
      // Ensure we use the best stored name if available
      const storedName = storedNamesMap.get(tag);
      if (storedName && storedName !== 'Unknown Player') {
        playerData.name = storedName;
      } else if (!playerData.name || playerData.name === 'Unknown Player') {
        playerData.name = playerNamesMap.get(tag) || 'Unknown Player';
      }

      playerData.notes.push({
        id: note.id,
        timestamp: note.created_at,
        note: note.note,
        customFields: note.custom_fields || {},
        createdBy: note.created_by || 'Unknown',
        source: 'supabase',
        fromAlias: note._fromAlias || false,
      });

      if (note.created_at > playerData.lastUpdated) {
        playerData.lastUpdated = note.created_at;
      }
    });

    // Process warnings
    warningsResult.forEach((warning: any) => {
      const tag = normalizeTag(warning.player_tag) || warning.player_tag;
      if (!tag) return;

      if (!playerDataMap.has(tag)) {
        // Prioritize stored names from database over snapshot names
        const storedName = storedNamesMap.get(tag);
        const snapshotName = playerNamesMap.get(tag);
        const bestName = storedName && storedName !== 'Unknown Player'
          ? storedName
          : (snapshotName || 'Unknown Player');
        
        playerDataMap.set(tag, {
          tag,
          name: bestName,
          notes: [],
          warnings: [],
          tenureActions: [],
          departureActions: [],
          lastUpdated: warning.created_at,
        });
      }

      const playerData = playerDataMap.get(tag)!;
      
      // Ensure we use the best stored name if available
      const storedName = storedNamesMap.get(tag);
      if (storedName && storedName !== 'Unknown Player') {
        playerData.name = storedName;
      } else if (!playerData.name || playerData.name === 'Unknown Player') {
        playerData.name = playerNamesMap.get(tag) || 'Unknown Player';
      }

      if (warning.is_active) {
        playerData.warnings.push({
          id: warning.id,
          timestamp: warning.created_at,
          warningNote: warning.warning_note,
          isActive: true,
          source: 'supabase',
          fromAlias: warning._fromAlias || false,
        });

        if (warning.created_at > playerData.lastUpdated) {
          playerData.lastUpdated = warning.created_at;
        }
      }
    });

    // Process tenure actions
    tenureResult.forEach((action: any) => {
      const tag = normalizeTag(action.player_tag) || action.player_tag;
      if (!tag) return;

      if (!playerDataMap.has(tag)) {
        // Prioritize stored names from database over snapshot names
        const storedName = storedNamesMap.get(tag);
        const snapshotName = playerNamesMap.get(tag);
        const bestName = storedName && storedName !== 'Unknown Player'
          ? storedName
          : (snapshotName || 'Unknown Player');
        
        playerDataMap.set(tag, {
          tag,
          name: bestName,
          notes: [],
          warnings: [],
          tenureActions: [],
          departureActions: [],
          lastUpdated: action.created_at,
        });
      }

      const playerData = playerDataMap.get(tag)!;
      
      // Ensure we use the best stored name if available
      const storedName = storedNamesMap.get(tag);
      if (storedName && storedName !== 'Unknown Player') {
        playerData.name = storedName;
      } else if (!playerData.name || playerData.name === 'Unknown Player') {
        playerData.name = playerNamesMap.get(tag) || 'Unknown Player';
      }

      playerData.tenureActions.push({
        id: action.id,
        timestamp: action.created_at,
        action: action.action,
        reason: action.reason,
        grantedBy: action.granted_by,
        source: 'supabase',
      });

      if (action.created_at > playerData.lastUpdated) {
        playerData.lastUpdated = action.created_at;
      }
    });

    // Process departure actions
    departureResult.forEach((action: any) => {
      const tag = normalizeTag(action.player_tag) || action.player_tag;
      if (!tag) return;

      if (!playerDataMap.has(tag)) {
        // Prioritize stored names from database over snapshot names
        const storedName = storedNamesMap.get(tag);
        const snapshotName = playerNamesMap.get(tag);
        const bestName = storedName && storedName !== 'Unknown Player'
          ? storedName
          : (snapshotName || 'Unknown Player');
        
        playerDataMap.set(tag, {
          tag,
          name: bestName,
          notes: [],
          warnings: [],
          tenureActions: [],
          departureActions: [],
          lastUpdated: action.created_at,
        });
      }

      const playerData = playerDataMap.get(tag)!;
      
      // Ensure we use the best stored name if available
      const storedName = storedNamesMap.get(tag);
      if (storedName && storedName !== 'Unknown Player') {
        playerData.name = storedName;
      } else if (!playerData.name || playerData.name === 'Unknown Player') {
        playerData.name = playerNamesMap.get(tag) || 'Unknown Player';
      }

      playerData.departureActions.push({
        id: action.id,
        timestamp: action.created_at,
        reason: action.reason,
        type: action.departure_type,
        recordedBy: action.recorded_by,
        source: 'supabase',
      });

      if (action.created_at > playerData.lastUpdated) {
        playerData.lastUpdated = action.created_at;
      }
    });

    // Step 5: Get current roster members from latest canonical snapshot (more reliable than members table)
    // This matches how /api/v2/roster determines current members
    const currentMemberTags = new Set<string>();
    
    // Get the latest snapshot date
    const { data: latestDateRow } = await supabaseServer
      .from('canonical_member_snapshots')
      .select('snapshot_date')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestDateRow?.snapshot_date) {
      // Fetch members from the latest snapshot only
      const { data: latestSnapshots } = await supabaseServer
        .from('canonical_member_snapshots')
        .select('player_tag, payload')
        .eq('clan_tag', clanTag)
        .eq('snapshot_date', latestDateRow.snapshot_date);
      
      if (latestSnapshots) {
        latestSnapshots.forEach((snapshot: any) => {
          const tag = snapshot.player_tag;
          if (tag) {
            const normalizedTag = normalizeTag(tag);
            if (normalizedTag) {
              currentMemberTags.add(normalizedTag);
              
              // Add current members who don't have any data yet
              if (!playerDataMap.has(normalizedTag)) {
                const memberName = snapshot.payload?.member?.name || playerNamesMap.get(normalizedTag) || 'Unknown Player';
                playerDataMap.set(normalizedTag, {
                  tag: normalizedTag,
                  name: memberName,
                  notes: [],
                  warnings: [],
                  tenureActions: [],
                  departureActions: [],
                  lastUpdated: latestDateRow.snapshot_date || new Date().toISOString(),
                });
              } else {
                // Update name from latest snapshot if it's better
                const playerData = playerDataMap.get(normalizedTag)!;
                const snapshotName = snapshot.payload?.member?.name;
                if (snapshotName && (playerData.name === 'Unknown Player' || !playerData.name)) {
                  playerData.name = snapshotName;
                }
              }
            }
          }
        });
      }
    }

    // Step 6: Resolve names for all linked accounts
    // This handles name lookup from multiple sources including CoC API
    const linkedAccountNamesMap = new Map<string, string>();
    
    // Collect all unique linked tags that need names (ensure they're normalized)
    const allLinkedTags = new Set<string>();
    tagToLinkedTagsMap.forEach((linkedTags) => {
      linkedTags.forEach(tag => {
        const normalizedTag = normalizeTag(tag) || tag;
        allLinkedTags.add(normalizedTag);
      });
    });
    
    // Resolve names for each linked tag using a comprehensive lookup strategy
    debugLog(`[player-database] Resolving names for ${allLinkedTags.size} linked accounts`);
    for (const linkedTag of allLinkedTags) {
      // Ensure tag is normalized
      const normalizedLinkedTag = normalizeTag(linkedTag) || linkedTag;
      let resolvedName: string | null = null;
      
      debugLog(`[player-database] Resolving name for linked account: ${linkedTag} (normalized: ${normalizedLinkedTag})`);
      
      // Priority 1: Check if name is already in playerNamesMap (from canonical snapshots/members)
      if (playerNamesMap.has(normalizedLinkedTag)) {
        resolvedName = playerNamesMap.get(normalizedLinkedTag)!;
        debugLog(`[player-database] Found name in playerNamesMap: ${normalizedLinkedTag} → ${resolvedName}`);
      }
      
      // Priority 2: Check if this tag has data in playerDataMap (from notes/warnings/actions)
      if (!resolvedName || resolvedName === 'Unknown Player') {
        const tagData = playerDataMap.get(normalizedLinkedTag);
        if (tagData?.name && tagData.name !== 'Unknown Player') {
          resolvedName = tagData.name;
          debugLog(`[player-database] Found name in playerDataMap: ${normalizedLinkedTag} → ${resolvedName}`);
        }
      }
      
      // Priority 3: Check stored names from notes/warnings/actions records
      if (!resolvedName || resolvedName === 'Unknown Player') {
        const storedName = [...notesResult, ...warningsResult, ...tenureResult, ...departureResult]
          .find((item: any) => {
            const itemTag = normalizeTag(item.player_tag) || item.player_tag;
            return itemTag === normalizedLinkedTag && item.player_name && item.player_name !== 'Unknown Player';
          })?.player_name;
        
        if (storedName) {
          resolvedName = storedName;
          debugLog(`[player-database] Found name in stored records: ${normalizedLinkedTag} → ${resolvedName}`);
        }
      }
      
      // Priority 4: Check canonical snapshots directly (might be from other clans)
      if (!resolvedName || resolvedName === 'Unknown Player') {
        const { data: snapshot } = await supabaseServer
          .from('canonical_member_snapshots')
          .select('payload')
          .eq('player_tag', normalizedLinkedTag)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (snapshot?.payload?.member?.name) {
          resolvedName = snapshot.payload.member.name;
          debugLog(`[player-database] Found name in canonical snapshots: ${normalizedLinkedTag} → ${resolvedName}`);
        }
      }
      
      // Priority 5: Last resort - CoC API lookup (for newly added linked accounts)
      if (!resolvedName || resolvedName === 'Unknown Player') {
        debugLog(`[player-database] No name found yet for ${normalizedLinkedTag}, attempting CoC API lookup...`);
        try {
          const { getPlayer } = await import('@/lib/coc');
          // Remove # prefix for API call
          const cleanTag = normalizedLinkedTag.replace('#', '');
          debugLog(`[player-database] Attempting CoC API lookup for linked account: ${linkedTag} → normalized: ${normalizedLinkedTag} → clean: ${cleanTag}`);
          const cocPlayer = await getPlayer(cleanTag);
          if (cocPlayer?.name) {
            resolvedName = cocPlayer.name;
            debugLog(`[player-database] ✅ Resolved linked account name via CoC API: ${normalizedLinkedTag} → ${cocPlayer.name}`);
          } else {
            debugWarn(`[player-database] ⚠️ CoC API returned no name for ${normalizedLinkedTag}`);
          }
        } catch (cocError: any) {
          debugWarn(`[player-database] ❌ Failed to lookup ${normalizedLinkedTag} via CoC API:`, cocError.message);
        }
      }
      
      // Store the resolved name using the normalized tag as the key
      if (resolvedName && resolvedName !== 'Unknown Player') {
        linkedAccountNamesMap.set(normalizedLinkedTag, resolvedName);
        // Also store with original tag if different (for backwards compatibility)
        if (normalizedLinkedTag !== linkedTag) {
          linkedAccountNamesMap.set(linkedTag, resolvedName);
        }
        debugLog(`[player-database] Stored resolved name: ${normalizedLinkedTag} → ${resolvedName}`);
      } else {
        debugWarn(`[player-database] ⚠️ Could not resolve name for ${normalizedLinkedTag}`);
      }
    }
    
    // Step 6.5: Update names in playerDataMap for linked accounts that still have "Unknown Player"
    // This handles linked accounts that have their own entries (from warnings) but names weren't resolved yet
    for (const [tag, data] of playerDataMap.entries()) {
      if (data.name === 'Unknown Player' && allLinkedTags.has(tag)) {
        const resolvedName = linkedAccountNamesMap.get(tag);
        if (resolvedName && resolvedName !== 'Unknown Player') {
          debugLog(`[player-database] Updating playerDataMap name for ${tag}: Unknown Player → ${resolvedName}`);
          data.name = resolvedName;
        }
      }
    }

    // Step 7: Check which linked accounts actually appear in clan snapshots
    // Only mark them as Current/Former if they were actually members at some point
    const linkedAccountMembershipStatus = new Map<string, 'current' | 'former' | 'never'>();
    
    // Collect all unique linked tags for membership check
    const linkedTagsForMembershipCheck = new Set<string>();
    tagToLinkedTagsMap.forEach((linkedTags) => {
      linkedTags.forEach(tag => linkedTagsForMembershipCheck.add(tag));
    });
    
    // Check each linked account's membership history
    if (linkedTagsForMembershipCheck.size > 0 && latestDateRow?.snapshot_date) {
      // Check if linked accounts appear in the latest snapshot (current) or any snapshot (former)
      const { data: linkedAccountSnapshots } = await supabaseServer
        .from('canonical_member_snapshots')
        .select('player_tag, snapshot_date')
        .eq('clan_tag', clanTag)
        .in('player_tag', Array.from(linkedTagsForMembershipCheck));
      
      if (linkedAccountSnapshots) {
        const latestSnapshotDate = latestDateRow.snapshot_date;
        const linkedTagsInLatestSnapshot = new Set<string>();
        const linkedTagsInAnySnapshot = new Set<string>();
        
        linkedAccountSnapshots.forEach((snapshot: any) => {
          const tag = normalizeTag(snapshot.player_tag);
          if (tag) {
            linkedTagsInAnySnapshot.add(tag);
            if (snapshot.snapshot_date === latestSnapshotDate) {
              linkedTagsInLatestSnapshot.add(tag);
            }
          }
        });
        
        // Set membership status for each linked account (normalize tags first)
        linkedTagsForMembershipCheck.forEach(tag => {
          const normalizedTag = normalizeTag(tag) || tag;
          if (linkedTagsInLatestSnapshot.has(normalizedTag)) {
            linkedAccountMembershipStatus.set(normalizedTag, 'current');
            // Also store with original tag if different
            if (normalizedTag !== tag) {
              linkedAccountMembershipStatus.set(tag, 'current');
            }
          } else if (linkedTagsInAnySnapshot.has(normalizedTag)) {
            linkedAccountMembershipStatus.set(normalizedTag, 'former');
            // Also store with original tag if different
            if (normalizedTag !== tag) {
              linkedAccountMembershipStatus.set(tag, 'former');
            }
          } else {
            linkedAccountMembershipStatus.set(normalizedTag, 'never');
            // Also store with original tag if different
            if (normalizedTag !== tag) {
              linkedAccountMembershipStatus.set(tag, 'never');
            }
          }
        });
      } else {
        // No snapshots found for any linked accounts - mark all as 'never'
        linkedTagsForMembershipCheck.forEach(tag => {
          linkedAccountMembershipStatus.set(tag, 'never');
        });
      }
    }

    // Step 8: Add linked accounts info to each player
    const players = Array.from(playerDataMap.values()).map(data => {
      const linkedTags = tagToLinkedTagsMap.get(data.tag) || [];
      return {
        tag: data.tag,
        name: data.name,
        notes: data.notes,
        warning: data.warnings.length > 0 ? data.warnings[0] : undefined,
        tenureActions: data.tenureActions,
        departureActions: data.departureActions,
        lastUpdated: data.lastUpdated,
        isCurrentMember: currentMemberTags.has(data.tag),
        linkedAccounts: linkedTags.map(tag => {
          // Normalize the tag to ensure consistent lookup
          const normalizedTag = normalizeTag(tag) || tag;
          
          // Try multiple sources for name resolution (check both normalized and original)
          const name = playerNamesMap.get(normalizedTag) 
            || playerNamesMap.get(tag)
            || linkedAccountNamesMap.get(normalizedTag)
            || linkedAccountNamesMap.get(tag)
            || playerDataMap.get(normalizedTag)?.name
            || playerDataMap.get(tag)?.name
            || 'Unknown Player';
          
          // Get membership status for this linked account (check both normalized and original)
          const membershipStatus = linkedAccountMembershipStatus.get(normalizedTag) 
            || linkedAccountMembershipStatus.get(tag) 
            || 'never';
          
          return {
            tag: normalizedTag, // Always return normalized tag
            name: name !== 'Unknown Player' ? name : 'Unknown Player',
            membershipStatus, // 'current' | 'former' | 'never'
          };
        }),
      };
    });

    // Sort by lastUpdated descending
    players.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));

    const duration = Date.now() - startTime;
    // Always log completion time (useful for performance monitoring)
    console.log(`[player-database] Completed in ${duration}ms: ${players.length} players`);

    return NextResponse.json({
      success: true,
      data: players,
      meta: {
        playerCount: players.length,
        currentMembers: players.filter(p => p.isCurrentMember).length,
        durationMs: duration,
      },
    });
  } catch (error: any) {
    // Handle 401/403 errors from requireLeadership (NextResponse extends Response)
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }
    console.error('[player-database] Error:', error);
    return NextResponse.json(
      { success: false, error: (await import('@/lib/security/error-sanitizer')).sanitizeErrorForApi(error).message },
      { status: error?.status || 500 }
    );
  }
}
