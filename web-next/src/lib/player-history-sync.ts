"use client";

import { normalizeTag } from '@/lib/tags';
import type { PlayerHistoryRecord as LocalHistoryRecord } from './player-history';
import { getAllHistory, deleteHistory } from './player-history-storage';
import {
  getPlayerHistoryRecord,
  upsertPlayerHistory,
  type PlayerHistoryRecord as RemoteHistoryRecord,
} from './player-history-service';

type MergedRecord = {
  primaryName: string;
  status: RemoteHistoryRecord['status'];
  totalTenure: number;
  currentStint: RemoteHistoryRecord['current_stint'];
  movements: RemoteHistoryRecord['movements'];
  aliases: RemoteHistoryRecord['aliases'];
  notes: RemoteHistoryRecord['notes'];
};

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return Array.from(map.values());
}

function normalizeLocalRecord(record: LocalHistoryRecord): MergedRecord {
  return {
    primaryName: record.primaryName,
    status: record.status,
    totalTenure: record.totalTenure ?? 0,
    currentStint: record.currentStint ?? null,
    movements: Array.isArray(record.movements) ? record.movements : [],
    aliases: Array.isArray(record.aliases) ? record.aliases : [],
    notes: Array.isArray(record.notes) ? record.notes : [],
  };
}

function normalizeRemoteRecord(record: RemoteHistoryRecord | null): MergedRecord | null {
  if (!record) return null;
  return {
    primaryName: record.primary_name,
    status: record.status,
    totalTenure: record.total_tenure ?? 0,
    currentStint: (record.current_stint as any) ?? null,
    movements: Array.isArray(record.movements) ? record.movements : [],
    aliases: Array.isArray(record.aliases) ? record.aliases : [],
    notes: Array.isArray(record.notes) ? record.notes : [],
  };
}

function mergeHistoryRecords(local: MergedRecord, remote: MergedRecord | null): MergedRecord {
  const mergedMovements = dedupeByKey(
    [...(remote?.movements ?? []), ...local.movements],
    (movement) => `${movement.type}|${movement.date}|${movement.reason ?? ''}|${movement.tenureAtDeparture ?? ''}|${movement.notes ?? ''}`,
  );

  const mergedAliases = dedupeByKey(
    [...(remote?.aliases ?? []), ...local.aliases],
    (alias) => alias.name.toLowerCase().trim(),
  );

  const mergedNotes = dedupeByKey(
    [...(remote?.notes ?? []), ...local.notes],
    (note) => `${note.timestamp}|${note.note}`,
  );

  const totalTenure = Math.max(remote?.totalTenure ?? 0, local.totalTenure ?? 0);

  const status = remote?.status ?? local.status;

  const currentStint = remote?.currentStint ?? local.currentStint ?? null;

  const primaryName = remote?.primaryName ?? local.primaryName;

  return {
    primaryName,
    status,
    totalTenure,
    currentStint,
    movements: mergedMovements,
    aliases: mergedAliases,
    notes: mergedNotes,
  };
}

export async function syncLocalHistoryToSupabase(clanTag: string) {
  if (typeof window === 'undefined') return;
  const normalizedClan = normalizeTag(clanTag);
  if (!normalizedClan) return;

  const localRecords = getAllHistory();
  if (!localRecords.length) return;

  for (const localRecord of localRecords) {
    const normalizedTag = normalizeTag(localRecord.tag);
    if (!normalizedTag) continue;

    try {
      const [remoteRecord] = await Promise.all([
        getPlayerHistoryRecord(normalizedClan, normalizedTag),
      ]);

      const localNormalized = normalizeLocalRecord(localRecord);
      const remoteNormalized = normalizeRemoteRecord(remoteRecord);

      const merged = mergeHistoryRecords(localNormalized, remoteNormalized);

      await upsertPlayerHistory({
        clanTag: normalizedClan,
        playerTag: normalizedTag,
        primaryName: merged.primaryName,
        status: merged.status,
        totalTenure: merged.totalTenure,
        currentStint: merged.currentStint,
        movements: merged.movements,
        aliases: merged.aliases,
        notes: merged.notes,
      });

      deleteHistory(normalizedTag);
    } catch (error) {
      console.warn('[player-history-sync] Failed to sync record', localRecord.tag, error);
    }
  }
}

