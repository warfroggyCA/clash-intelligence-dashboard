/**
 * Player Alias Links Utility Functions
 * 
 * Manages bidirectional relationships between separate player accounts (aliases).
 * Relationships are stored with player_tag_1 < player_tag_2 to prevent duplicates.
 */

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';

type AliasGraph = Map<string, Set<string>>;
const aliasGraphCache = new Map<string, { graph: AliasGraph; fetchedAt: number }>();
const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadAliasGraph(clanTag: string): Promise<AliasGraph> {
  const normalizedClanTag = normalizeTag(clanTag);
  if (!normalizedClanTag) {
    return new Map();
  }

  const cached = aliasGraphCache.get(normalizedClanTag);
  if (cached && Date.now() - cached.fetchedAt < GRAPH_CACHE_TTL_MS) {
    return cached.graph;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('player_alias_links')
    .select('player_tag_1, player_tag_2')
    .eq('clan_tag', normalizedClanTag);

  if (error) {
    console.error('Error loading alias graph:', error);
    return new Map();
  }

  const graph: AliasGraph = new Map();
  (data || []).forEach((row) => {
    const tag1 = normalizeTag(row.player_tag_1);
    const tag2 = normalizeTag(row.player_tag_2);
    if (!tag1 || !tag2) return;
    if (!graph.has(tag1)) graph.set(tag1, new Set());
    if (!graph.has(tag2)) graph.set(tag2, new Set());
    graph.get(tag1)!.add(tag2);
    graph.get(tag2)!.add(tag1);
  });

  aliasGraphCache.set(normalizedClanTag, { graph, fetchedAt: Date.now() });
  return graph;
}

function invalidateAliasGraph(clanTag: string) {
  const normalizedClanTag = normalizeTag(clanTag);
  if (normalizedClanTag) {
    aliasGraphCache.delete(normalizedClanTag);
  }
}

/**
 * Get all player tags linked to a given tag
 * Returns all tags that are linked bidirectionally (checks both player_tag_1 and player_tag_2)
 */
export async function getLinkedTags(
  clanTag: string,
  playerTag: string
): Promise<string[]> {
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedPlayerTag = normalizeTag(playerTag);

  if (!normalizedClanTag || !normalizedPlayerTag || !isValidTag(normalizedClanTag) || !isValidTag(normalizedPlayerTag)) {
    return [];
  }

  const graph = await loadAliasGraph(normalizedClanTag);
  if (!graph.size) return [];

  const visited = new Set<string>([normalizedPlayerTag]);
  const connected = new Set<string>();
  const stack = [normalizedPlayerTag];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const neighbors = graph.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        connected.add(neighbor);
        stack.push(neighbor);
      }
    }
  }

  connected.delete(normalizedPlayerTag);
  return Array.from(connected);
}

/**
 * Check if two tags are linked
 */
export async function areTagsLinked(
  clanTag: string,
  tag1: string,
  tag2: string
): Promise<boolean> {
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedTag1 = normalizeTag(tag1);
  const normalizedTag2 = normalizeTag(tag2);

  if (!normalizedClanTag || !normalizedTag1 || !normalizedTag2) {
    return false;
  }

  // Ensure consistent ordering (tag1 < tag2)
  const [smallerTag, largerTag] = normalizedTag1 < normalizedTag2
    ? [normalizedTag1, normalizedTag2]
    : [normalizedTag2, normalizedTag1];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('player_alias_links')
    .select('id')
    .eq('clan_tag', normalizedClanTag)
    .eq('player_tag_1', smallerTag)
    .eq('player_tag_2', largerTag)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking tag link:', error);
    return false;
  }

  return !!data;
}

/**
 * Create a bidirectional link between two player tags
 * Stores the relationship with player_tag_1 < player_tag_2 to prevent duplicates
 */
