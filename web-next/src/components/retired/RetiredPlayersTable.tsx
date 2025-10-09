"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import { safeLocaleDateString } from '@/lib/date';

type DepartureRecord = {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason?: string;
  notes?: string;
  lastRole?: string;
  lastTownHall?: number;
  lastTrophies?: number;
};

export default function RetiredPlayersTable() {
  const clanTag = useDashboardStore((s) => s.clanTag || s.homeClan || '');
  const roster = useDashboardStore((s) => s.roster);
  // CRITICAL FIX: Use member count instead of roster object
  const memberCount = roster?.members?.length ?? 0;
  const currentTags = useMemo(() => new Set((roster?.members || []).map(m => normalizeTag(m.tag))), [memberCount]);

  const [items, setItems] = useState<DepartureRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReturned, setShowReturned] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!clanTag) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/departures?clanTag=${encodeURIComponent(clanTag)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to fetch departures');
        }
        const data: DepartureRecord[] = Array.isArray(json.data) ? json.data : [];
        // Sort by date desc
        data.sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || ''));
        setItems(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to fetch departures');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [clanTag]);

  const filtered = useMemo(() => {
    if (showReturned) return items;
    return items.filter(rec => !(rec as any).resolved && !currentTags.has(normalizeTag(rec.memberTag)));
  }, [items, showReturned, currentTags]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Retired Players</h2>
          <p className="text-sm text-gray-600 mt-1">Departed members with departure details</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showReturned}
              onChange={(e) => setShowReturned(e.target.checked)}
            />
            Show returned players
          </label>
        </div>
      </div>

      {(!clanTag) && (
        <div className="p-4 rounded border bg-yellow-50 text-yellow-800 text-sm">
          Select a clan to load the departures list.
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-gray-500">Loading departures…</div>
      ) : error ? (
        <div className="p-4 rounded border bg-red-50 text-red-800 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No retired players found.</div>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Player</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departed</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Role</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">TH</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trophies</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((rec) => {
                const isBack = currentTags.has(normalizeTag(rec.memberTag));
                return (
                <tr key={`${rec.memberTag}-${rec.departureDate}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      <span>{rec.memberName || 'Unknown'}</span>
                      {(rec as any).resolved && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-green-100 text-green-800 px-2 py-0.5">Returned</span>
                      )}
                      {isBack && !(rec as any).resolved && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">Back in roster</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{rec.memberTag}</div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                    {safeLocaleDateString(rec.departureDate, { fallback: 'Unknown', context: 'Retired list departure' })}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 max-w-[240px] truncate" title={rec.departureReason || ''}>
                    {rec.departureReason || '—'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{rec.lastRole || '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{rec.lastTownHall ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{rec.lastTrophies ?? '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 max-w-[280px] truncate" title={rec.notes || ''}>
                    {rec.notes || '—'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    <a
                      href={`/retired/${normalizeTag(rec.memberTag).replace('#','')}`}
                      className="text-blue-600 hover:text-blue-700 underline text-sm"
                      title="Open retired profile"
                    >
                      View
                    </a>
                    {isBack && (
                      <button
                        className="ml-3 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                        title="Mark this departure as resolved (returned)"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/departures', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ clanTag, action: 'resolve', departure: { memberTag: rec.memberTag } }),
                            });
                            if (res.ok) {
                              setItems((prev) => prev.filter((r) => !(normalizeTag(r.memberTag) === normalizeTag(rec.memberTag))));
                            }
                          } catch {}
                        }}
                      >
                        Mark Returned
                      </button>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
