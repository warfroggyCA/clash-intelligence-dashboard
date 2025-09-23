import 'dotenv/config';

import { runIngestionJob } from '../../src/lib/ingestion/run-ingestion';
import { cfg } from '../../src/lib/config';

async function main() {
  const clanTag = process.argv[2] || cfg.homeClanTag;
  if (!clanTag) {
    console.error('Usage: tsx scripts/ingest/run.ts <#CLANTAG>');
    process.exit(1);
  }

  try {
    const results = await runIngestionJob({ clanTag });
    console.log('Ingestion completed:', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (error: any) {
    console.error('Ingestion failed:', error?.message || error);
    process.exit(1);
  }
}

main();

