import 'dotenv/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { getPlayer } from '@/lib/coc';
import { extractPetLevels } from '@/lib/ingestion/field-extractors';
import type { CanonicalMemberSnapshotV1 } from '@/types/canonical-member-snapshot';

type CanonicalRow = {
  id: string;
  player_tag: string;
  snapshot_date: string | null;
  created_at: string | null;
  payload: CanonicalMemberSnapshotV1;
};

const PAGE_SIZE = 200;
const UPDATE_BATCH = 25;
const CONCURRENCY = 3;

function parseArgs() {
  const args = new Map<string, string>();
  process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split('=');
    if (key && value) args.set(key.replace(/^--/, ''), value);
  });
  return args;
}

async function fetchLatestSnapshotsForClan(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanTag: string,
  maxPlayers?: number,
) {
  const latestByPlayer = new Map<string, CanonicalRow>();
  let offset = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from('canonical_member_snapshots')
      .select('id, player_tag, snapshot_date, created_at, payload')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch canonical snapshots: ${error.message}`);
    }
    if (!data || data.length === 0) {
      done = true;
      break;
    }

    for (const row of data as CanonicalRow[]) {
      if (!latestByPlayer.has(row.player_tag)) {
        latestByPlayer.set(row.player_tag, row);
      }
      if (maxPlayers && latestByPlayer.size >= maxPlayers) {
        done = true;
        break;
      }
    }

    if (done || data.length < PAGE_SIZE) {
      done = true;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return latestByPlayer;
}

async function updatePlayerDayPets(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  playerTag: string,
  pets: Record<string, number>,
) {
  const { data, error } = await supabase
    .from('player_day')
    .select('date')
    .eq('player_tag', playerTag)
    .order('date', { ascending: false })
    .limit(1);

  if (error) {
    console.warn(`[pets-backfill] Failed to load player_day for ${playerTag}: ${error.message}`);
    return;
  }
  const row = data?.[0];
  if (!row?.date) return;

  const { error: updateError } = await supabase
    .from('player_day')
    .update({ pets })
    .eq('player_tag', playerTag)
    .eq('date', row.date);

  if (updateError) {
    console.warn(`[pets-backfill] Failed to update player_day for ${playerTag}: ${updateError.message}`);
  }
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const current = items[index++];
      await task(current);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs();
  const clanTagRaw = args.get('clanTag') || args.get('clan') || process.env.HOME_CLAN_TAG;
  const clanTag = normalizeTag(clanTagRaw || '');
  if (!clanTag) {
    throw new Error('Missing clanTag. Use --clanTag=#TAG');
  }

  const dryRun = args.get('dryRun') === 'true';
  const maxPlayers = args.get('maxPlayers') ? Number(args.get('maxPlayers')) : undefined;
  const includePlayerDay = args.get('updatePlayerDay') !== 'false';

  process.env.SKIP_API_CALLS = 'false';

  const supabase = getSupabaseAdminClient();
  const latestSnapshots = await fetchLatestSnapshotsForClan(supabase, clanTag, maxPlayers);

  console.log(`[pets-backfill] Found ${latestSnapshots.size} latest snapshots for ${clanTag}`);

  const rows = Array.from(latestSnapshots.values());
  const updates: Array<{ id: string; payload: CanonicalMemberSnapshotV1; playerTag: string }> = [];
  let fetched = 0;
  let skipped = 0;
  let missing = 0;

  await runWithConcurrency(rows, CONCURRENCY, async (row) => {
    const existingPets = row.payload?.member?.pets;
    if (existingPets && Object.keys(existingPets).length > 0) {
      skipped += 1;
      return;
    }

    try {
      const cleanTag = row.player_tag.replace('#', '');
      const cocPlayer = await getPlayer(cleanTag);
      const pets = extractPetLevels(cocPlayer);
      if (!pets || Object.keys(pets).length === 0) {
        missing += 1;
        return;
      }
      fetched += 1;
      const updatedPayload: CanonicalMemberSnapshotV1 = {
        ...row.payload,
        member: {
          ...row.payload.member,
          pets,
        },
      };
      updates.push({ id: row.id, payload: updatedPayload, playerTag: row.player_tag });
    } catch (error: any) {
      console.warn(`[pets-backfill] Failed to fetch pets for ${row.player_tag}: ${error?.message || error}`);
    }
  });

  console.log(`[pets-backfill] Fetch summary: updated=${updates.length}, skipped=${skipped}, missing=${missing}`);

  if (dryRun) {
    console.log('[pets-backfill] Dry run enabled. No updates applied.');
    return;
  }

  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH);
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from('canonical_member_snapshots')
          .update({ payload: row.payload })
          .eq('id', row.id)
      )
    );
    const failed = results.filter((result) => result.error);
    if (failed.length > 0) {
      console.error(
        `[pets-backfill] Failed to update batch ${i}-${i + batch.length - 1}: ${failed[0].error?.message || 'unknown error'}`
      );
      continue;
    }

    if (includePlayerDay) {
      for (const row of batch) {
        const pets = row.payload.member.pets || {};
        if (Object.keys(pets).length > 0) {
          await updatePlayerDayPets(supabase, row.playerTag, pets);
        }
      }
    }

    console.log(`[pets-backfill] Updated ${Math.min(i + batch.length, updates.length)} / ${updates.length}`);
  }

  console.log('[pets-backfill] Done.');
}

main().catch((error) => {
  console.error('[pets-backfill] Failed:', error);
  process.exit(1);
});
