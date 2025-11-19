import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

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

interface CanonicalSnapshotRow {
  player_tag: string;
  clan_tag: string;
  snapshot_date: string | null;
  payload: {
    member?: {
      name?: string;
      role?: string;
    };
    clanTag?: string;
    clanName?: string;
  };
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

  const { data: snapshot, error } = await supabase
    .from('canonical_member_snapshots')
    .select('player_tag, clan_tag, snapshot_date, payload')
    .eq('player_tag', normalizedPlayer)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle<CanonicalSnapshotRow>();

  if (error) {
    console.error('[registration] validatePlayerInClan error', error);
    return { ok: false, reason: 'Roster lookup failed' };
  }

  if (!snapshot) {
    return { ok: false, reason: 'Player not found in clan roster' };
  }

  const snapshotClanTag = normalizeTag(snapshot.clan_tag || snapshot.payload?.clanTag || '');
  if (snapshotClanTag !== normalizedClan) {
    return { ok: false, reason: 'Player is not currently in this clan' };
  }

  if (snapshot.snapshot_date) {
    const snapshotTime = new Date(snapshot.snapshot_date).getTime();
    const maxAgeMs = lookbackDays * 24 * 60 * 60 * 1000;
    const ageMs = Date.now() - snapshotTime;
    if (Number.isFinite(snapshotTime) && ageMs > maxAgeMs) {
      return { ok: false, reason: 'Player has not appeared in roster snapshots recently' };
    }
  }

  return {
    ok: true,
    playerTag: normalizedPlayer,
    playerName: snapshot.payload?.member?.name,
    clanTag: snapshotClanTag,
    snapshotDate: snapshot.snapshot_date,
  };
}
