import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

export type ClanRoleName = 'leader' | 'coleader' | 'elder' | 'member' | 'viewer';

export interface UserRoleRecord {
  clan_id: string;
  clan_tag: string;
  role: ClanRoleName;
  player_tag?: string | null;
}

export async function getUserClanRoles(userId: string): Promise<UserRoleRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('clan_id, role, player_tag, clans(tag)')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data || []).map((row: any) => ({
    clan_id: row.clan_id,
    clan_tag: normalizeTag(row.clans?.tag) || '',
    role: row.role,
    player_tag: row.player_tag,
  }));
}

export function hasRole(roles: UserRoleRecord[], clanTag: string, allowed: ClanRoleName[]): boolean {
  const normalized = normalizeTag(clanTag);
  return roles.some((role) => role.clan_tag === normalized && allowed.includes(role.role));
}

