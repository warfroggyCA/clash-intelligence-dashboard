"use client";

import { useMemo } from 'react';
import { Button } from '@/components/new-ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

export type ColumnKey =
  | 'th'
  | 'league'
  | 'trophies'
  | 'vip'
  | 'donations'
  | 'rush'
  | 'srs'
  | 'heroes'
  | 'role'
  | 'tenure'
  | 'war_attacks'
  | 'war_avg_stars'
  | 'war_triple_rate'
  | 'war_low_hit_rate'
  | 'war_avg_destruction';

export default function ColumnPickerModal({
  open,
  onClose,
  allColumns,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  allColumns: Array<{ key: ColumnKey; label: string; description?: string }>;
  value: ColumnKey[];
  onChange: (next: ColumnKey[]) => void;
}) {
  const selected = useMemo(() => new Set(value), [value]);

  if (!open) return null;

  const toggle = (key: ColumnKey) => {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const ordered = allColumns.map((c) => c.key).filter((k) => next.has(k));
    onChange(ordered);
  };

  const move = (key: ColumnKey, dir: -1 | 1) => {
    const idx = value.indexOf(key);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= value.length) return;
    const next = [...value];
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Customize table columns</div>
            <div className="text-xs text-slate-400">No horizontal scroll. Keep it tight—pick what matters.</div>
          </div>
          <Button tone="ghost" className="h-10 px-3" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {allColumns.map((c) => (
            <div key={c.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={selected.has(c.key)}
                  onChange={() => toggle(c.key)}
                  className="h-4 w-4"
                />
                <span>
                  <span className="font-semibold">{c.label}</span>
                  {c.description ? <span className="ml-2 text-xs text-slate-400">{c.description}</span> : null}
                </span>
              </label>
              {selected.has(c.key) ? (
                <div className="flex gap-1">
                  <Tooltip content={<span>Move up</span>}>
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                      onClick={() => move(c.key, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                  </Tooltip>
                  <Tooltip content={<span>Move down</span>}>
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                      onClick={() => move(c.key, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </Tooltip>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">Selected: {value.length}</div>
          <div className="flex gap-2">
            <Button
              tone="ghost"
              className="h-10 px-3"
              onClick={() => onChange(['th', 'league', 'trophies', 'vip', 'donations', 'rush', 'srs', 'heroes'])}
            >
              Reset to Compact
            </Button>
            <Button
              tone="primary"
              className="h-10 px-3"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
