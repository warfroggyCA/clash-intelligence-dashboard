/**
 * Player Alias Links Utility Functions
 * 
 * Manages bidirectional relationships between separate player accounts (aliases).
 * Relationships are stored with player_tag_1 < player_tag_2 to prevent duplicates.
 */

import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, isValidTag } from '@/lib/tags';

/**
 * Get all player tags linked to a given tag
 * Returns all tags that are linked bidirectionally (checks both player_tag_1 and player_tag_2)
 */
export async function getLinkedTags(
  clanTag: string,
  playerTag: string
): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedPlayerTag = normalizeTag(playerTag);

  if (!normalizedClanTag || !normalizedPlayerTag || !isValidTag(normalizedClanTag) || !isValidTag(normalizedPlayerTag)) {
    return [];
  }

  // Query both directions: where tag is player_tag_1 or player_tag_2
  const { data, error } = await supabase
    .from('player_alias_links')
    .select('player_tag_1, player_tag_2')
    .eq('clan_tag', normalizedClanTag)
    .or(`player_tag_1.eq.${normalizedPlayerTag},player_tag_2.eq.${normalizedPlayerTag}`);

  if (error) {
    console.error('Error fetching linked tags:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Extract all linked tags (excluding the input tag)
  const linkedTags = new Set<string>();
  data.forEach((link) => {
    if (link.player_tag_1 === normalizedPlayerTag) {
      linkedTags.add(link.player_tag_2);
    } else {
      linkedTags.add(link.player_tag_1);
    }
  });

  return Array.from(linkedTags);
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
  const { data: snapshots } = await supabase
    .from('canonical_member_snapshots')
    .select('player_tag, payload')
    .eq('clan_tag', normalizeTag(clanTag))
    .in('player_tag', linkedTags)
    .order('snapshot_date', { ascending: false });

  const nameMap = new Map<string, string>();
  
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

  // Return all linked tags with names (or null if name not found)
  return linkedTags.map(tag => ({
    tag,
    name: nameMap.get(tag) || null,
  }));
}
