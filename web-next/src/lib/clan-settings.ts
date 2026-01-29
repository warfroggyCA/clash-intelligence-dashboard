import { getSupabaseServerClient } from './supabase-server';
import { normalizeTag } from './tags';

export type ClanSettingKey = 
  | 'rosterVisibility' 
  | 'showMinis' 
  | 'warPlannerAccess' 
  | 'vipVisibility' 
  | 'leaderboardEnabled'
  | 'autoSyncRoles';

export async function getClanSetting<T>(clanTag: string, key: ClanSettingKey, defaultValue: T): Promise<T> {
  try {
    const supabase = getSupabaseServerClient();
    const normalized = normalizeTag(clanTag);
    if (!normalized) return defaultValue;

    // Get clan ID
    const { data: clan } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', normalized)
      .single();

    if (!clan) return defaultValue;

    const { data } = await supabase
      .from('clan_settings')
      .select('value')
      .eq('clan_id', clan.id)
      .eq('key', key)
      .maybeSingle();

    return data ? (data.value as T) : defaultValue;
  } catch (err) {
    console.error(`[settings] Failed to fetch key ${key}:`, err);
    return defaultValue;
  }
}

export async function getAllClanSettings(clanTag: string) {
  try {
    const supabase = getSupabaseServerClient();
    const normalized = normalizeTag(clanTag);
    if (!normalized) return {};

    const { data: clan } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', normalized)
      .single();

    if (!clan) return {};

    const { data: rows } = await supabase
      .from('clan_settings')
      .select('key, value')
      .eq('clan_id', clan.id);

    return (rows || []).reduce((acc: any, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  } catch (err) {
    console.error(`[settings] Failed to fetch all settings:`, err);
    return {};
  }
}
