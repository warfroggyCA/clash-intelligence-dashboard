import { normalizeTag } from '@/lib/tags';

export interface PlayerAlias {
  name: string;
  firstSeen: string;
  lastSeen: string;
}

export interface PlayerMovement {
  type: 'joined' | 'departed' | 'returned';
  date: string;
  reason?: string;
  tenureAtDeparture?: number;
  notes?: string;
}

export interface PlayerHistoryRecord {
  clan_tag: string;
  player_tag: string;
  primary_name: string;
  status: 'active' | 'departed' | 'applicant' | 'rejected';
  total_tenure: number;
  current_stint: { startDate: string; isActive: boolean } | null;
  movements: PlayerMovement[];
  aliases: PlayerAlias[];
  notes: Array<{
    timestamp: string;
    note: string;
    customFields?: Record<string, string>;
  }>;
  created_at: string;
  updated_at: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data.data as T;
}

export async function getPlayerHistoryRecord(clanTag: string, playerTag: string): Promise<PlayerHistoryRecord | null> {
  const normalizedClan = normalizeTag(clanTag);
  const normalizedPlayer = normalizeTag(playerTag);
  if (!normalizedClan || !normalizedPlayer) return null;
  const data = await fetchJson<PlayerHistoryRecord[]>(
    `/api/player-history?clanTag=${encodeURIComponent(normalizedClan)}&playerTag=${encodeURIComponent(normalizedPlayer)}`
  );
  return data?.[0] ?? null;
}

export async function getPlayerHistoryForClan(clanTag: string): Promise<PlayerHistoryRecord[]> {
  const normalizedClan = normalizeTag(clanTag);
  if (!normalizedClan) return [];
  return fetchJson<PlayerHistoryRecord[]>(
    `/api/player-history?clanTag=${encodeURIComponent(normalizedClan)}`
  );
}

export async function upsertPlayerHistory(record: {
  clanTag: string;
  playerTag: string;
  primaryName: string;
  status?: PlayerHistoryRecord['status'];
  totalTenure?: number;
  currentStint?: PlayerHistoryRecord['current_stint'];
  movements?: PlayerHistoryRecord['movements'];
  aliases?: PlayerHistoryRecord['aliases'];
  notes?: PlayerHistoryRecord['notes'];
}) {
  await fetchJson<unknown>('/api/player-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clanTag: record.clanTag,
      playerTag: record.playerTag,
      primaryName: record.primaryName,
      status: record.status,
      totalTenure: record.totalTenure,
      currentStint: record.currentStint,
      movements: record.movements,
      aliases: record.aliases,
      notes: record.notes,
    }),
  });
}

