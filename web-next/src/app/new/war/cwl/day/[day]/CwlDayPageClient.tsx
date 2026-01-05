"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import CwlStepBar from '@/components/war/CwlStepBar';
import type { CwlDayOpponent } from '../../cwl-data';
import {
  sampleOpponentStrengthNote,
  sampleOpponentThSpread,
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

const buildThDistribution = (members: Array<{ townHall?: number | null }>) => {
  const distribution: Record<number, number> = {};
  members.forEach((m) => {
    const th = m.townHall ?? null;
    if (!th) return;
    distribution[th] = (distribution[th] || 0) + 1;
  });
  return distribution;
};

const ThDistributionBar = ({ distribution }: { distribution: Record<number, number> }) => {
  const entries = Object.entries(distribution)
    .map(([th, count]) => ({ th: Number(th), count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.th - a.th);

  if (!entries.length) {
    return <div className="text-xs text-slate-500">No TH data yet.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(({ th, count }) => (
        <div
          key={th}
          className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
        >
          TH{th} · {count}
        </div>
      ))}
    </div>
  );
};

const sortByPowerDesc = <T extends { townHall?: number | null; heroPower?: number | null; name?: string | null; tag?: string }>(a: T, b: T) => {
  const thDiff = (b.townHall ?? 0) - (a.townHall ?? 0);
  if (thDiff !== 0) return thDiff;
  const powerDiff = (b.heroPower ?? 0) - (a.heroPower ?? 0);
  if (powerDiff !== 0) return powerDiff;
  const nameA = (a.name || '').toLowerCase();
  const nameB = (b.name || '').toLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return (a.tag || '').localeCompare(b.tag || '');
};

interface CwlDayPageProps {
  day: string;
}

export default function CwlDayPageClient({ day }: CwlDayPageProps) {
  const dayIndex = Number(day) || 1;
  const seasonId = sampleSeasonSummary.seasonId;
  const [warSize, setWarSize] = useState<15 | 30>(sampleSeasonSummary.warSize);
  const steps = ['Setup', 'Lineup', 'Targets', 'Review'];
  const { members: rosterMembers, isLoading: rosterLoading, clanTag: homeClanTag } = useRosterData();
  const LINEUP_CACHE_KEY = useMemo(
    () => `cwl_lineup_cache_${seasonId}_${warSize}_${dayIndex}`,
    [seasonId, warSize, dayIndex],
  );
  const STEP_CACHE_KEY = useMemo(
    () => `cwl_day_step_${seasonId}_${warSize}_${dayIndex}`,
    [seasonId, warSize, dayIndex],
  );
  const [opponents, setOpponents] = useState<CwlDayOpponent[]>([]);
  const opponent = useMemo(() => {
    return (
      opponents.find((o) => o.dayIndex === dayIndex) ?? {
        dayIndex,
        clanTag: '',
        clanName: '',
        status: 'not_loaded',
        note: '',
      }
    );
  }, [opponents, dayIndex]);
  const [step, setStep] = useState<'setup' | 'plan'>('setup');
  const [opponentRoster, setOpponentRoster] = useState<
    Array<{ name: string; tag: string; townHall: number | null; heroes?: Record<string, number | null>; readiness?: number | null }>
  >([]);
  const [opponentOrder, setOpponentOrder] = useState<string[]>([]);
  const [opponentThSpread, setOpponentThSpread] = useState<Record<string, number>>(sampleOpponentThSpread);
  const [opponentClanName, setOpponentClanName] = useState<string | null>(opponent.clanName || null);
  const [opponentFetchedAt, setOpponentFetchedAt] = useState<string | null>(null);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);
  const dayLinks = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const dayNumber = idx + 1;
        const opponentForDay = opponents.find((item) => item.dayIndex === dayNumber);
        return {
          dayNumber,
          label: opponentForDay?.clanName || opponentForDay?.clanTag || '',
        };
      }),
    [opponents],
  );

  useEffect(() => {
    if (opponent?.clanName && opponent.clanName !== opponentClanName) {
      setOpponentClanName(opponent.clanName);
    }
  }, [opponent?.clanName, opponentClanName]);

  useEffect(() => {
    const hydrateSeason = async () => {
      try {
        const res = await fetch(`/api/cwl/season?seasonId=${seasonId}&warSize=${warSize}`);
        if (!res.ok) return;
        const body = await res.json();
        const size = Number(body?.data?.war_size);
        if ((size === 15 || size === 30) && size !== warSize) {
          setWarSize(size);
        }
      } catch {
        // ignore
      }
    };
    hydrateSeason();
  }, [seasonId, warSize]);

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
        const res = await fetch(`/api/cwl/opponents?seasonId=${seasonId}&warSize=${warSize}`);
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
          fetch(`/api/cwl/eligible?seasonId=${seasonId}&warSize=${warSize}`),
          fetch(`/api/cwl/lineup?seasonId=${seasonId}&warSize=${warSize}&dayIndex=${dayIndex}`),
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
}, [dayIndex, LINEUP_CACHE_KEY, seasonId, warSize]);

