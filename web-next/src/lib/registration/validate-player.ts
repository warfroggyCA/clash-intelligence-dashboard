import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';

export interface ValidatePlayerOptions {
  supabase?: ReturnType<typeof getSupabaseServerClient>;
  lookbackDays?: number;
}

export interface ValidatePlayerResult {
  ok: boolean;
  reason?: string;
  playerTag?: string;
  playerName?: string;
  clanTag?: string;
  snapshotDate?: string | null;
}

export async function validatePlayerInClan(
  playerTag: string,
  clanTag: string,
  options: ValidatePlayerOptions = {},
): Promise<ValidatePlayerResult> {
  const normalizedPlayer = normalizeTag(playerTag);
  const normalizedClan = normalizeTag(clanTag);
  if (!normalizedPlayer || !normalizedClan) {
    return { ok: false, reason: 'Player or clan tag missing' };
  }

  const supabase = options.supabase ?? getSupabaseServerClient();
  const lookbackDays = options.lookbackDays ?? 7;

  let latestSnapshot;
  try {
    latestSnapshot = await getLatestRosterSnapshot({
      clanTag: normalizedClan,
      supabase,
    });
  } catch {
    return { ok: false, reason: 'Roster lookup failed' };
  }

  if (!latestSnapshot) {
    return { ok: false, reason: 'No roster snapshot found' };
  }

  let membersResult;
  try {
    membersResult = await resolveRosterMembers({
      supabase,
      clanTag: latestSnapshot.clanTag,
      snapshotId: latestSnapshot.snapshotId,
      snapshotDate: latestSnapshot.snapshotDate,
    });
  } catch {
    return { ok: false, reason: 'Roster lookup failed' };
  }

  const { members } = membersResult;

  const rosterMember = members.find((member) => member.tag === normalizedPlayer);
  if (!rosterMember) {
    return { ok: false, reason: 'Player not found in clan roster' };
  }

  if (latestSnapshot.fetchedAt) {
    const snapshotTime = new Date(latestSnapshot.fetchedAt).getTime();
    const maxAgeMs = lookbackDays * 24 * 60 * 60 * 1000;
    const ageMs = Date.now() - snapshotTime;
    if (Number.isFinite(snapshotTime) && ageMs > maxAgeMs) {
      return { ok: false, reason: 'Player has not appeared in roster snapshots recently' };
    }
  }

  return {
    ok: true,
    playerTag: normalizedPlayer,
    playerName: rosterMember.name,
    clanTag: latestSnapshot.clanTag,
    snapshotDate: latestSnapshot.snapshotDate,
  };
}
