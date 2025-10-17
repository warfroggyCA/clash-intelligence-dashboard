"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';

type Note = { timestamp: string; note: string; customFields?: Record<string,string> };
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

export default function RetiredProfileClient({ tag }: { tag: string }) {
  const normalized = useMemo(() => normalizeTag(tag).toUpperCase(), [tag]);
  const notesKey = `player_notes_${normalized}`;
  const nameKey = `player_name_${normalized}`;

  const [name, setName] = useState<string>('Unknown Player');
  const [notes, setNotes] = useState<Note[]>([]);
  const [departure, setDeparture] = useState<DepartureRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clanTag = useDashboardStore((s) => s.clanTag || s.homeClan || '');

  useEffect(() => {
    try {
      const storedName = localStorage.getItem(nameKey);
      if (storedName) setName(storedName);
    } catch {}
    try {
      const raw = localStorage.getItem(notesKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          // newest first
          arr.sort((a: Note, b: Note) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          setNotes(arr);
        }
      }
    } catch {}
  }, [notesKey, nameKey]);

  useEffect(() => {
    const loadDeparture = async () => {
      if (!clanTag) return;
      try {
        const res = await fetch(`/api/departures?clanTag=${encodeURIComponent(clanTag)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load departures');
        const items: DepartureRecord[] = Array.isArray(json.data) ? json.data : [];
        const m = items.find((r) => normalizeTag(r.memberTag) === normalized);
        if (m) setDeparture(m);
      } catch (e: any) {
        setError(e?.message || 'Failed to load departure info');
      }
    };
    void loadDeparture();
  }, [clanTag, normalized]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{name}</h1>
          <div className="text-sm text-gray-400 font-mono">{normalized}</div>
        </div>
      </div>

      {departure && (
        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-100 mb-2">Departure</h2>
          <div className="text-sm text-gray-300 space-y-1">
            <div>
              <span className="text-gray-400">Date: </span>
              {safeLocaleDateString(departure.departureDate, { fallback: 'Unknown', context: 'Retired profile' })}
            </div>
            {departure.departureReason && (
              <div>
                <span className="text-gray-400">Reason: </span>{departure.departureReason}
              </div>
            )}
            <div className="flex gap-4 flex-wrap">
              <div><span className="text-gray-400">Last Role: </span>{departure.lastRole || '—'}</div>
              <div><span className="text-gray-400">TH: </span>{departure.lastTownHall ?? '—'}</div>
              <div><span className="text-gray-400">Trophies: </span>{departure.lastTrophies ?? '—'}</div>
            </div>
            {departure.notes && (
              <div>
                <span className="text-gray-400">Notes: </span>{departure.notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">Notes</h2>
          <Link
            href="/"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Back to dashboard
          </Link>
        </div>
        {notes.length === 0 ? (
          <div className="text-gray-400 text-sm">No notes yet</div>
        ) : (
          <div className="space-y-3">
            {notes.map((n, idx) => (
              <div key={idx} className="rounded border border-brand-border p-3">
                <div className="text-xs text-gray-400 mb-1">
                  {safeLocaleString(n.timestamp, { fallback: 'Unknown', context: 'Retired note timestamp' })}
                </div>
                <div className="text-gray-100">{n.note}</div>
                {n.customFields && Object.keys(n.customFields).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-brand-border">
                    <div className="text-xs text-gray-400 mb-1">Fields</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(n.customFields).map(([k, v]) => (
                        <div key={k} className="text-sm text-gray-200"><span className="text-gray-400">{k}: </span>{v}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded border bg-red-50 text-red-800 text-sm">{error}</div>
      )}
    </div>
  );
}

