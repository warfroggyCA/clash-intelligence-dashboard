"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import {
  buildAiClipboardPayload,
  sampleOpponentStrengthNote,
  sampleOpponentThSpread,
  sampleOpponents,
  sampleRoster,
  sampleSeasonSummary,
} from '../../cwl-data';
import { useRosterData } from '@/app/new/roster/useRosterData';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cn } from '@/lib/utils';

export default function CwlDayPage({ params }: { params: { day: string } }) {
  const dayIndex = Number(params.day) || 1;
  const warSize = sampleSeasonSummary.warSize;
  const { members: rosterMembers } = useRosterData();
  const [opponents, setOpponents] = useState(sampleOpponents);
  const opponent = opponents.find((o) => o.dayIndex === dayIndex) ?? sampleOpponents[0];
  const [opponentRoster, setOpponentRoster] = useState<
    Array<{ name: string; tag: string; townHall: number; heroes?: Record<string, number | null>; readiness?: number | null }>
  >([]);
  const [opponentPlaying, setOpponentPlaying] = useState<Set<string>>(new Set());
  const [opponentThSpread, setOpponentThSpread] = useState<Record<string, number>>(sampleOpponentThSpread);
  const [opponentClanName, setOpponentClanName] = useState<string | null>(opponent.clanName || null);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch(`/api/cwl/opponents?seasonId=${sampleSeasonSummary.seasonId}&warSize=${sampleSeasonSummary.warSize}`);
        if (res.ok) {
          const body = await res.json();
          if (body?.data?.length) {
            setOpponents(body.data);
            return;
          }
        }
      } catch {
        // ignore
      }
      // fallback to local only if server empty
      if (typeof window === 'undefined') return;
      try {
        const stored = window.localStorage.getItem('cwl_opponents_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length === sampleOpponents.length) {
            setOpponents(parsed);
          }
        }
      } catch {
        // ignore
      }
    };
    hydrate();
  }, []);

useEffect(() => {
  const hydrate = async () => {
    try {
      const [eligibleRes, lineupRes] = await Promise.all([
        fetch(`/api/cwl/eligible?seasonId=${sampleSeasonSummary.seasonId}&warSize=${sampleSeasonSummary.warSize}`),
        fetch(`/api/cwl/lineup?seasonId=${sampleSeasonSummary.seasonId}&warSize=${sampleSeasonSummary.warSize}&dayIndex=${dayIndex}`),
      ]);

      if (eligibleRes.ok) {
        const body = await eligibleRes.json();
        const rows = body?.data as any[] | undefined;
        if (rows?.length) {
          setEligiblePool(new Set(rows.map((r) => normalizeTag(r.player_tag))));
        }
      }

      if (lineupRes.ok) {
        const body = await lineupRes.json();
        const rows = body?.data as any[] | undefined;
        if (rows?.length) {
          const row = rows[0];
          if (Array.isArray(row.our_lineup)) setPlaying(new Set((row.our_lineup as string[]).map(normalizeTag)));
          if (Array.isArray(row.opponent_lineup)) setOpponentPlaying(new Set((row.opponent_lineup as string[]).map(normalizeTag)));
        }
      }
    } catch {
      // ignore
    }
  };
  hydrate();
}, [dayIndex]);

