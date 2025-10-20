import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';
import { getSupabaseServerClient } from '../src/lib/supabase-server';
import { backfillPlayerDay } from '../src/lib/ingestion/player-day-backfill';

config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  try {
    const supabase = getSupabaseServerClient();
    console.log('Starting player_day backfill...');

    let playersProcessed = 0;
    const startedAt = Date.now();

    const result = await backfillPlayerDay({
      supabase,
      onPlayerProcessed: ({ playerTag, snapshots, inserted, updated, skipped }) => {
        playersProcessed += 1;
        if (playersProcessed % 25 === 0) {
          console.log(
            `[${playersProcessed}] ${playerTag}: snapshots=${snapshots}, inserted=${inserted}, updated=${updated}, skipped=${skipped}`,
          );
        }
      },
    });

    const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `Backfill complete in ${durationSec}s -> players=${result.playersProcessed}, snapshots=${result.snapshotsProcessed}, inserted=${result.rowsInserted}, updated=${result.rowsUpdated}, skipped=${result.rowsSkipped}, missing_payload=${result.membersWithoutPayload}`,
    );
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main();
