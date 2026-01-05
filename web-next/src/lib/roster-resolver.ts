import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import { buildHistoryTenureMap, readLedgerEffective } from '@/lib/tenure';

export type ResolvedRosterMember = {
  id: string;
  tag: string;
  name: string;
  cumulative_donations_given: number | null;
  cumulative_donations_received: number | null;
  th_level: number | null;
  role: string | null;
  trophies: number | null;
  donations: number | null;
  donations_received: number | null;
  hero_levels: Record<string, any> | null;
  activity_score: number | null;
  rush_percent: number | null;
  war_stars: number | null;
  attack_wins: number | null;
  defense_wins: number | null;
  capital_contributions: number | null;
  pet_levels: Record<string, any> | null;
  builder_hall_level: number | null;
  versus_trophies: number | null;
  versus_battle_wins: number | null;
  builder_league_id: number | null;
  max_troop_count: number | null;
  max_spell_count: number | null;
  super_troops_active: string[] | null;
  achievement_count: number | null;
  achievement_score: number | null;
  exp_level: number | null;
  equipment_flags: Record<string, any> | null;
  best_trophies: number | null;
  best_versus_trophies: number | null;
  ranked_trophies: number | null;
  ranked_league_id: number | null;
  ranked_league_name: string | null;
  league_id: number | null;
  league_name: string | null;
  league_trophies: number | null;
  battle_mode_trophies: number | null;
  tenure_days: number | null;
  tenure_as_of: string | null;
  snapshot_date: string | null;
};

export type ResolveRosterMembersResult = {
  members: ResolvedRosterMember[];
  memberTagToId: Map<string, string>;
  memberIdToTag: Map<string, string>;
};

export type LatestRosterSnapshot = {
  clanId: string;
  clanTag: string;
  snapshotId: string;
  fetchedAt: string | null;
  snapshotDate: string | null;
};

export async function getLatestRosterSnapshot(params: {
  clanTag: string;
  supabase?: ReturnType<typeof getSupabaseServerClient>;
}): Promise<LatestRosterSnapshot | null> {
  const supabase = params.supabase ?? getSupabaseServerClient();
  const clanTag = normalizeTag(params.clanTag);
  if (!clanTag) {
    return null;
  }

  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .select('id, tag')
    .eq('tag', clanTag)
    .maybeSingle();

  if (clanError || !clanRow?.id) {
    return null;
  }

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('roster_snapshots')
    .select('id, fetched_at')
    .eq('clan_id', clanRow.id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError || !snapshotRow?.id) {
    return null;
  }

  const snapshotDate = snapshotRow.fetched_at ? snapshotRow.fetched_at.slice(0, 10) : null;

  return {
    clanId: clanRow.id,
    clanTag,
    snapshotId: snapshotRow.id,
    fetchedAt: snapshotRow.fetched_at ?? null,
    snapshotDate,
  };
}

