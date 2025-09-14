// web-next/src/lib/tenure.ts
import path from 'path';
import { promises as fsp } from 'fs';
import { cfg } from './config';
import { isValidTag, normalizeTag } from './tags';
import { daysSince, daysSinceToDate } from './date';

export type TenureRow = { tag?: string; base?: number; tenure_days?: number; as_of?: string; ts?: string };

// Pure parser usable in tests
export function parseTenureLedger(lines: string[], targetDate?: string): Record<string, number> {
  const latest: Record<string, string> = {};
  const base: Record<string, number> = {};
  const asof: Record<string, string> = {};

  for (const raw of lines) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    let row: TenureRow | null = null;
    try { row = JSON.parse(s); } catch { continue; }
    const tag = normalizeTag(row?.tag || '');
    const ts = String(row?.ts || '');
    if (!isValidTag(tag) || !ts) continue;
    if (latest[tag] && latest[tag] >= ts) continue; // keep newest
    latest[tag] = ts;
    const b = typeof row?.base === 'number' ? row!.base : (typeof row?.tenure_days === 'number' ? row!.tenure_days : 0);
    base[tag] = Number(b) || 0;
    asof[tag] = String(row?.as_of || '');
  }

  const out: Record<string, number> = {};
  for (const [tag, b] of Object.entries(base)) {
    const add = targetDate ? daysSinceToDate(asof[tag] || '', targetDate) : daysSince(asof[tag] || '');
    out[tag] = Math.max(0, Math.round(b + add));
  }
  return out;
}

// Reads the configured ledger and returns effective tenure map
export async function readLedgerEffective(targetDate?: string): Promise<Record<string, number>> {
  const ledger = path.join(process.cwd(), cfg.dataRoot, 'tenure_ledger.jsonl');
  try { await fsp.stat(ledger); } catch { return {}; }
  const lines = (await fsp.readFile(ledger, 'utf-8')).split(/\r?\n/);
  return parseTenureLedger(lines, targetDate);
}

// Detailed parse including as_of date
export function parseTenureDetails(lines: string[], targetDate?: string): Record<string, { days: number; as_of?: string }> {
  const latest: Record<string, string> = {};
  const base: Record<string, number> = {};
  const asof: Record<string, string> = {};

  for (const raw of lines) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    let row: TenureRow | null = null;
    try { row = JSON.parse(s); } catch { continue; }
    const tag = normalizeTag(row?.tag || '');
    const ts = String(row?.ts || '');
    if (!isValidTag(tag) || !ts) continue;
    if (latest[tag] && latest[tag] >= ts) continue;
    latest[tag] = ts;
    const b = typeof row?.base === 'number' ? row!.base : (typeof row?.tenure_days === 'number' ? row!.tenure_days : 0);
    base[tag] = Number(b) || 0;
    asof[tag] = String(row?.as_of || '');
  }

  const out: Record<string, { days: number; as_of?: string }> = {};
  for (const [tag, b] of Object.entries(base)) {
    const add = targetDate ? daysSinceToDate(asof[tag] || '', targetDate) : daysSince(asof[tag] || '');
    out[tag] = { days: Math.max(0, Math.round(b + add)), as_of: asof[tag] };
  }
  return out;
}

export async function readTenureDetails(targetDate?: string): Promise<Record<string, { days: number; as_of?: string }>> {
  const ledger = path.join(process.cwd(), cfg.dataRoot, 'tenure_ledger.jsonl');
  try { await fsp.stat(ledger); } catch { return {}; }
  const lines = (await fsp.readFile(ledger, 'utf-8')).split(/\r?\n/);
  return parseTenureDetails(lines, targetDate);
}

// Append a new ledger entry to set base tenure from a given as_of date
export async function appendTenureLedgerEntry(tag: string, base: number, asOfYmd: string): Promise<void> {
  const t = normalizeTag(tag);
  if (!isValidTag(t)) throw new Error('Invalid tag');
  const dir = path.join(process.cwd(), cfg.dataRoot);
  await fsp.mkdir(dir, { recursive: true });
  const ledger = path.join(dir, 'tenure_ledger.jsonl');
  const row = { tag: t, base: Math.max(0, Math.round(base || 0)), as_of: asOfYmd, ts: new Date().toISOString() };
  await fsp.appendFile(ledger, JSON.stringify(row) + '\n', 'utf-8');
}
