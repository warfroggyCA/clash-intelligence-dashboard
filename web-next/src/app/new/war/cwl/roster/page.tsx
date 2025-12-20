"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { sampleOpponents, sampleRoster, sampleSeasonSummary } from '../cwl-data';
import { useRosterData } from '@/app/new/roster/useRosterData';
import { normalizeTag } from '@/lib/tags';

export default function CwlRosterPage() {
  const warSize = sampleSeasonSummary.warSize;
  const { members: rosterMembers, isLoading } = useRosterData();

  const computedRoster = useMemo(() => {
    if (rosterMembers && rosterMembers.length) {
      return rosterMembers.map((m) => {
        const heroPower =
          (m.bk ?? 0) + (m.aq ?? 0) + (m.gw ?? 0) + (m.rc ?? 0) + (m.mp ?? 0);
        return {
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          townHall: m.townHallLevel ?? (m as any).th ?? 0,
          heroPower,
          reliability: m.activityScore ? `Activity ${m.activityScore}` : undefined,
        };
      });
    }
    return sampleRoster;
  }, [rosterMembers]);

  const sortedRoster = useMemo(() => {
    return [...computedRoster].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return a.tag.localeCompare(b.tag);
    });
  }, [computedRoster]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(sampleSeasonSummary.rosterLocked);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const initialized = useRef(false);
  const hydrated = useRef(false);
  const allTags = useMemo(() => new Set(sortedRoster.map((m) => m.tag)), [sortedRoster]);
  const allSelected = selected.size === allTags.size && allTags.size > 0;
  const partiallySelected = selected.size > 0 && selected.size < allTags.size;

  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch(`/api/cwl/eligible?seasonId=${sampleSeasonSummary.seasonId}&warSize=${sampleSeasonSummary.warSize}`);
        if (res.ok) {
          const body = await res.json();
          const rows = body?.data as any[] | undefined;
          if (rows?.length) {
            setSelected(new Set(rows.map((r) => normalizeTag(r.player_tag))));
            hydrated.current = true;
            return;
          }
        }
      } catch {
        // ignore
      }
      hydrated.current = true;
    };
    hydrate();
  }, []);

  // Drop any selections that are not in the current roster
  useEffect(() => {
    const allowed = new Set(sortedRoster.map((m) => m.tag));
    setSelected((prev) => {
      const filtered = Array.from(prev).filter((t) => allowed.has(t));
      return filtered.length === prev.size ? prev : new Set(filtered);
    });
  }, [sortedRoster]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  useEffect(() => {
    if (!initialized.current && hydrated.current && selected.size === 0 && sortedRoster.length) {
      const initial = sortedRoster.slice(0, warSize).map((m) => m.tag);
      setSelected(new Set(initial));
      initialized.current = true;
    }
  }, [sortedRoster, warSize, selected.size]);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const saveRoster = async () => {
    setLastSaved(new Date().toLocaleTimeString());
    try {
      await fetch('/api/cwl/eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: sampleSeasonSummary.seasonId,
          warSize: sampleSeasonSummary.warSize,
          members: Array.from(selected).map((tag) => {
            const m = sortedRoster.find((p) => p.tag === tag);
            return {
              playerTag: tag,
              playerName: m?.name ?? tag,
              townHall: m?.townHall ?? null,
              heroLevels: {
                bk: (m as any)?.heroes?.bk ?? null,
                aq: (m as any)?.heroes?.aq ?? null,
                gw: (m as any)?.heroes?.gw ?? null,
                rc: (m as any)?.heroes?.rc ?? null,
                mp: (m as any)?.heroes?.mp ?? null,
              },
            };
          }),
        }),
      });
    } catch {
      // ignore
    }
  };

  // no localStorage persistence; Supabase is source of truth

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>CWL Season Roster</h1>
          <p className="text-slate-300 text-sm">Pick all accounts eligible for the CWL week (you can select more than {warSize}; daily planners enforce {warSize} per war).</p>
        </div>
        <Link href="/new/war/cwl">
          <Button tone="ghost">Back to overview</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Status">
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Selected</span>
              <span className="font-semibold text-white">{selected.size} eligible</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Lock</span>
              <span className={`font-semibold ${locked ? 'text-emerald-300' : 'text-amber-200'}`}>{locked ? 'Locked' : 'Not locked'}</span>
            </div>
            <div className="text-xs text-slate-400">Lock is local only for now; wiring to backend later.</div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveRoster}>
                Save season roster
              </Button>
              <Button tone="ghost" onClick={() => setLocked((v) => !v)}>{locked ? 'Unlock' : 'Lock'}</Button>
            </div>
            {lastSaved ? <div className="text-xs text-slate-400">Saved at {lastSaved}</div> : null}
          </div>
        </Card>

        <Card title="Season">
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-400">Season</span>
              <span className="font-semibold text-white">{sampleSeasonSummary.seasonLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">League</span>
              <span className="font-semibold text-white">{sampleSeasonSummary.league}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Upcoming</span>
              <span className="font-semibold text-white">
                Day {sampleOpponents[0].dayIndex}: {sampleOpponents[0].clanName}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Guidance">
          <div className="space-y-2 text-sm text-slate-200">
            <p>Pick the week-long roster first. Daily lineups come next.</p>
            <p className="text-slate-400">Keep TH balance and reliability in mind; you can rotate later on daily planners.</p>
          </div>
        </Card>
      </div>

      <Card title="Clan members">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent-alt)]"
                      aria-label="Select all"
                      ref={selectAllRef}
                      checked={allSelected}
                      onChange={(e) => {
                        setSelected(e.target.checked ? new Set(allTags) : new Set());
                      }}
                    />
                    <span>Pick</span>
                  </div>
                </th>
                <th className="py-2">Name</th>
                <th className="py-2">TH</th>
                <th className="py-2">Hero power</th>
                <th className="py-2">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedRoster.map((m) => {
                const checked = selected.has(m.tag);
                return (
                  <tr key={m.tag} className="hover:bg-white/5">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--accent-alt)]"
                        checked={checked}
                        onChange={() => toggle(m.tag)}
                      />
                    </td>
                    <td className="py-2 text-white font-semibold">{m.name}</td>
                    <td className="py-2 text-slate-200">{m.townHall}</td>
                    <td className="py-2 text-slate-200">{m.heroPower}</td>
                    <td className="py-2 text-slate-300">{m.reliability ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-400">Daily planners will require exactly {warSize} playing; this list is your eligible pool.</div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/new/war/cwl" className="inline-flex">
          <Button>Set opponents</Button>
        </Link>
      </div>
    </div>
  );
}