const [eligiblePool, setEligiblePool] = useState<Set<string> | null>(null);

  const computedRoster = useMemo(() => {
    const base = rosterMembers && rosterMembers.length
      ? rosterMembers.map((m) => ({
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          townHall: m.townHallLevel ?? (m as any).th ?? 0,
          heroPower: (m.bk ?? 0) + (m.aq ?? 0) + (m.gw ?? 0) + (m.rc ?? 0) + (m.mp ?? 0),
          heroes: {
            bk: m.bk ?? null,
            aq: m.aq ?? null,
            gw: m.gw ?? null,
            rc: m.rc ?? null,
            mp: m.mp ?? null,
          },
          daysPlayed: (m as any).daysPlayed ?? 0,
        }))
      : sampleRoster;
    const filtered = eligiblePool
      ? base.filter((m) => eligiblePool.has(m.tag))
      : base;
    return filtered.sort((a, b) => {
      if (b.townHall !== a.townHall) return b.townHall - a.townHall;
      return b.heroPower - a.heroPower;
    });
  }, [rosterMembers, eligiblePool]);

  const suggested = useMemo(() => computedRoster.slice(0, warSize).map((m) => m.tag), [computedRoster, warSize]);
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const toggle = (tag: string) => {
    setPlaying((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const saveLineup = async () => {
    setLastSaved(new Date().toLocaleTimeString());
    try {
      await fetch('/api/cwl/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: sampleSeasonSummary.seasonId,
          warSize: sampleSeasonSummary.warSize,
          dayIndex,
          ourLineup: Array.from(playing),
          opponentLineup: Array.from(opponentPlaying),
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleCopy = async (includeLineups = false) => {
    try {
      const payload = [
        `CWL Day ${dayIndex} • WarSize ${warSize}v${warSize}`,
        '',
        'Our roster:',
        JSON.stringify(
          computedRoster.map((m) => ({
            name: m.name,
            tag: m.tag,
            th: m.townHall,
            heroPower: m.heroPower,
            heroes: (m as any).heroes,
          })),
          null,
          2,
        ),
        '',
        'Opponent:',
        JSON.stringify(
          {
            tag: opponent?.clanTag,
            name: opponentClanName || opponent?.clanName || 'Unknown',
            thDistribution: opponentThSpread,
            roster: opponentRoster,
          },
          null,
          2,
        ),
        '',
        includeLineups
          ? `Selected lineups:\nOurs: ${JSON.stringify(Array.from(playing), null, 2)}\nOpp: ${JSON.stringify(Array.from(opponentPlaying), null, 2)}`
          : 'Suggest best lineup and matchups. Balance strength and fairness; assume opponent can pick any 15/30 from their roster.',
      ].join('\n');
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setCopied(false);
    }
  };

  const status =
    playing.size === warSize ? 'ready' : playing.size > warSize ? 'too-many' : 'too-few';

  useEffect(() => {
    const fetchOpponent = async () => {
      const tag = opponent?.clanTag && isValidTag(opponent.clanTag) ? normalizeTag(opponent.clanTag) : null;
      if (!tag) return;
      setOppLoading(true);
      setOppError(null);
      try {
        const res = await fetch(`/api/war/opponent?opponentTag=${encodeURIComponent(tag)}&enrich=50`);
        if (!res.ok) throw new Error('Failed to load opponent');
        const body = await res.json();
        const data = body?.data || {};
        const roster: Array<{ name: string; tag: string; townHall: number; heroes?: Record<string, number | null>; readiness?: number | null }> =
          data.roster?.map((m: any) => ({
            name: m.name || m.tag,
            tag: normalizeTag(m.tag || ''),
            townHall: m.th ?? m.townHall ?? m.townHallLevel ?? 0,
            heroes: m.heroes,
            readiness: m.readinessScore ?? null,
          })) || [];
        setOpponentRoster(roster);
        setOpponentThSpread(data.thDistribution || sampleOpponentThSpread);
        setOpponentClanName(data.clan?.name || opponent.clanName || null);
      } catch (err: any) {
        setOppError(err?.message || 'Failed to load opponent');
      } finally {
        setOppLoading(false);
      }
    };
    fetchOpponent();
  }, [opponent, setOppError, setOppLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `cwl_day_opponent_playing_${dayIndex}`,
        JSON.stringify(Array.from(opponentPlaying)),
      );
    } catch {
      // ignore
    }
  }, [dayIndex, opponentPlaying]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            CWL Day {dayIndex} – {opponentClanName || opponent.clanName || 'Opponent'}
          </h1>
          <p className="text-slate-300 text-sm">
            Select the {warSize} who will play today; compare against opponent spread and copy data for AI help.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/new/war/cwl">
            <Button variant="outline">Back to overview</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Opponent summary">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-sm text-slate-200">
                <div className="flex gap-2 items-center">
                  <span className="text-slate-400">Clan</span>
                  <span className="font-semibold text-white">{opponentClanName || '—'}</span>
                  <span className="text-slate-500">{opponent.clanTag}</span>
                </div>
                <div className="text-slate-400 text-sm">{sampleOpponentStrengthNote}</div>
              </div>
              <Button variant="outline" size="sm" title="Fetch updated opponent roster" onClick={() => {
                setOpponents((prev) => [...prev]); // trigger effect
              }}>
                {oppLoading ? 'Refreshing…' : 'Refresh roster'}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
              {Object.entries(opponentThSpread)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([th, count]) => (
                  <div key={th} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">TH{th}</div>
                    <div className="text-white font-semibold">{count}</div>
                  </div>
                ))}
            </div>
          </Card>

          <Card title={`Lineup for Day ${dayIndex}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
              <div>
                <span className="text-slate-400">Playing today:</span>{' '}
                <span className="font-semibold text-white">{playing.size} / {warSize}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveLineup} disabled={status !== 'ready'}>
                  Save lineup
                </Button>
                {lastSaved ? <span className="text-xs text-slate-400">Saved at {lastSaved}</span> : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="py-2">Play</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">TH</th>
                    <th className="py-2">Hero power</th>
                    <th className="py-2">Days played</th>
                    <th className="py-2">Hint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {computedRoster.map((m) => {
                    const checked = playing.has(m.tag);
                    const isSuggested = suggested.includes(m.tag);
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
                        <td className="py-2 text-slate-400">{m.daysPlayed ?? 0}</td>
                        <td className="py-2">
                          {isSuggested ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">Suggested</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {status === 'too-few' && <div className="mt-3 text-amber-300 text-sm">Select {warSize - playing.size} more to reach {warSize}.</div>}
            {status === 'too-many' && <div className="mt-3 text-amber-300 text-sm">Deselect {playing.size - warSize} to reach {warSize}.</div>}
          </Card>

          <Card title="AI export">
            <div className="space-y-3 text-sm text-slate-200">
              <p>Copy roster + opponent context for an LLM. No auto-calls are made.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopy(false)}>{copied ? 'Copied' : 'Copy for AI'}</Button>
                <Button variant="outline" size="sm" onClick={() => handleCopy(true)}>
                  {copied ? 'Copied' : 'Copy matchup prompt'}
                </Button>
              </div>
              <div className="text-xs text-slate-400">Matchup copy includes any selected lineups (ours + opp) for 1:1 pairing suggestions.</div>
            </div>
          </Card>

          <Card title="Opponent roster">
            <div className="space-y-2 text-sm text-slate-200">
              {oppError ? <div className="text-amber-300 text-sm">{oppError}</div> : null}
              {oppLoading ? <div className="text-slate-400 text-sm">Loading opponent roster…</div> : null}
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="py-2">Play</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">TH</th>
                    <th className="py-2">Readiness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {opponentRoster.map((m) => (
                    <tr key={m.tag} className="hover:bg-white/5">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--accent-alt)]"
                          checked={opponentPlaying.has(m.tag)}
                          onChange={() => {
                            setOpponentPlaying((prev) => {
                              const next = new Set(prev);
                              if (next.has(m.tag)) next.delete(m.tag);
                              else next.add(m.tag);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="py-2 text-white font-semibold">{m.name}</td>
                      <td className="py-2 text-slate-200">{m.townHall}</td>
                      <td className="py-2 text-slate-300">
                        {m.readiness != null ? `${m.readiness}/100` : '—'}
                      </td>
                    </tr>
                  ))}
                  {!opponentRoster.length && !oppLoading ? (
                    <tr><td className="py-2 text-slate-400" colSpan={4}>No opponent roster loaded yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-sm text-slate-200 flex flex-wrap items-center gap-3">
              <span className="text-slate-400">Marked playing:</span>
              <span className="font-semibold text-white">{opponentPlaying.size} / {warSize}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const top = opponentRoster
                    .slice()
                    .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
                    .slice(0, warSize)
                    .map((m) => m.tag);
                  setOpponentPlaying(new Set(top));
                }}
              >
                Suggest top {warSize}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpponentPlaying(new Set())}>Clear</Button>
            </div>
            <div className="mt-1 text-xs text-slate-400">Saved locally per day; included in AI export.</div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Fairness hint">
            <div className="space-y-2 text-sm text-slate-200">
              <p className="text-slate-400">Try to spread play across the week. Players with fewer days played get preference when strength is similar.</p>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rule of thumb</div>
                <div className="text-white font-semibold">Start with top TH/hero power, then swap in low-play accounts if strength allows.</div>
              </div>
            </div>
          </Card>

          <Card title="Opponent tone">
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold text-white capitalize">{opponent.status.replace('_', ' ')}</span>
              </div>
              <p className="text-slate-400">Refresh once opponent roster is loaded to keep TH spread accurate.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
