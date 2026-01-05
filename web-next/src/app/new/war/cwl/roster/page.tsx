"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import CwlStepBar from '@/components/war/CwlStepBar';
import { sampleRoster, sampleSeasonSummary } from '../cwl-data';
import { useRosterData } from '@/app/new/roster/useRosterData';
import { normalizeTag } from '@/lib/tags';
import { resolveHeroPower } from '@/lib/roster-derivations';

type RosterEntry = (typeof sampleRoster)[number] & {
  heroes?: Record<string, number | null>;
};

export default function CwlRosterPage() {
  const seasonId = sampleSeasonSummary.seasonId;
  const [warSize, setWarSize] = useState<15 | 30>(sampleSeasonSummary.warSize);
  const [seasonLabel, setSeasonLabel] = useState(sampleSeasonSummary.seasonLabel);
  const [opponents, setOpponents] = useState<Array<{ dayIndex: number; clanName: string; clanTag: string }>>([]);
  const { members: rosterMembers } = useRosterData();
  const [eligibleRoster, setEligibleRoster] = useState<RosterEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(sampleSeasonSummary.rosterLocked);
  const [lockBusy, setLockBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const initialized = useRef(false);
  const hydrated = useRef(false);

  const computedRoster = useMemo(() => {
    if (locked && eligibleRoster.length) {
      return eligibleRoster;
    }
    if (rosterMembers && rosterMembers.length) {
      return rosterMembers.map((m) => {
        return {
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          townHall: m.townHallLevel ?? (m as any).th ?? null,
          heroPower: m.heroPower ?? null,
          reliability: m.activity?.level ? `Activity ${m.activity.level}` : undefined,
          heroes: {
            bk: m.bk ?? null,
            aq: m.aq ?? null,
            gw: m.gw ?? null,
            rc: m.rc ?? null,
            mp: m.mp ?? null,
          },
        };
      });
    }
    return sampleRoster;
  }, [eligibleRoster, locked, rosterMembers]);

  const sortedRoster = useMemo(() => {
    return [...computedRoster].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return a.tag.localeCompare(b.tag);
    });
  }, [computedRoster]);

  const allTags = useMemo(() => new Set(sortedRoster.map((m) => m.tag)), [sortedRoster]);
  const allSelected = selected.size === allTags.size && allTags.size > 0;
  const partiallySelected = selected.size > 0 && selected.size < allTags.size;

  useEffect(() => {
    const hydrateSeason = async () => {
      try {
        const res = await fetch(`/api/cwl/season?seasonId=${seasonId}`);
        if (!res.ok) return;
        const body = await res.json();
        const size = Number(body?.data?.war_size);
        const label = body?.data?.season_label;
        const lockedAt = body?.data?.locked_at ?? null;
        if ((size === 15 || size === 30) && size !== warSize) {
          setWarSize(size);
        }
        if (label) {
          setSeasonLabel(label);
        }
        setLocked(Boolean(lockedAt));
      } catch {
        // ignore
      }
    };
    hydrateSeason();
  }, [seasonId, warSize]);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch(`/api/cwl/eligible?seasonId=${seasonId}&warSize=${warSize}`);
        if (res.ok) {
          const body = await res.json();
          const rows = body?.data as any[] | undefined;
          if (rows?.length) {
            setSelected(new Set(rows.map((r) => normalizeTag(r.player_tag))));
            setEligibleRoster(
              rows.map((r) => ({
                name: r.player_name || r.player_tag,
                tag: normalizeTag(r.player_tag || ''),
                townHall: r.town_hall ?? null,
                heroPower: resolveHeroPower({ hero_levels: r.hero_levels }),
                reliability: undefined,
                heroes: r.hero_levels ?? null,
              })),
            );
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
  }, [seasonId, warSize]);

  useEffect(() => {
    const hydrateOpponents = async () => {
      try {
        const res = await fetch(`/api/cwl/opponents?seasonId=${seasonId}&warSize=${warSize}`);
        if (!res.ok) return;
        const body = await res.json();
        const rows = body?.data as any[] | undefined;
        if (rows?.length) {
          const mapped = rows
            .map((row) => ({
              dayIndex: row.day_index ?? row.dayIndex ?? 0,
              clanName: row.opponent_name ?? row.clanName ?? '',
              clanTag: row.opponent_tag ?? row.clanTag ?? '',
            }))
            .filter((row) => row.dayIndex > 0)
            .sort((a, b) => a.dayIndex - b.dayIndex);
          setOpponents(mapped);
        } else {
          setOpponents([]);
        }
      } catch {
        // ignore
      }
    };
    hydrateOpponents();
  }, [seasonId, warSize]);

  const upcomingOpponent = opponents.find((row) => row.clanTag) ?? null;

  // Drop any selections that are not in the current roster
  useEffect(() => {
    if (locked) return;
    const allowed = new Set(sortedRoster.map((m) => m.tag));
    setSelected((prev) => {
      const filtered = Array.from(prev).filter((t) => allowed.has(t));
      return filtered.length === prev.size ? prev : new Set(filtered);
    });
  }, [sortedRoster, locked]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  useEffect(() => {
    if (!initialized.current && hydrated.current && selected.size === 0 && sortedRoster.length && !locked) {
      const initial = sortedRoster.slice(0, warSize).map((m) => m.tag);
      setSelected(new Set(initial));
      initialized.current = true;
    }
  }, [sortedRoster, warSize, selected.size, locked]);

  const toggle = (tag: string) => {
    if (locked) {
      setRosterError('Roster is locked. Unlock to edit.');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const saveRoster = async () => {
    if (locked) {
      setRosterError('Roster is locked. Unlock to edit.');
      return;
    }
    setRosterError(null);
    setLastSaved(new Date().toLocaleTimeString());
    try {
      await fetch('/api/cwl/eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId,
          warSize,
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

  const toggleLock = async () => {
    if (lockBusy) return;
    setLockBusy(true);
    setRosterError(null);
    try {
      const res = await fetch('/api/cwl/season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId,
          warSize,
          seasonLabel,
          lock: !locked,
        }),
      });
      if (!res.ok) throw new Error('Failed to update lock');
      setLocked((prev) => !prev);
    } catch (err: any) {
      setRosterError(err?.message || 'Failed to update roster lock');
    } finally {
      setLockBusy(false);
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
        <Link href="/new/war/cwl/setup">
          <Button tone="ghost">Back to CWL Setup</Button>
        </Link>
      </div>

      <CwlStepBar current="roster" />

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
            <div className="text-xs text-slate-400">Lock freezes the CWL roster snapshot across all day planners.</div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveRoster}>
                Save season roster
              </Button>
              <Button tone="ghost" onClick={toggleLock} disabled={lockBusy}>
                {lockBusy ? 'Saving…' : locked ? 'Unlock' : 'Lock'}
              </Button>
            </div>
            {lastSaved ? <div className="text-xs text-slate-400">Saved at {lastSaved}</div> : null}
            {rosterError ? <div className="text-xs text-amber-300">{rosterError}</div> : null}
          </div>
        </Card>

        <Card title="Season">
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-400">Season</span>
              <span className="font-semibold text-white">{seasonLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">League</span>
              <span className="font-semibold text-white">{sampleSeasonSummary.league || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Upcoming</span>
              <span className="font-semibold text-white">
                {upcomingOpponent
                  ? `Day ${upcomingOpponent.dayIndex}: ${upcomingOpponent.clanName || upcomingOpponent.clanTag}`
                  : 'Not set'}
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
                      disabled={locked}
                      onChange={(e) => {
                        if (locked) return;
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
                        disabled={locked}
                        onChange={() => toggle(m.tag)}
                      />
                    </td>
                    <td className="py-2 text-white font-semibold">{m.name}</td>
                    <td className="py-2 text-slate-200">{m.townHall ?? '—'}</td>
                    <td className="py-2 text-slate-200">{m.heroPower ?? '—'}</td>
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
        <Link href="/new/war/cwl/setup" className="inline-flex">
          <Button>CWL setup</Button>
        </Link>
      </div>
    </div>
  );
}
