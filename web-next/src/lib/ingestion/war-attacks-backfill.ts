import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag, safeTagForFilename } from '@/lib/tags';
import { persistWarData } from '@/lib/ingestion/persist-war-data';
import type { FullClanSnapshot } from '@/lib/full-snapshot';

export type WarAttacksBackfillOptions = {
  clanTag: string;
  daysBack?: number;
  pageSize?: number;
  maxSnapshots?: number;
};

export type WarAttacksBackfillResult = {
  clanTag: string;
  daysBack: number;
  processedSnapshots: number;
  snapshotsWithAttacks: number;
  persistedSnapshots: number;
};

export async function backfillWarAttacksFromSnapshots(
  options: WarAttacksBackfillOptions
): Promise<WarAttacksBackfillResult> {
  const { clanTag, daysBack = 120, pageSize = 50, maxSnapshots = 0 } = options;
  const normalizedClan = normalizeTag(clanTag);
  if (!normalizedClan) {
    throw new Error('Invalid clan tag for war attack backfill');
  }

  const supabase = getSupabaseAdminClient();
  const safeTag = safeTagForFilename(normalizedClan);
  const clanTagVariants = Array.from(new Set([
    safeTag,
    normalizedClan,
    normalizedClan.toLowerCase(),
  ]));
  const sinceIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  let offset = 0;
  let processed = 0;
  let snapshotsWithAttacks = 0;
  let persisted = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('clan_snapshots')
      .select('clan_tag, fetched_at, clan, member_summaries, player_details, current_war, war_log, capital_seasons, metadata')
      .in('clan_tag', clanTagVariants)
      .gte('fetched_at', sinceIso)
      .order('fetched_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load clan_snapshots: ${error.message}`);
    }

    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      if (maxSnapshots && processed >= maxSnapshots) break;
      processed += 1;

      const currentWar = row.current_war;
      const hasAttacks =
        currentWar &&
        Array.isArray(currentWar?.clan?.members) &&
        currentWar.clan.members.some((member: any) => Array.isArray(member?.attacks) && member.attacks.length > 0);

      if (!hasAttacks) continue;
      snapshotsWithAttacks += 1;

      const snapshot: FullClanSnapshot = {
        clanTag: normalizedClan,
        fetchedAt: row.fetched_at,
        clan: row.clan,
        memberSummaries: row.member_summaries,
        playerDetails: row.player_details,
        currentWar: currentWar,
        warLog: row.war_log ?? [],
        capitalRaidSeasons: row.capital_seasons ?? [],
        metadata: row.metadata ?? {},
      };

      await persistWarData(snapshot);
      persisted += 1;
    }

    if (maxSnapshots && processed >= maxSnapshots) break;
    offset += pageSize;
  }

  return {
    clanTag: normalizedClan,
    daysBack,
    processedSnapshots: processed,
    snapshotsWithAttacks,
    persistedSnapshots: persisted,
  };
}
