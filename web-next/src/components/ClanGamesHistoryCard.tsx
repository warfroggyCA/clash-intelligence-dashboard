"use client";

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Trophy } from 'lucide-react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { cfg } from '@/lib/config';
import { useClanGamesHistory } from '@/hooks/useClanGamesHistory';
import type { ClanGamesSeasonEntry } from '@/types';

interface ClanGamesHistoryCardProps {
  clanTag?: string | null;
  limit?: number;
  className?: string;
  compact?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

export default function ClanGamesHistoryCard({
  clanTag: propClanTag,
  limit = 8,
  className = '',
  compact = false,
}: ClanGamesHistoryCardProps) {
  const fallbackClanTag = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag || null);
  const clanTag = propClanTag || fallbackClanTag;
  const { entries, isLoading, error } = useClanGamesHistory(clanTag, limit);

  const topEntries = useMemo(() => entries.slice(0, limit), [entries, limit]);

  return (
    <div className={className}>
      {isLoading && entries.length === 0 ? (
        <p className="text-xs text-slate-400">Loading clan games history…</p>
      ) : error && entries.length === 0 ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">No clan games records yet. Leadership can add the latest totals after each event.</p>
      ) : (
        <div className="space-y-3">
          {topEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 ${
                compact ? 'text-xs' : 'text-sm'
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <span>{entry.label}</span>
                </div>
                <div className="text-slate-400">
                  {entry.startDate ? (
                    <>
                      {formatDate(entry.startDate)}
                      {entry.endDate ? ` – ${formatDate(entry.endDate)}` : ''}
                    </>
                  ) : (
                    'Date not set'
                  )}
                </div>
                {entry.notes && <p className="text-slate-300">{entry.notes}</p>}
                {entry.recordedBy && (
                  <p className="text-xs text-slate-500">Recorded by {entry.recordedBy}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-yellow-300">
                  {entry.totalPoints.toLocaleString()}
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Total points</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

