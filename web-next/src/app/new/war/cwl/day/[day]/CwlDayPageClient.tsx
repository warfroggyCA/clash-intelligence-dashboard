"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import type { CwlDayOpponent } from '../../cwl-data';
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

// Compact drag style to keep ghost near cursor (zero x-translate, remove margin)
const dragStyle = (isDragging: boolean, draggableStyle: any) => {
  if (!draggableStyle) return undefined;
  const next: any = { ...draggableStyle, margin: 0, zIndex: isDragging ? 1000 : 'auto' };
  if (isDragging) {
    next.transform = draggableStyle.transform?.replace(/translateX\([^)]+\)/g, 'translateX(0)') || draggableStyle.transform;
  }
  return next;
};

interface CwlDayPageProps {
  day: string;
}

export default function CwlDayPageClient({ day }: CwlDayPageProps) {
  const dayIndex = Number(day) || 1;
  const warSize = sampleSeasonSummary.warSize;
  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  const LINEUP_CACHE_KEY = `cwl_lineup_cache_${sampleSeasonSummary.seasonId}_${sampleSeasonSummary.warSize}_${dayIndex}`;
  const [opponents, setOpponents] = useState<CwlDayOpponent[]>([]);
  const opponent = opponents.find((o) => o.dayIndex === dayIndex) ?? sampleOpponents[0];
  const [opponentRoster, setOpponentRoster] = useState<
    Array<{ name: string; tag: string; townHall: number; heroes?: Record<string, number | null>; readiness?: number | null }>
  >([]);
  const [opponentOrder, setOpponentOrder] = useState<string[]>([]);
  const [opponentThSpread, setOpponentThSpread] = useState<Record<string, number>>(sampleOpponentThSpread);
  const [opponentClanName, setOpponentClanName] = useState<string | null>(opponent.clanName || null);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      if (typeof window !== 'undefined') {
        try {
          const cached = window.localStorage.getItem(LINEUP_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed?.our)) setLineupOrder(parsed.our.map(normalizeTag));
            if (Array.isArray(parsed?.opp)) setOpponentOrder(parsed.opp.map(normalizeTag));
          }
        } catch {
          // ignore cache errors
        }
      }
      try {
        const res = await fetch(`/api/cwl/opponents?seasonId=${sampleSeasonSummary.seasonId}&warSize=${sampleSeasonSummary.warSize}`);
        if (res.ok) {
          const body = await res.json();
          if (body?.data?.length) {
            const mapped = (body.data as any[]).map((row) => ({
              dayIndex: row.day_index ?? row.dayIndex ?? 0,
              clanTag: row.opponent_tag ?? row.clanTag ?? '',
              clanName: row.opponent_name ?? row.clanName ?? '',
              status: row.status ?? 'not_loaded',
              note: row.note ?? '',
            }));
            setOpponents(mapped);
          }
        }
      } catch {
        // ignore
      }
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
          if (Array.isArray(row.our_lineup)) setLineupOrder((row.our_lineup as string[]).map(normalizeTag));
          if (Array.isArray(row.opponent_lineup)) setOpponentOrder((row.opponent_lineup as string[]).map(normalizeTag));
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              LINEUP_CACHE_KEY,
              JSON.stringify({
                our: Array.isArray(row.our_lineup) ? row.our_lineup : [],
                opp: Array.isArray(row.opponent_lineup) ? row.opponent_lineup : [],
                savedAt: Date.now(),
              }),
            );
          }
        }
      }
    } catch {
      // ignore
    }
  };
  hydrate();
}, [dayIndex, LINEUP_CACHE_KEY]);

