import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import type { FullClanSnapshot, MemberSummary } from '@/lib/full-snapshot';
import { extractHeroLevels } from '@/lib/coc';
import { calculateRushPercentage } from '@/lib/business/calculations';
import type { HeroCaps } from '@/types';
import type { ClanRoleName } from '@/lib/auth/roles';

type HeroLevels = Partial<Record<keyof HeroCaps, number | null>>;

function normalizeClanRole(role?: string | null): ClanRoleName {
  const value = (role || '').toLowerCase();
  if (value === 'leader') return 'leader';
  if (value === 'coleader' || value === 'co-leader' || value === 'co_leader') return 'coleader';
  if (value === 'elder' || value === 'admin') return 'elder';
  if (value === 'member') return 'member';
  return 'viewer';
}

async function syncUserRolesForClan(clanId: string, tagRoleMap: Map<string, ClanRoleName>) {
  const supabase = getSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from('user_roles')
    .select('id, player_tag')
    .eq('clan_id', clanId);

  if (error) {
    console.warn('[persist-roster] Failed to load user roles for sync', error);
    return;
  }

  const updates: Array<{ id: string; role: ClanRoleName }> = [];

  for (const row of existing ?? []) {
    const tag = normalizeTag(row.player_tag || '');
    const role = tag ? tagRoleMap.get(tag) ?? 'viewer' : 'viewer';
    updates.push({ id: row.id, role });
  }

  if (!updates.length) return;

  const { error: updateError } = await supabase
    .from('user_roles')
    .upsert(updates, { onConflict: 'id', ignoreDuplicates: false });

  if (updateError) {
    console.warn('[persist-roster] Failed to sync user roles', updateError);
  }
}

function pickLargestBadge(clan: any): string | null {
  const badgeUrls = clan?.badgeUrls ?? {};
  return badgeUrls?.large || badgeUrls?.medium || badgeUrls?.small || null;
}

function buildHeroLevels(detail: any): HeroLevels | null {
  if (!detail) return null;
  try {
    const levels = extractHeroLevels(detail);
    return {
      bk: levels.bk ?? null,
      aq: levels.aq ?? null,
      gw: levels.gw ?? null,
      rc: levels.rc ?? null,
      mp: levels.mp ?? null,
    };
  } catch (error) {
    console.warn('[persist-roster] Failed to extract hero levels', error);
    return null;
  }
}

function computeRushPercent(thLevel: number | undefined, heroLevels: HeroLevels | null): number | null {
  if (!thLevel || !heroLevels) return null;
  const syntheticMember = {
    townHallLevel: thLevel,
    bk: heroLevels.bk ?? 0,
    aq: heroLevels.aq ?? 0,
    gw: heroLevels.gw ?? 0,
    rc: heroLevels.rc ?? 0,
    mp: heroLevels.mp ?? 0,
  } as any;
  try {
    return calculateRushPercentage(syntheticMember);
  } catch (error) {
    console.warn('[persist-roster] Failed to compute rush percent', error);
    return null;
  }
}

function buildExtras(summary: MemberSummary, detail: any) {
  return {
    builderHallLevel: summary.builderHallLevel ?? detail?.builderHallLevel ?? null,
    townHallWeaponLevel: summary.townHallWeaponLevel ?? detail?.townHallWeaponLevel ?? null,
    builderTrophies: summary.builderTrophies ?? detail?.versusTrophies ?? null,
    clanRank: summary.clanRank ?? null,
    previousClanRank: summary.previousClanRank ?? null,
  };
}