export async function linkPlayerTags(
  clanTag: string,
  tag1: string,
  tag2: string,
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedTag1 = normalizeTag(tag1);
  const normalizedTag2 = normalizeTag(tag2);

  if (!normalizedClanTag || !normalizedTag1 || !normalizedTag2) {
    return { success: false, error: 'Invalid clan tag or player tags' };
  }

  if (!isValidTag(normalizedClanTag) || !isValidTag(normalizedTag1) || !isValidTag(normalizedTag2)) {
    return { success: false, error: 'Invalid tag format' };
  }

  // Prevent self-links
  if (normalizedTag1 === normalizedTag2) {
    return { success: false, error: 'Cannot link a tag to itself' };
  }

  // Ensure consistent ordering (tag1 < tag2)
  const [smallerTag, largerTag] = normalizedTag1 < normalizedTag2
    ? [normalizedTag1, normalizedTag2]
    : [normalizedTag2, normalizedTag1];

  // Check if link already exists
  const alreadyLinked = await areTagsLinked(normalizedClanTag, smallerTag, largerTag);
  if (alreadyLinked) {
    return { success: false, error: 'Tags are already linked' };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('player_alias_links')
    .insert({
      clan_tag: normalizedClanTag,
      player_tag_1: smallerTag,
      player_tag_2: largerTag,
      created_by: createdBy || null,
    });

  if (error) {
    console.error('Error linking player tags:', error);
    return { success: false, error: error.message };
  }

  invalidateAliasGraph(normalizedClanTag);

  return { success: true };
}

/**
 * Remove a link between two player tags
 */
export async function unlinkPlayerTags(
  clanTag: string,
  tag1: string,
  tag2: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedTag1 = normalizeTag(tag1);
  const normalizedTag2 = normalizeTag(tag2);

  if (!normalizedClanTag || !normalizedTag1 || !normalizedTag2) {
    return { success: false, error: 'Invalid clan tag or player tags' };
  }

  // Ensure consistent ordering (tag1 < tag2)
  const [smallerTag, largerTag] = normalizedTag1 < normalizedTag2
    ? [normalizedTag1, normalizedTag2]
    : [normalizedTag2, normalizedTag1];

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('player_alias_links')
    .delete()
    .eq('clan_tag', normalizedClanTag)
    .eq('player_tag_1', smallerTag)
    .eq('player_tag_2', largerTag);

  if (error) {
    console.error('Error unlinking player tags:', error);
    return { success: false, error: error.message };
  }

  invalidateAliasGraph(normalizedClanTag);

  return { success: true };
}

/**
 * Get all linked tags with their names (for display purposes)
 */
export async function getLinkedTagsWithNames(
  clanTag: string,
  playerTag: string
): Promise<Array<{ tag: string; name: string | null }>> {
  const linkedTags = await getLinkedTags(clanTag, playerTag);
  
  if (linkedTags.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  
  // Try to get names from canonical snapshots first
  const normalizedLinkedTags = linkedTags
    .map((tag) => normalizeTag(tag))
    .filter((tag): tag is string => Boolean(tag));

  const nameMap = new Map<string, string>();

  if (normalizedLinkedTags.length > 0) {
    // Fetch latest known names from canonical snapshots across any clan
    const { data: snapshots } = await supabase
      .from('canonical_member_snapshots')
      .select('player_tag, payload')
      .in('player_tag', normalizedLinkedTags)
      .order('snapshot_date', { ascending: false });

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

    // Fallback: check members table for any unresolved tags
    const missingTags = normalizedLinkedTags.filter((tag) => !nameMap.has(tag));
    if (missingTags.length > 0) {
      const { data: memberRows } = await supabase
        .from('members')
        .select('tag, name')
        .in('tag', missingTags);

      if (memberRows) {
        memberRows.forEach((row) => {
          if (row?.tag && row?.name) {
            const normalizedTag = normalizeTag(row.tag);
            if (normalizedTag && !nameMap.has(normalizedTag)) {
              nameMap.set(normalizedTag, row.name);
            }
          }
        });
      }
    }
  }

  // Return all linked tags with names (or null if not found)
  return normalizedLinkedTags.map((tag) => ({
    tag,
    name: nameMap.get(tag) || null,
  }));
}