export async function resolveRosterMembers(params: {
  clanTag: string;
  snapshotId: string;
  snapshotDate?: string | null;
  supabase?: ReturnType<typeof getSupabaseServerClient>;
}): Promise<ResolveRosterMembersResult> {
  const supabase = params.supabase ?? getSupabaseServerClient();
  const clanTag = normalizeTag(params.clanTag);
  if (!clanTag) {
    throw new Error('Invalid clanTag');
  }

  const { data: statsRows, error: statsError } = await supabase
    .from('member_snapshot_stats')
    .select(
      'member_id, th_level, role, trophies, donations, donations_received, hero_levels, activity_score, rush_percent, war_stars, attack_wins, defense_wins, capital_contributions, pet_levels, builder_hall_level, versus_trophies, versus_battle_wins, builder_league_id, max_troop_count, max_spell_count, super_troops_active, achievement_count, achievement_score, exp_level, equipment_flags, best_trophies, best_versus_trophies, ranked_trophies, ranked_league_id, ranked_league_name, league_id, league_name, league_trophies, battle_mode_trophies, tenure_days, tenure_as_of',
    )
    .eq('snapshot_id', params.snapshotId);

  if (statsError) {
    throw new Error(`Roster stats lookup failed: ${statsError.message}`);
  }

  const stats = statsRows ?? [];
  const memberIds = stats.map((row) => row.member_id).filter(Boolean) as string[];
  if (!memberIds.length) {
    return { members: [], memberTagToId: new Map(), memberIdToTag: new Map() };
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('id, tag, name, cumulative_donations_given, cumulative_donations_received')
    .in('id', memberIds);

  if (memberError) {
    throw new Error(`Members lookup failed: ${memberError.message}`);
  }

  const memberLookup = new Map(memberRows?.map((member) => [member.id, member]) || []);
  const memberTags = (memberRows || [])
    .map((member) => normalizeTag(member.tag || ''))
    .filter((tag): tag is string => Boolean(tag));

  const { data: historyRows, error: historyError } = memberTags.length
    ? await supabase
        .from('player_history')
        .select('player_tag, total_tenure, current_stint')
        .eq('clan_tag', clanTag)
        .in('player_tag', memberTags)
    : { data: [], error: null };

  if (historyError) {
    throw new Error(`Player history lookup failed: ${historyError.message}`);
  }

  const historyTenureMap = buildHistoryTenureMap(historyRows || []);
  const ledgerTenureMap = await readLedgerEffective(params.snapshotDate ?? undefined);

  const members: ResolvedRosterMember[] = stats
    .map((stat) => {
      const member = memberLookup.get(stat.member_id);
      if (!member?.tag) return null;
      const normalizedTag = normalizeTag(member.tag) || member.tag;
      // Priority: member_snapshot_stats (from members table) > player_history > ledger
      const resolvedTenureDays =
        stat.tenure_days ?? historyTenureMap[normalizedTag]?.days ?? ledgerTenureMap[normalizedTag] ?? null;
      const resolvedTenureAsOf =
        stat.tenure_as_of ?? historyTenureMap[normalizedTag]?.asOf ?? null;

      return {
        id: member.id,
        tag: normalizedTag,
        name: member.name || normalizedTag,
        cumulative_donations_given: member.cumulative_donations_given ?? null,
        cumulative_donations_received: member.cumulative_donations_received ?? null,
        th_level: stat.th_level ?? null,
        role: stat.role ?? null,
        trophies: stat.trophies ?? null,
        donations: stat.donations ?? null,
        donations_received: stat.donations_received ?? null,
        hero_levels: stat.hero_levels ?? null,
        activity_score: stat.activity_score ?? null,
        rush_percent: stat.rush_percent ?? null,
        war_stars: stat.war_stars ?? null,
        attack_wins: stat.attack_wins ?? null,
        defense_wins: stat.defense_wins ?? null,
        capital_contributions: stat.capital_contributions ?? null,
        pet_levels: stat.pet_levels ?? null,
        builder_hall_level: stat.builder_hall_level ?? null,
        versus_trophies: stat.versus_trophies ?? null,
        versus_battle_wins: stat.versus_battle_wins ?? null,
        builder_league_id: stat.builder_league_id ?? null,
        max_troop_count: stat.max_troop_count ?? null,
        max_spell_count: stat.max_spell_count ?? null,
        super_troops_active: stat.super_troops_active ?? null,
        achievement_count: stat.achievement_count ?? null,
        achievement_score: stat.achievement_score ?? null,
        exp_level: stat.exp_level ?? null,
        equipment_flags: stat.equipment_flags ?? null,
        best_trophies: stat.best_trophies ?? null,
        best_versus_trophies: stat.best_versus_trophies ?? null,
        ranked_trophies: stat.ranked_trophies ?? null,
        ranked_league_id: stat.ranked_league_id ?? null,
        ranked_league_name: stat.ranked_league_name ?? null,
        league_id: stat.league_id ?? null,
        league_name: stat.league_name ?? null,
        league_trophies: stat.league_trophies ?? null,
        battle_mode_trophies: stat.battle_mode_trophies ?? null,
        tenure_days: resolvedTenureDays,
        tenure_as_of: resolvedTenureAsOf,
        snapshot_date: params.snapshotDate ?? null,
      };
    })
    .filter((member): member is ResolvedRosterMember => Boolean(member));

  const memberTagToId = new Map<string, string>();
  const memberIdToTag = new Map<string, string>();
  for (const member of members) {
    if (member.id && member.tag) {
      memberTagToId.set(member.tag, member.id);
      memberIdToTag.set(member.id, member.tag);
    }
  }

  return { members, memberTagToId, memberIdToTag };
}
