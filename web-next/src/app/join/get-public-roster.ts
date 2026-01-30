import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { resolveRosterMembers, getLatestRosterSnapshot } from '@/lib/roster-resolver';
import { cfg } from '@/lib/config';

export async function getPublicRoster() {
  const supabase = getSupabaseServerClient();
  const clanTag = normalizeTag(cfg.homeClanTag || '');
  
  if (!clanTag) return [];

  const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase });
  if (!latestSnapshot) return [];

  const { members } = await resolveRosterMembers({
    supabase,
    clanTag,
    snapshotId: latestSnapshot.snapshotId,
    snapshotDate: latestSnapshot.snapshotDate,
  });

  return members
    .map((m) => ({
      tag: m.tag,
      name: m.name,
      th: m.th_level ?? 0,
      role: m.role ?? 'member',
    }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
