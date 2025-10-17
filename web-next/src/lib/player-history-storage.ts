// web-next/src/lib/player-history-storage.ts
// Lightweight localStorage-backed history store using PlayerHistoryRecord shape

"use client";

import { addAlias, processPlayerDeparture, processPlayerReturn, type PlayerHistoryRecord } from './player-history';
import { normalizeTag } from './tags';

export type SimpleDeparture = {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason?: string;
  notes?: string;
  tenureAtDeparture?: number;
};

function keyFor(tag: string) {
  return `player_history_${normalizeTag(tag).toUpperCase()}`;
}

function nowIso() { return new Date().toISOString(); }

export function loadHistory(tag: string, primaryName?: string): PlayerHistoryRecord {
  const k = keyFor(tag);
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as PlayerHistoryRecord;
  } catch {}

  // Default record
  const nm = primaryName || localStorage.getItem(`player_name_${normalizeTag(tag).toUpperCase()}`) || 'Unknown Player';
  const record: PlayerHistoryRecord = {
    tag: normalizeTag(tag),
    primaryName: nm,
    aliases: [],
    movements: [],
    totalTenure: 0,
    currentStint: null,
    notes: [],
    status: 'applicant',
    lastUpdated: nowIso(),
  };
  return record;
}

export function saveHistory(record: PlayerHistoryRecord) {
  try { localStorage.setItem(keyFor(record.tag), JSON.stringify(record)); } catch {}
}

export function deleteHistory(tag: string) {
  try {
    localStorage.removeItem(keyFor(tag));
  } catch {}
}

export function recordDeparture(dep: SimpleDeparture) {
  const tag = normalizeTag(dep.memberTag);
  const prev = loadHistory(tag, dep.memberName);
  // Ensure alias if name differs
  let rec = prev;
  if (dep.memberName && dep.memberName !== prev.primaryName) {
    rec = addAlias(prev, prev.primaryName);
    rec.primaryName = dep.memberName;
  }
  rec = processPlayerDeparture(rec, {
    departureReason: dep.departureReason,
    tenureAtDeparture: dep.tenureAtDeparture,
    departureNotes: dep.notes,
  });
  saveHistory(rec);
}

export function recordReturn(tag: string, currentName: string, awardPreviousTenure?: number, returnNotes?: string) {
  const prev = loadHistory(tag, currentName);
  const rec = processPlayerReturn(normalizeTag(tag), currentName, prev, { awardPreviousTenure, returnNotes });
  saveHistory(rec);
}

export function findByAlias(name: string): PlayerHistoryRecord | null {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('player_history_'));
    const search = String(name || '').toLowerCase().trim();
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const rec = JSON.parse(raw) as PlayerHistoryRecord;
      if (rec.primaryName?.toLowerCase().trim() === search) return rec;
      if ((rec.aliases || []).some((a) => a.name.toLowerCase().trim() === search)) return rec;
    }
  } catch {}
  return null;
}

export function getAllHistory(): PlayerHistoryRecord[] {
  const out: PlayerHistoryRecord[] = [];
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('player_history_'));
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      out.push(JSON.parse(raw));
    }
  } catch {}
  return out;
}