const [eligiblePool, setEligiblePool] = useState<Set<string> | null>(null);

  const computedRoster = useMemo(() => {
    // If still loading, return empty array to avoid showing incomplete roster data
    // This ensures we wait for the real roster data before displaying
    if (rosterLoading && (!rosterMembers || rosterMembers.length === 0)) {
      return [];
    }
    
    const base = rosterMembers && rosterMembers.length
      ? rosterMembers.map((m) => ({
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          townHall: m.townHallLevel ?? (m as any).th ?? null,
          heroPower: m.heroPower ?? null,
          heroes: {
            bk: m.bk ?? null,
            aq: m.aq ?? null,
            gw: m.gw ?? null,
            rc: m.rc ?? null,
            mp: m.mp ?? null,
          },
          daysPlayed: typeof (m as any).daysPlayed === 'number' ? (m as any).daysPlayed : undefined,
        }))
      : [];
    const filtered = eligiblePool ? base.filter((m) => eligiblePool.has(m.tag)) : base;
    return filtered.sort(sortByPowerDesc);
  }, [rosterMembers, eligiblePool, rosterLoading]);

  const suggested = useMemo(() => computedRoster.slice(0, warSize).map((m) => m.tag), [computedRoster, warSize]);
  const [lineupOrder, setLineupOrder] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lineupLookup = useMemo(() => {
    const map: Record<string, { townHall: number | null; heroPower: number | null }> = {};
    computedRoster.forEach((m) => {
      map[m.tag] = { townHall: m.townHall, heroPower: m.heroPower };
    });
    return map;
  }, [computedRoster]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.sessionStorage.getItem(STEP_CACHE_KEY);
    if (cached === 'plan') {
      setStep('plan');
    }
  }, [STEP_CACHE_KEY]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STEP_CACHE_KEY, step);
  }, [step, STEP_CACHE_KEY]);

  useEffect(() => {
    setStep('setup');
    setLineupOrder((prev) => (prev.length > warSize ? prev.slice(0, warSize) : prev));
    setOpponentOrder((prev) => (prev.length > warSize ? prev.slice(0, warSize) : prev));
  }, [warSize]);

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
    setLineupOrder((prev) => {
      const next = prev.filter((t) => allowed.has(t));
      if (next.length === prev.length && next.every((tag, idx) => tag === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [computedRoster]);

  const sortLineupByStrength = () => {
    setLineupOrder((prev) => {
      const ordered = prev
        .map((t) => ({ tag: t, ...lineupLookup[t] }))
        .filter((m) => m.tag && typeof m.townHall === 'number')
        .sort((a, b) => {
          const aTh = a.townHall ?? 0;
          const bTh = b.townHall ?? 0;
          if (bTh !== aTh) return bTh - aTh;
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
    try {
      setSaveState('saving');
      setSaveError(null);
      const res = await fetch('/api/cwl/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId,
          warSize,
          dayIndex,
          ourLineup: lineupOrder,
          opponentLineup: opponentOrder,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to save lineup');
      }
      const updatedAt = body?.data?.updated_at || body?.data?.updatedAt || null;
      setLastSaved(updatedAt ? new Date(updatedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setSaveError('Save failed. Try again.');
      setTimeout(() => setSaveState('idle'), 2500);
    }
  };

  const handleCopy = async (includeLineups = false) => {
    try {
      setCopyState('copying');
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
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (err) {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
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

  const fetchOpponentRoster = useCallback(async (overrideTag?: string, options?: { force?: boolean }) => {
    const candidate = overrideTag || opponent?.clanTag || '';
    const tag = candidate && isValidTag(candidate) ? normalizeTag(candidate) : null;
    if (!tag) {
      setOppError('Set a valid opponent tag in CWL Setup before loading roster data.');
      return;
    }
    setOppLoading(true);
    setOppError(null);
    try {
      const params = new URLSearchParams({ opponentTag: tag, enrich: '50', rosterSource: 'cwl' });
      if (homeClanTag) params.set('ourClanTag', homeClanTag);
      params.set('dayIndex', String(dayIndex));
      if (options?.force) params.set('refresh', 'true');
      const res = await fetch(`/api/war/opponent?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load opponent');
      const body = await res.json();
      const data = body?.data || {};
      const roster: Array<{ name: string; tag: string; townHall: number | null; heroes?: Record<string, number | null>; readiness?: number | null }> =
        data.roster?.map((m: any) => ({
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          townHall: m.th ?? m.townHall ?? m.townHallLevel ?? null,
          heroes: m.heroes,
          readiness: m.readinessScore ?? null,
        })) || [];
      setOpponentRoster(roster);
      setOpponentThSpread(data.thDistribution || sampleOpponentThSpread);
      setOpponentClanName(data.clan?.name || opponent.clanName || null);
      setOpponentFetchedAt(new Date().toISOString());
    } catch (err: any) {
      setOppError(err?.message || 'Failed to load opponent');
    } finally {
      setOppLoading(false);
    }
  }, [dayIndex, homeClanTag, opponent]);

  useEffect(() => {
    if (opponent?.clanTag && isValidTag(opponent.clanTag)) {
      fetchOpponentRoster(opponent.clanTag);
    }
  }, [fetchOpponentRoster, opponent?.clanTag]);

  const rosterSourceLabel = eligiblePool ? 'Season roster' : 'Current roster';
  const rosterReady = computedRoster.length >= warSize;
  const opponentTagValid = opponent?.clanTag ? isValidTag(opponent.clanTag) : false;
  const opponentReady = opponentTagValid && opponentRoster.length > 0;
  const canStartPlanning = rosterReady && opponentReady;
  const activeStepIndex = step === 'setup' ? 0 : 1;
  const rosterThDistribution = useMemo(() => buildThDistribution(computedRoster), [computedRoster]);
  const opponentThDistribution = useMemo(() => buildThDistribution(opponentRoster), [opponentRoster]);
  const rosterTopAvg = useMemo(() => {
    if (!computedRoster.length) return null;
    const top = computedRoster
      .slice()
      .sort((a, b) => (b.townHall ?? 0) - (a.townHall ?? 0) || (b.heroPower ?? 0) - (a.heroPower ?? 0))
      .slice(0, warSize);
    if (!top.length) return null;
    if (top.some((m) => typeof m.heroPower !== 'number')) return null;
    return Math.round(top.reduce((sum, m) => sum + (m.heroPower ?? 0), 0) / top.length);
  }, [computedRoster, warSize]);
  const opponentTopAvg = useMemo(() => {
    if (!opponentRoster.length) return null;
    const heroPower = (heroes?: Record<string, number | null>) => {
      if (!heroes) return null;
      const values = [heroes.bk, heroes.aq, heroes.gw, heroes.rc, heroes.mp].filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value),
      );
      if (!values.length) return null;
      return values.reduce((sum, value) => sum + value, 0);
    };
    const top = opponentRoster
      .slice()
      .filter((m) => m.townHall)
      .sort((a, b) => (b.townHall ?? 0) - (a.townHall ?? 0) || (heroPower(b.heroes) ?? 0) - (heroPower(a.heroes) ?? 0))
      .slice(0, warSize);
    if (!top.length) return null;
    const heroValues = top.map((m) => heroPower(m.heroes));
    if (heroValues.some((value) => typeof value !== 'number')) return null;
    const topLength = top.length;
    if (!topLength) return null;
    return Math.round(heroValues.reduce((sum, value) => sum + (value ?? 0), 0) / topLength);
  }, [opponentRoster, warSize]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            CWL Day {dayIndex} – {opponentClanName || opponent.clanName || 'Opponent'}
          </h1>
          <p className="text-slate-300 text-sm">
            {warSize}v{warSize} • Step {activeStepIndex + 1} of {steps.length}: {steps[activeStepIndex]}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/new/war/cwl/setup">
            <Button tone="ghost">Back to CWL Setup</Button>
          </Link>
          {step === 'plan' ? (
            <Button tone="ghost" onClick={() => setStep('setup')}>Edit setup</Button>
          ) : null}
        </div>
      </div>

      <CwlStepBar current="day" dayIndex={dayIndex} />

      <div
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
      >
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Jump to day</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {dayLinks.map((link) => {
            const isActive = link.dayNumber === dayIndex;
            return (
            <Link key={link.dayNumber} href={`/new/war/cwl/day/${link.dayNumber}`}>
              <Button
                tone={isActive ? 'primary' : 'ghost'}
                className={cn('px-3 py-1', isActive ? 'text-slate-900' : 'text-slate-200')}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                <span className="flex flex-col leading-tight">
                  <span>Day {link.dayNumber}</span>
                  {link.label ? (
                    <span className={cn('text-[10px]', isActive ? 'text-slate-700' : 'text-slate-500')}>
                      {link.label}
                    </span>
                  ) : null}
                </span>
              </Button>
            </Link>
          )})}
        </div>
      </div>

      {step === 'setup' ? (
        <Card title="Day setup">
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm text-slate-200" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">War size</div>
              <div className="font-semibold text-white">{warSize}v{warSize}</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">Set in CWL Setup.</div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Our roster</div>
                    <div className="text-lg font-semibold text-white">{rosterSourceLabel}</div>
                  </div>
                  <Link href="/new/war/cwl/roster">
                    <Button tone="ghost" className="text-xs">Set season roster</Button>
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Eligible</div>
                    <div className="text-2xl font-bold text-white">{computedRoster.length}</div>
                    {!rosterReady ? (
                      <div className="text-xs text-amber-300">Need at least {warSize} players.</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Top {warSize} hero power avg</div>
                    <div className="text-2xl font-bold text-emerald-300">{rosterTopAvg ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-slate-500 uppercase mb-2">TH distribution</div>
                  <ThDistributionBar distribution={rosterThDistribution} />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Season roster = weekly eligible pool. Day lineup is picked in the next step.
                </div>
                {rosterLoading ? <div className="mt-3 text-xs text-slate-500">Loading roster…</div> : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Opponent</div>
                    <div className="text-lg font-semibold text-white">{opponentClanName || '—'}</div>
                    <div className="text-xs text-slate-500">{opponent?.clanTag || 'No tag set'}</div>
                  </div>
                  <Link href="/new/war/cwl/setup">
                    <Button tone="ghost" className="text-xs">Edit opponents</Button>
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button tone="ghost" className="text-sm" onClick={() => fetchOpponentRoster(opponent?.clanTag)} disabled={oppLoading || !opponentTagValid}>
                    {oppLoading ? 'Loading…' : 'Load opponent roster'}
                  </Button>
                  <Button
                    tone="ghost"
                    className="text-sm"
                    title="Bypass cache and fetch the latest roster"
                    onClick={() => fetchOpponentRoster(opponent?.clanTag, { force: true })}
                    disabled={oppLoading || !opponentTagValid}
                  >
                    Force refresh
                  </Button>
                  {!opponentTagValid ? (
                    <span className="text-xs text-amber-300">Set the opponent tag first.</span>
                  ) : null}
                </div>
                {oppError ? <div className="mt-2 text-xs text-amber-300">{oppError}</div> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Roster loaded</div>
                    <div className="text-lg font-semibold text-white">{opponentRoster.length || '—'}</div>
                    {opponentFetchedAt ? (
                      <div className="text-xs text-slate-500">Fetched {new Date(opponentFetchedAt).toLocaleTimeString()}</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Top {warSize} hero power avg</div>
                    <div className="text-lg font-semibold text-amber-300">{opponentTopAvg ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-slate-500 uppercase mb-2">TH distribution (known)</div>
                  <ThDistributionBar distribution={opponentThDistribution} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {canStartPlanning ? 'Setup complete. Move on to lineup planning.' : 'Complete roster + opponent intake to continue.'}
            </div>
            <Button onClick={() => setStep('plan')} disabled={!canStartPlanning}>
              Start planning
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'plan' ? (
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
                <div className="text-slate-400 text-sm">{sampleOpponentStrengthNote || 'No opponent note yet.'}</div>
              </div>
                <Button
                  tone="ghost"
                  title="Bypass cache and fetch the latest opponent roster"
                  onClick={() => fetchOpponentRoster(opponent?.clanTag, { force: true })}
                  className="text-sm"
                  disabled={oppLoading}
                >
                {oppLoading ? 'Refreshing…' : 'Force refresh'}
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
              <div className="mb-2 text-[11px] text-slate-400">
                Suggested = top {warSize} by TH + hero power.
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
                          'flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm',
                          checked ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/10' : 'border-[var(--border-subtle)] bg-[var(--panel)]',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--accent-alt)]"
                            checked={checked}
                            onChange={() => toggle(m.tag)}
                            aria-label={`Select ${m.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white break-words">{m.name}</span>
                              <span className="text-xs text-slate-500 shrink-0">
                                {m.townHall != null ? `TH${m.townHall}` : 'TH—'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{m.tag}</div>
                          </div>
                        </div>
                        {isSuggested ? (
                          <span
                            className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200"
                            title={`Top ${warSize} by TH + hero power`}
                          >
                            Suggested
                          </span>
                        ) : null}
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
                  {[...opponentRoster]
                    .map((m) => ({
                      ...m,
                      heroPower: m.heroes
                        ? Object.values(m.heroes).reduce((sum, level) => sum + (Number(level) || 0), 0)
                        : 0,
                    }))
                    .sort(sortByPowerDesc)
                    .map((m) => (
                    <label
                      key={m.tag}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm',
                        opponentOrder.includes(m.tag) ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/10' : 'border-[var(--border-subtle)] bg-[var(--panel)]',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white break-words">{m.name}</span>
                            <span className="text-xs text-slate-500 shrink-0">
                              {m.townHall != null ? `TH${m.townHall}` : 'TH—'}
                            </span>
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
                  <Button onClick={saveLineup} className="text-sm" disabled={saveState === 'saving'}>
                    {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save lineup'}
                  </Button>
                  {lastSaved ? <span className="text-xs text-slate-400">Saved at {lastSaved}</span> : null}
                  {saveState === 'saved' ? <span className="text-xs text-green-400">Saved ✓</span> : null}
                  {saveState === 'error' ? (
                    <span className="text-xs text-red-400">{saveError || 'Save failed'}</span>
                  ) : null}
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
                <Button
                  tone="ghost"
                  onClick={() => handleCopy(false)}
                  className="text-sm"
                  disabled={copyState === 'copying'}
                >
                  {copyState === 'copying'
                    ? 'Copying...'
                    : copyState === 'copied'
                      ? 'Copied'
                      : copyState === 'error'
                        ? 'Copy failed'
                        : 'Copy for AI'}
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => handleCopy(true)}
                  className="text-sm"
                  disabled={copyState === 'copying'}
                >
                  {copyState === 'copying'
                    ? 'Copying...'
                    : copyState === 'copied'
                      ? 'Copied'
                      : copyState === 'error'
                        ? 'Copy failed'
                        : 'Copy matchup prompt'}
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
      ) : null}
    </div>
  );
}
