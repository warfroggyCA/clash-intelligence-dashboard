import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

async function main() {
  const [{ runIngestionJob }, { cfg }] = await Promise.all([
    import('../../src/lib/ingestion/run-ingestion'),
    import('../../src/lib/config'),
  ]);

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
