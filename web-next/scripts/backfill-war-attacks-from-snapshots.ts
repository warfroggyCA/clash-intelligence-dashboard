import 'dotenv/config';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { backfillWarAttacksFromSnapshots } from '@/lib/ingestion/war-attacks-backfill';

const DEFAULT_DAYS_BACK = 120;
const DEFAULT_PAGE_SIZE = 50;

function getArgValue(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function toNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const clanTagArg = getArgValue('--clanTag') || cfg.homeClanTag || '';
  const normalizedClan = normalizeTag(clanTagArg);
  if (!normalizedClan) {
    throw new Error('Missing or invalid --clanTag (or cfg.homeClanTag)');
  }

  const daysBack = toNumber(getArgValue('--daysBack'), DEFAULT_DAYS_BACK);
  const pageSize = toNumber(getArgValue('--pageSize'), DEFAULT_PAGE_SIZE);
  const maxSnapshots = getArgValue('--maxSnapshots') ? toNumber(getArgValue('--maxSnapshots'), 0) : 0;

  const result = await backfillWarAttacksFromSnapshots({
    clanTag: normalizedClan,
    daysBack,
    pageSize,
    maxSnapshots: maxSnapshots || undefined,
  });

  console.log('[backfill-war-attacks] Done', result);
}

main().catch((err) => {
  console.error('[backfill-war-attacks] Failed:', err);
  process.exit(1);
});
