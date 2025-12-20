import 'dotenv/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import type { FullClanSnapshot, MemberSummary } from '@/lib/full-snapshot';

type AliasEntry = { name: string; firstSeen: string; lastSeen: string };
type MovementEntry = { type: 'joined' | 'departed' | 'returned'; date: string; reason?: string; notes?: string };

type HistoryRecord = {
  clan_tag: string;
  player_tag: string;
  primary_name: string;
  status: 'active' | 'departed' | 'applicant' | 'rejected';
  total_tenure: number;
  current_stint: { startDate: string; isActive: boolean } | null;
  movements: MovementEntry[];
  aliases: AliasEntry[];
  notes: Array<{ timestamp: string; note: string; customFields?: Record<string, string> }>;
  created_at?: string;
  updated_at?: string;
};

type SnapshotRow = { id: string; fetched_at: string | null; payload: FullClanSnapshot | null };

const PAGE_SIZE = 100; // Reduced from 200 to avoid timeouts
const UPSERT_CHUNK = 200;

function parseArgs() {
  const args = new Map<string, string>();
  process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split('=');
    if (key && value) args.set(key.replace(/^--/, ''), value);
  });
  return args;
}

function getSnapshotDate(row: SnapshotRow): string {
  if (row.fetched_at) return row.fetched_at;
  if (row.payload?.fetchedAt) return row.payload.fetchedAt;
  return new Date().toISOString();
}

function ensureAlias(record: HistoryRecord, name: string, date: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = record.aliases.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    existing.lastSeen = date;
    return;
  }
  record.aliases.push({ name: trimmed, firstSeen: date, lastSeen: date });
}

function recordMovement(record: HistoryRecord, movement: MovementEntry) {
  const already = record.movements.some((m) => m.type === movement.type && m.date === movement.date);
  if (!already) record.movements.push(movement);
}

async function main() {
  const args = parseArgs();
  const clanTagRaw = args.get('clanTag') || args.get('clan') || process.env.HOME_CLAN_TAG;
  const clanTag = normalizeTag(clanTagRaw || '');
  if (!clanTag) {
    throw new Error('Missing clanTag. Use --clanTag=#TAG');
  }

  const pageSize = Math.max(1, Number(args.get('pageSize') || PAGE_SIZE));
  const maxSnapshots = args.get('maxSnapshots') ? Number(args.get('maxSnapshots')) : null;
  const upsertChunk = Math.max(1, Number(args.get('upsertBatch') || UPSERT_CHUNK));

  const supabase = getSupabaseAdminClient();
  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .select('id, tag')
    .eq('tag', clanTag)
    .maybeSingle();

  if (clanError || !clanRow?.id) {
    throw new Error(`Failed to resolve clan id for ${clanTag}`);
  }
  const historyMap = new Map<string, HistoryRecord>();

  let offset = 0;
  let done = false;
  let prevTags = new Set<string>();
  let prevMembers = new Map<string, MemberSummary>();
  let totalProcessed = 0;

  console.log(`Starting backfill for clan ${clanTag} (ID: ${clanRow.id})...`);

  while (!done) {
    if (maxSnapshots && totalProcessed >= maxSnapshots) {
      break;
    }
    const remaining = maxSnapshots ? Math.max(0, maxSnapshots - totalProcessed) : pageSize;
    const limit = Math.min(pageSize, remaining);

    console.log(`Fetching snapshots ${offset} to ${offset + limit - 1}...`);
    
    const { data: snapshots, error } = await supabase
      .from('roster_snapshots')
      .select('id, fetched_at, payload')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`Error fetching snapshots at offset ${offset}:`, error.message);
      // Retry once with a smaller page size
      if (pageSize > 50) {
        console.log(`Retrying with smaller page size...`);
        offset = Math.max(0, offset - pageSize);
        continue;
      }
      throw new Error(`Failed to fetch roster snapshots: ${error.message}`);
    }

    if (!snapshots || snapshots.length === 0) {
      done = true;
      break;
    }

    for (const row of snapshots as SnapshotRow[]) {
      if (!row.payload) {
        continue;
      }
      const snapshotDate = getSnapshotDate(row);
      const members = row.payload?.memberSummaries ?? [];
      const currentTags = new Set(
        members.map((m) => normalizeTag(m.tag)).filter((t): t is string => Boolean(t))
      );

      const currentMemberMap = new Map<string, MemberSummary>();
      members.forEach((m) => {
        const tag = normalizeTag(m.tag);
        if (tag) currentMemberMap.set(tag, m);
      });

      // Handle joins / returns
      currentTags.forEach((tag) => {
        const member = currentMemberMap.get(tag);
        const name = member?.name || tag;
        const record = historyMap.get(tag) || {
          clan_tag: clanTag,
          player_tag: tag,
          primary_name: name,
          status: 'active',
          total_tenure: 0,
          current_stint: { startDate: snapshotDate, isActive: true },
          movements: [],
          aliases: [],
          notes: [],
        };

        if (!record.primary_name) record.primary_name = name;

        if (!record.current_stint || !record.current_stint.isActive) {
          recordMovement(record, { type: record.movements.length ? 'returned' : 'joined', date: snapshotDate });
          record.current_stint = { startDate: snapshotDate, isActive: true };
          record.status = 'active';
        } else if (!record.movements.length) {
          recordMovement(record, { type: 'joined', date: snapshotDate });
        }

        if (name && name !== record.primary_name) {
          ensureAlias(record, record.primary_name, snapshotDate);
          record.primary_name = name;
        }

        historyMap.set(tag, record);
      });

      // Handle departures
      prevTags.forEach((tag) => {
        if (!currentTags.has(tag)) {
          const record = historyMap.get(tag) || {
            clan_tag: clanTag,
            player_tag: tag,
            primary_name: prevMembers.get(tag)?.name || tag,
            status: 'departed',
            total_tenure: 0,
            current_stint: null,
            movements: [],
            aliases: [],
            notes: [],
          };

          recordMovement(record, { type: 'departed', date: snapshotDate });
          if (record.current_stint?.startDate) {
            const tenureDays = Math.max(
              0,
              Math.floor((Date.parse(snapshotDate) - Date.parse(record.current_stint.startDate)) / (1000 * 60 * 60 * 24))
            );
            record.total_tenure += tenureDays;
          }
          record.current_stint = null;
          record.status = 'departed';
          historyMap.set(tag, record);
        }
      });

      prevTags = currentTags;
      prevMembers = currentMemberMap;
    }

    totalProcessed += snapshots.length;
    console.log(`Processed ${totalProcessed} snapshots so far, ${historyMap.size} unique players...`);
    
    offset += limit;
    
    // Small delay to avoid overwhelming the database
    if (snapshots.length === limit) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`Finished processing ${totalProcessed} snapshots. Found ${historyMap.size} unique players.`);

  const upserts = Array.from(historyMap.values()).map((record) => ({
    ...record,
    updated_at: new Date().toISOString(),
  }));

  if (!upserts.length) {
    console.log('No history records to upsert.');
    return;
  }

  for (let i = 0; i < upserts.length; i += upsertChunk) {
    const chunk = upserts.slice(i, i + upsertChunk);
    const { error } = await supabase
      .from('player_history')
      .upsert(chunk, { onConflict: 'clan_tag,player_tag' });
    if (error) {
      throw new Error(`Failed to upsert player_history: ${error.message}`);
    }
  }

  console.log(`Backfilled player history for ${upserts.length} players in ${clanTag}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
