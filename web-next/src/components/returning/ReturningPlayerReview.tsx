"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import { X } from 'lucide-react';
import { safeLocaleDateString } from '@/lib/date';

type Rejoin = {
  memberTag: string;
  memberName: string;
  previousDeparture: {
    memberTag: string;
    memberName: string;
    departureDate: string;
    departureReason?: string;
    notes?: string;
  };
  rejoinDate: string;
  daysAway: number;
};

function addLocalReturnNote(tag: string, name: string, noteText?: string, awardTenure?: number) {
  try {
    const key = `player_notes_${normalizeTag(tag).toUpperCase()}`;
    const nameKey = `player_name_${normalizeTag(tag).toUpperCase()}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const now = new Date().toISOString();
    const note = {
      timestamp: now,
      note: noteText?.trim() || `Player returned to clan as ${name}`,
      customFields: {
        'Movement Type': 'returned',
        'Return Date': now,
        ...(typeof awardTenure === 'number' ? { 'Previous Tenure Awarded': String(awardTenure) } : {}),
      },
    };
    existing.push(note);
    localStorage.setItem(key, JSON.stringify(existing));
    if (name) localStorage.setItem(nameKey, name);
  } catch {}
}

export default function ReturningPlayerReview() {
  const clanTag = useDashboardStore((s) => s.clanTag || s.homeClan || '');
  const roster = useDashboardStore((s) => s.roster);
  const rosterByTag = useMemo(() => {
    const map = new Map<string, string>();
    (roster?.members || []).forEach((m) => map.set(normalizeTag(m.tag), m.name));
    return map;
  }, [roster]);

  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<Rejoin[]>([]);
  const [index, setIndex] = useState(0);
  const [award, setAward] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const current = queue[index];

  // Dismissal persistence (per clan)
  const dismissalKey = useMemo(() => `returning_review_dismissed:${(clanTag || '').toUpperCase()}`, [clanTag]);
  const getDismissed = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(dismissalKey);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr.map((t) => normalizeTag(t)));
    } catch {
      return new Set();
    }
  }, [dismissalKey]);
  const setDismissed = useCallback((set: Set<string>) => {
    try { localStorage.setItem(dismissalKey, JSON.stringify(Array.from(set))); } catch {}
  }, [dismissalKey]);

  const fetchNotifications = useCallback(async () => {
    if (!clanTag) return;
    try {
      const url = `/api/departures/notifications?clanTag=${encodeURIComponent(clanTag)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        const rejoins: Rejoin[] = Array.isArray(json.data?.rejoins) ? json.data.rejoins : [];
        const dismissed = getDismissed();
        const filtered = rejoins.filter((r) => !dismissed.has(normalizeTag(r.memberTag)));
        if (filtered.length > 0) {
          setQueue(filtered);
          setIndex(0);
          setAward(0);
          setNote('');
          setOpen(true);
        }
      }
    } catch (e) {
      // silent
    }
  }, [clanTag, getDismissed]);

  useEffect(() => {
    // Trigger whenever roster is available to ensure it re-appears until dismissed or resolved
    if ((roster?.members || []).length > 0) {
      void fetchNotifications();
    }
  }, [roster, fetchNotifications]);

  const onResolve = useCallback(async () => {
    if (!current || !clanTag) return;
    try {
      // Mark resolved in departures list
      await fetch('/api/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag, action: 'resolve', departure: { memberTag: current.memberTag } }),
      });

      // Add return note locally
      const currentName = rosterByTag.get(normalizeTag(current.memberTag)) || current.memberName;
      addLocalReturnNote(current.memberTag, currentName, note, award);

      // Persist history record
      try {
        const { recordReturn } = await import('@/lib/player-history-storage');
        recordReturn(current.memberTag, currentName, award || 0, note);
      } catch {}

      // Award previous tenure to ledger if requested
      if (typeof award === 'number' && award > 0) {
        try {
          await fetch('/api/tenure/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: [{ tag: current.memberTag, tenure_days: award }] }),
          });
        } catch {}
      }

      // Advance queue
      if (index + 1 < queue.length) {
        setIndex((i) => i + 1);
        setAward(0);
        setNote('');
      } else {
        setOpen(false);
      }
    } catch (e) {
      // Keep modal open; user can retry
    }
  }, [current, clanTag, award, note, index, queue.length, rosterByTag]);

  const onDismiss = useCallback(() => {
    if (!current) return;
    const dismissed = getDismissed();
    dismissed.add(normalizeTag(current.memberTag));
    setDismissed(dismissed);
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      setAward(0);
      setNote('');
    } else {
      setOpen(false);
    }
  }, [current, index, queue.length, getDismissed, setDismissed]);

  if (!open || !current) return null;

  const prevName = current.previousDeparture?.memberName || '';
  const currName = rosterByTag.get(normalizeTag(current.memberTag)) || current.memberName;
  const nameChanged = prevName && currName && prevName !== currName;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="text-lg font-semibold">Returning Player Review</h3>
            <p className="text-xs text-gray-500">{index + 1} of {queue.length}</p>
          </div>
          <button className="rounded p-2 text-gray-500 hover:bg-gray-100" onClick={() => setOpen(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">{currName}</div>
              <div className="font-mono text-sm text-gray-600">{current.memberTag}</div>
            </div>
            {nameChanged && (
              <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800" title={`Was previously ${prevName}`}>
                Name changed
              </span>
            )}
          </div>

          <div className="rounded border bg-gray-50 p-3 text-sm text-gray-800">
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-gray-500">Departed: </span>
                {safeLocaleDateString(current.previousDeparture?.departureDate, { fallback: 'Unknown', context: 'ReturningPlayerReview' })}
              </div>
              <div>
                <span className="text-gray-500">Reason: </span>
                {current.previousDeparture?.departureReason || '—'}
              </div>
              <div>
                <span className="text-gray-500">Days away: </span>
                {current.daysAway}
              </div>
            </div>
            {current.previousDeparture?.notes && (
              <div className="mt-2 text-gray-700">
                <span className="text-gray-500">Notes: </span>
                {current.previousDeparture.notes}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Award previous tenure (days)</label>
            <input
              type="number"
              min={0}
              value={award}
              onChange={(e) => setAward(Number(e.target.value || 0))}
              className="w-40 rounded border px-2 py-1"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Return note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-24 w-full rounded border px-3 py-2"
              placeholder="Optional context about this return"
            />
          </div>
        </div>

          <div className="flex items-center justify-between border-t bg-gray-50 p-3">
            <button
              className="rounded border px-3 py-2 text-gray-700 hover:bg-white"
              onClick={() => {
                if (index + 1 < queue.length) setIndex((i) => i + 1); else setOpen(false);
                setAward(0);
                setNote('');
              }}
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
            <button className="rounded border px-3 py-2 text-gray-700 hover:bg-white" onClick={onDismiss}>Dismiss</button>
              <button className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700" onClick={onResolve}>
                Mark as Returned
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