export async function persistRosterSnapshotToDataSpine(snapshot: FullClanSnapshot) {
  const supabase = getSupabaseServerClient();
  const clanTag = normalizeTag(snapshot.clanTag);

  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .upsert({
      tag: clanTag,
      name: snapshot.clan?.name ?? null,
      logo_url: pickLargestBadge(snapshot.clan),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tag' })
    .select('id, tag')
    .single();

  if (clanError) {
    throw new Error(`[persist-roster] Failed to upsert clan: ${clanError.message}`);
  }

  const memberUpserts = snapshot.memberSummaries.map((summary) => {
    const normalized = normalizeTag(summary.tag);
    const detail = snapshot.playerDetails?.[normalized];
    return {
      clan_id: clanRow.id,
      tag: normalized,
      name: summary.name,
      th_level: summary.townHallLevel ?? detail?.townHallLevel ?? null,
      role: summary.role ?? null,
      league: summary.league ?? detail?.league ?? null,
      builder_league: detail?.builderBaseLeague ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .upsert(memberUpserts, { onConflict: 'clan_id,tag' })
    .select('id, tag');

  if (memberError) {
    throw new Error(`[persist-roster] Failed to upsert members: ${memberError.message}`);
  }

  const memberIdByTag = new Map<string, string>();
  for (const row of memberRows ?? []) {
    memberIdByTag.set(normalizeTag(row.tag), row.id);
  }

  const totalTrophies = snapshot.memberSummaries.reduce((sum, m) => sum + (m.trophies ?? 0), 0);
  const totalDonations = snapshot.memberSummaries.reduce((sum, m) => sum + (m.donations ?? 0), 0);

  const { data: existingSnapshot } = await supabase
    .from('roster_snapshots')
    .select('id')
    .eq('clan_id', clanRow.id)
    .eq('fetched_at', snapshot.fetchedAt)
    .maybeSingle();

  let snapshotId: string;

  if (existingSnapshot) {
    snapshotId = existingSnapshot.id;
    await supabase.from('member_snapshot_stats').delete().eq('snapshot_id', snapshotId);
  } else {
    const { data: insertedSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .insert({
        clan_id: clanRow.id,
        fetched_at: snapshot.fetchedAt,
        member_count: snapshot.metadata.memberCount,
        total_trophies: totalTrophies,
        total_donations: totalDonations,
        payload: snapshot,
        metadata: snapshot.metadata,
      })
      .select('id')
      .single();

    if (snapshotError) {
      throw new Error(`[persist-roster] Failed to insert roster snapshot: ${snapshotError.message}`);
    }

    snapshotId = insertedSnapshot.id;
  }

  const snapshotStats = snapshot.memberSummaries.map((summary) => {
    const tag = normalizeTag(summary.tag);
    const memberId = memberIdByTag.get(tag);
    if (!memberId) return null;
    const detail = snapshot.playerDetails?.[tag];
    const heroLevels = buildHeroLevels(detail);
    const rushPercent = computeRushPercent(summary.townHallLevel ?? detail?.townHallLevel, heroLevels);
    return {
      snapshot_id: snapshotId,
      member_id: memberId,
      th_level: summary.townHallLevel ?? detail?.townHallLevel ?? null,
      role: summary.role ?? null,
      trophies: detail?.trophies ?? summary.trophies ?? null,  // detail.trophies = ranked battle trophies (correct for new system)
      donations: summary.donations ?? null,
      donations_received: summary.donationsReceived ?? null,
      hero_levels: heroLevels,
      activity_score: null,
      rush_percent: rushPercent,
      extras: buildExtras(summary, detail),
      ranked_league_id: detail?.leagueTier?.id ?? null,
      ranked_league_name: detail?.leagueTier?.name ?? null,
    };
  }).filter(Boolean) as any[];

  if (snapshotStats.length) {
    const { error: statsError } = await supabase
      .from('member_snapshot_stats')
      .insert(snapshotStats);

    if (statsError) {
      throw new Error(`[persist-roster] Failed to insert member snapshot stats: ${statsError.message}`);
    }
  }

  const tagRoleMap = new Map<string, ClanRoleName>();
  snapshot.memberSummaries.forEach((summary) => {
    const tag = normalizeTag(summary.tag);
    if (tag) {
      tagRoleMap.set(tag, normalizeClanRole(summary.role));
    }
  });
  await syncUserRolesForClan(clanRow.id, tagRoleMap);
}