const [eligiblePool, setEligiblePool] = useState<Set<string> | null>(null);

  const computedRoster = useMemo(() => {
    // If still loading, return empty array to avoid showing incomplete sampleRoster
    // This ensures we wait for the real roster data before displaying
    if (rosterLoading && (!rosterMembers || rosterMembers.length === 0)) {
      return [];
    }
    
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
    const filtered = eligiblePool ? base.filter((m) => eligiblePool.has(m.tag)) : base;
    return filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return a.tag.localeCompare(b.tag);
    });
  }, [rosterMembers, eligiblePool, rosterLoading]);

  const suggested = useMemo(() => computedRoster.slice(0, warSize).map((m) => m.tag), [computedRoster, warSize]);
  const [lineupOrder, setLineupOrder] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const lineupLookup = useMemo(() => {
    const map: Record<string, { townHall: number; heroPower: number }> = {};
    computedRoster.forEach((m) => {
      map[m.tag] = { townHall: m.townHall, heroPower: m.heroPower };
    });
    return map;
  }, [computedRoster]);

  const toggle = (tag: string) => {
    setLineupOrder((prev) => {
      const exists = prev.includes(tag);
      if (exists) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
  };

  // Drop any lineup entries that no longer exist in roster
  useEffect(() => {
    const allowed = new Set(computedRoster.map((m) => m.tag));
    setLineupOrder((prev) => prev.filter((t) => allowed.has(t)));
  }, [computedRoster]);

  const sortLineupByStrength = () => {
    setLineupOrder((prev) => {
      const ordered = prev
        .map((t) => ({ tag: t, ...lineupLookup[t] }))
        .filter((m) => m.tag && typeof m.townHall === 'number')
        .sort((a, b) => {
          if (b.townHall !== a.townHall) return b.townHall - a.townHall;
          return (b.heroPower ?? 0) - (a.heroPower ?? 0);
        })
        .map((m) => m.tag);
      return ordered;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (source.droppableId === 'lineup-order' && destination.droppableId === 'lineup-order') {
      setLineupOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
      return;
    }

    if (source.droppableId === 'opponent-order' && destination.droppableId === 'opponent-order') {
      setOpponentOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
    }
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
          ourLineup: lineupOrder,
          opponentLineup: opponentOrder,
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
          ? `Selected lineups:\nOurs: ${JSON.stringify(lineupOrder, null, 2)}\nOpp: ${JSON.stringify(opponentOrder, null, 2)}`
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
    lineupOrder.length === warSize ? 'ready' : lineupOrder.length > warSize ? 'too-many' : 'too-few';
  const lineupRows = useMemo(() => Array.from({ length: warSize }, (_, i) => lineupOrder[i] ?? null), [lineupOrder, warSize]);
  const opponentRows = useMemo(() => {
    if (opponentOrder.length) {
      return Array.from({ length: warSize }, (_, i) => opponentOrder[i] ?? null);
    }
    const rosterTags = [...opponentRoster]
      .sort((a, b) => (b.townHall ?? 0) - (a.townHall ?? 0) || (a.name || '').localeCompare(b.name || ''))
      .map((m) => m.tag);
    return Array.from({ length: warSize }, (_, i) => rosterTags[i] ?? null);
  }, [opponentOrder, opponentRoster, warSize]);

  const fetchOpponentRoster = useCallback(async () => {
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
  }, [opponent]);

  useEffect(() => {
    fetchOpponentRoster();
  }, [fetchOpponentRoster]);

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
            <Button tone="ghost">Back to overview</Button>
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
              <Button
                tone="ghost"
                title="Fetch updated opponent roster"
                onClick={() => fetchOpponentRoster()}
                className="text-sm"
                disabled={oppLoading}
              >
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Select our players">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                <div>
                  <span className="text-slate-400">Selected:</span>{' '}
                  <span className="font-semibold text-white">{lineupOrder.length} / {warSize}</span>
                </div>
                <Button tone="ghost" className="text-xs px-2 py-1" onClick={sortLineupByStrength} disabled={!lineupOrder.length}>
                  Sort selected by TH/Power
                </Button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid gap-2 sm:grid-cols-2">
                  {computedRoster.map((m) => {
                    const checked = lineupOrder.includes(m.tag);
                    const isSuggested = suggested.includes(m.tag);
                    return (
                      <label
                        key={m.tag}
                        className={cn(
                          'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                          checked ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/10' : 'border-[var(--border-subtle)] bg-[var(--panel)]',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--accent-alt)]"
                            checked={checked}
                            onChange={() => toggle(m.tag)}
                            aria-label={`Select ${m.name}`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate">{m.name}</span>
                              <span className="text-xs text-slate-500">TH{m.townHall}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{m.tag}</div>
                          </div>
                        </div>
                        {isSuggested ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200">Suggested</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
              {status === 'too-few' && <div className="mt-3 text-amber-300 text-sm">Select {warSize - lineupOrder.length} more to reach {warSize}.</div>}
              {status === 'too-many' && <div className="mt-3 text-amber-300 text-sm">Deselect {lineupOrder.length - warSize} to reach {warSize}.</div>}
            </Card>

            <Card title="Select opponent players">
              <div className="text-xs text-slate-400 mb-2">Mark their likely lineup when known.</div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...opponentRoster].sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    if (nameA !== nameB) return nameA.localeCompare(nameB);
                    return a.tag.localeCompare(b.tag);
                  }).map((m) => (
                    <label
                      key={m.tag}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                        opponentOrder.includes(m.tag) ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/10' : 'border-[var(--border-subtle)] bg-[var(--panel)]',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--accent-alt)]"
                          checked={opponentOrder.includes(m.tag)}
                          onChange={() => {
                            setOpponentOrder((prev) => {
                              if (prev.includes(m.tag)) return prev.filter((t) => t !== m.tag);
                              return [...prev, m.tag];
                            });
                          }}
                          aria-label={`Mark ${m.name} playing`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white truncate">{m.name}</span>
                            <span className="text-xs text-slate-500">TH{m.townHall}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{m.tag}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                  {!opponentRoster.length && !oppLoading ? (
                    <div className="text-xs text-slate-400">No opponent roster loaded yet.</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="text-slate-400">Marked playing:</span>
                <span className="font-semibold text-white">{opponentOrder.length} / {warSize}</span>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const top = opponentRoster
                      .slice()
                      .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
                      .slice(0, warSize)
                      .map((m) => m.tag);
                    setOpponentOrder(top);
                  }}
                  className="text-sm"
                >
                  Suggest top {warSize}
                </Button>
                <Button tone="ghost" onClick={() => setOpponentOrder([])} className="text-sm">Clear</Button>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={`Lineup order (our clan)`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                <div>
                  <span className="text-slate-400">Playing today:</span>{' '}
                  <span className="font-semibold text-white">{lineupOrder.length} / {warSize}</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveLineup} className="text-sm">
                    Save lineup
                  </Button>
                  {lastSaved ? <span className="text-xs text-slate-400">Saved at {lastSaved}</span> : null}
                </div>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="lineup-order">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border px-4 py-4 transition-all min-h-[240px]",
                        snapshot.isDraggingOver && "bg-[var(--accent-alt)]/10 border-[var(--accent-alt)]"
                      )}
                      style={{ 
                        borderColor: snapshot.isDraggingOver ? 'var(--accent-alt)' : 'var(--border-subtle)', 
                        background: snapshot.isDraggingOver ? 'var(--accent-alt)/5' : 'var(--panel)' 
                      }}
                    >
                      {lineupOrder.length === 0 ? (
                        <div className="flex items-center justify-center h-full py-8">
                          <span className="text-sm text-slate-400 text-center">
                            ✓ Select players above, then drag them here to set the attack order
                          </span>
                        </div>
                      ) : null}
                      {lineupRows.map((tag, index) => {
                        const m = tag ? computedRoster.find((p) => p.tag === tag) : undefined;
                        return (
                          <Draggable key={tag ?? `empty-${index}`} draggableId={tag ?? `empty-${index}`} index={index} isDragDisabled={!tag}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...(tag ? dragProvided.dragHandleProps : {})}
                                style={dragStyle(snapshot.isDragging, dragProvided.draggableProps.style)}
                                className={cn(
                                  "flex items-center gap-2 w-full h-14 transition-all",
                                  snapshot.isDragging && "cursor-grabbing scale-105"
                                )}
                              >
                                <span className="text-xs text-slate-400 w-8 text-right shrink-0 font-semibold">#{index + 1}</span>
                                <div
                                  className={cn(
                                    'flex h-full flex-1 items-center justify-between rounded-md border px-3 py-2 text-sm text-white shadow-sm transition-all cursor-grab min-w-0 max-w-md',
                                    snapshot.isDragging
                                      ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/40 shadow-lg ring-2 ring-[var(--accent-alt)]/50'
                                      : tag
                                        ? 'border-[var(--border-subtle)] bg-white/10 hover:bg-white/15'
                                        : 'border-dashed border-[var(--border-subtle)]/50 bg-white/5',
                                    !tag && 'cursor-not-allowed opacity-40'
                                  )}
                                >
                                  <div className="flex flex-col leading-tight min-w-0 text-left">
                                    <span className="font-semibold truncate">{m?.name || '—'}</span>
                                    <span className="text-xs text-slate-500 truncate">{tag || ''}</span>
                                  </div>
                                  <span className="flex items-center gap-1 text-xs text-slate-400 ml-2 shrink-0">
                                    {m?.townHall ? <TownHallIcon level={m.townHall} size="sm" /> : null}
                                    {m?.townHall ? m.townHall : '—'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="mt-2 text-xs text-slate-400">
                💡 <strong className="text-slate-300">Drag and drop</strong> players to reorder the lineup. Grab a player chip and move it to the desired position.
              </div>
              {status === 'too-few' && <div className="mt-2 text-amber-300 text-sm">Select {warSize - lineupOrder.length} more to reach {warSize}.</div>}
              {status === 'too-many' && <div className="mt-2 text-amber-300 text-sm">Deselect {lineupOrder.length - warSize} to reach {warSize}.</div>}
            </Card>

            <Card title="Opponent lineup (markers)">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                <div>
                  <span className="text-slate-400">Marked playing:</span>{' '}
                  <span className="font-semibold text-white">{opponentOrder.length} / {warSize}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    tone="ghost"
                    onClick={() => {
                      const top = opponentRoster
                        .slice()
                        .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
                        .slice(0, warSize)
                        .map((m) => m.tag);
                      setOpponentOrder(top);
                    }}
                    className="text-sm"
                  >
                    Suggest top {warSize}
                  </Button>
                  <Button tone="ghost" onClick={() => setOpponentOrder([])} className="text-sm">Clear</Button>
                </div>
              </div>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="opponent-order">
                  {(providedOpp, snapshotOpp) => (
                    <div
                      ref={providedOpp.innerRef}
                      {...providedOpp.droppableProps}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border px-4 py-4 transition-all min-h-[240px]",
                        snapshotOpp.isDraggingOver && "bg-[var(--accent-alt)]/10 border-[var(--accent-alt)]"
                      )}
                      style={{ 
                        borderColor: snapshotOpp.isDraggingOver ? 'var(--accent-alt)' : 'var(--border-subtle)', 
                        background: snapshotOpp.isDraggingOver ? 'var(--accent-alt)/5' : 'var(--panel)' 
                      }}
                    >
                      {opponentRows.map((tag, idx) => {
                        const m = tag ? opponentRoster.find((p) => p.tag === tag) : undefined;
                        return (
                          <Draggable key={tag ?? `opp-empty-${idx}`} draggableId={tag ?? `opp-empty-${idx}`} index={idx} isDragDisabled={!tag}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...(tag ? dragProvided.dragHandleProps : {})}
                                style={dragStyle(snapshot.isDragging, dragProvided.draggableProps.style)}
                                className={cn(
                                  "flex items-center gap-2 w-full h-14 transition-all",
                                  snapshot.isDragging && "cursor-grabbing scale-105"
                                )}
                              >
                                <span className="text-xs text-slate-400 w-8 text-right shrink-0 font-semibold">#{idx + 1}</span>
                                <div
                                  className={cn(
                                    'flex h-full flex-1 items-center justify-between rounded-md border px-3 py-2 text-sm text-white shadow-sm transition-all cursor-grab min-w-0 max-w-md',
                                    snapshot.isDragging
                                      ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/40 shadow-lg ring-2 ring-[var(--accent-alt)]/50'
                                      : tag
                                        ? 'border-[var(--border-subtle)] bg-white/10 hover:bg-white/15'
                                        : 'border-dashed border-[var(--border-subtle)]/50 bg-white/5',
                                    !tag && 'cursor-not-allowed opacity-40'
                                  )}
                                >
                                  <div className="flex flex-col leading-tight min-w-0 text-left">
                                    <span className="font-semibold truncate">{m?.name || '—'}</span>
                                    <span className="text-xs text-slate-500 truncate">{m?.tag || tag || ''}</span>
                                  </div>
                                  <span className="flex items-center gap-1 text-xs text-slate-400 ml-2 shrink-0">
                                    {m?.townHall ? <TownHallIcon level={m.townHall} size="sm" /> : null}
                                    {m?.townHall ? m.townHall : '—'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {providedOpp.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {!opponentOrder.length ? <div className="mt-2 text-xs text-slate-400">No opponent lineup selected yet.</div> : null}
            </Card>
          </div>

          <Card title="AI export">
            <div className="space-y-3 text-sm text-slate-200">
              <p>Copy roster + opponent context for an LLM. No auto-calls are made.</p>
              <div className="flex flex-wrap gap-2">
                <Button tone="ghost" onClick={() => handleCopy(false)} className="text-sm">{copied ? 'Copied' : 'Copy for AI'}</Button>
                <Button tone="ghost" onClick={() => handleCopy(true)} className="text-sm">
                  {copied ? 'Copied' : 'Copy matchup prompt'}
                </Button>
              </div>
              <div className="text-xs text-slate-400">Matchup copy includes any selected lineups (ours + opp) for 1:1 pairing suggestions.</div>
            </div>
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
