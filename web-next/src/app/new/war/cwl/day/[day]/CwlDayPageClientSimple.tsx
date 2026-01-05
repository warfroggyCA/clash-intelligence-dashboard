"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import CwlStepBar from '@/components/war/CwlStepBar';
import LineupBuilder, { type LineupSlot, type LineupPlayer } from '@/components/war/LineupBuilder';
import type { CwlDayOpponent } from '../../cwl-data';
import { sampleSeasonSummary } from '../../cwl-data';
import { useRosterData } from '@/app/new/roster/useRosterData';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { resolveHeroPower } from '@/lib/roster-derivations';
import { cn } from '@/lib/utils';
import { cfg } from '@/lib/config';
import { isWarEnded, normalizeWarState } from '@/lib/cwl-war-state';
import { Ghost } from 'lucide-react';

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

const mapOpponentRosterSnapshot = (snapshot: unknown) => {
  if (!Array.isArray(snapshot)) return [];
  return snapshot
    .map((m: any) => ({
      name: m?.name || m?.tag || '',
      tag: normalizeTag(m?.tag || ''),
      townHall: m?.th ?? m?.townHall ?? m?.townHallLevel ?? null,
      heroes: m?.heroes ?? null,
      isGhost: m?.isGhost ?? false,
    }))
    .filter((m) => m.tag);
};

// Extended player type with ghost flag
interface CwlPlayer extends LineupPlayer {
  isGhost: boolean;
  mapPosition?: number | null;
}

type CwlDayResult = {
  result: 'W' | 'L' | 'T' | null;
  ourStars: number;
  opponentStars: number;
  ourDestructionPct: number;
  opponentDestructionPct: number;
  warState: string | null;
  opponentName: string | null;
};

type CwlDayOpponentRow = CwlDayOpponent & {
  thDistribution?: Record<string, number> | null;
  rosterSnapshot?: any[] | null;
  fetchedAt?: string | null;
};

type AttendancePlayer = {
  tag: string;
  name: string | null;
  attacksAvailable: number;
  attacksPerformed: number;
  missedAttacks: number;
  missedByDay: Array<{ day: number; missed: number; slots: number }>;
  status?: string;
};

type AttendanceSummary = {
  hasData: boolean;
  clanTag?: string;
  seasonId?: string;
  targetDayIndex?: number;
  error?: string | null;
  days: number[];
  daysWithData: number[];
  missingDays: number[];
  updatedAt?: string | null;
  noShows: AttendancePlayer[];
  missedAttacks: AttendancePlayer[];
  players: AttendancePlayer[];
};

export interface CwlDayInitialData {
  season: {
    seasonId: string;
    warSize: 15 | 30;
    seasonLabel?: string | null;
    lockedAt?: string | null;
  };
  roster?: {
    members: CwlPlayer[];
    ghostCount: number;
    source: 'cwl' | 'clan';
  };
  opponents?: CwlDayOpponentRow[];
  dayResult?: CwlDayResult | null;
  lineup?: {
    ourLineup: string[];
    opponentLineup: string[];
    updatedAt?: string | null;
  };
}

interface CwlDayPageProps {
  day: string;
  initialData?: CwlDayInitialData;
}

export default function CwlDayPageClientSimple({ day, initialData }: CwlDayPageProps) {
  const dayIndex = Number(day) || 1;
  const seasonId = initialData?.season.seasonId ?? sampleSeasonSummary.seasonId;
  const [warSize, setWarSize] = useState<15 | 30>(initialData?.season.warSize ?? sampleSeasonSummary.warSize);
  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  const homeClanTag = cfg.homeClanTag;
  const initialRoster = initialData?.roster?.members ?? [];

  // CWL roster state (primary source during CWL)
  const [cwlRoster, setCwlRoster] = useState<CwlPlayer[]>(initialRoster);
  const [cwlRosterLoading, setCwlRosterLoading] = useState(false);
  const [cwlRosterSource, setCwlRosterSource] = useState<'cwl' | 'clan'>(
    initialData?.roster?.source ?? (initialRoster.length ? 'cwl' : 'clan'),
  );
  const [ghostCount, setGhostCount] = useState(initialData?.roster?.ghostCount ?? 0);

  // Opponent state
  const [opponents, setOpponents] = useState<CwlDayOpponentRow[]>(initialData?.opponents ?? []);
  const initialOpponent = (initialData?.opponents ?? []).find((row) => row.dayIndex === dayIndex) ?? null;
  const [opponentRoster, setOpponentRoster] = useState<Array<{ name: string; tag: string; townHall: number | null; heroes?: Record<string, number | null>; isGhost?: boolean }>>(
    mapOpponentRosterSnapshot(initialOpponent?.rosterSnapshot),
  );
  const [opponentClanName, setOpponentClanName] = useState<string | null>(initialOpponent?.clanName ?? null);
  const [opponentGhostCount, setOpponentGhostCount] = useState(
    mapOpponentRosterSnapshot(initialOpponent?.rosterSnapshot).filter((m) => m.isGhost).length,
  );
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  // Lineup state
  const [ourLineup, setOurLineup] = useState<LineupSlot[]>([]);
  const [opponentLineup, setOpponentLineup] = useState<LineupSlot[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(() => {
    if (!initialData?.lineup?.updatedAt) return null;
    return new Date(initialData.lineup.updatedAt).toLocaleTimeString();
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [preplanCopyState, setPreplanCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [savedLineupTags, setSavedLineupTags] = useState<{
    ourLineup: string[];
    opponentLineup: string[];
  } | null>(() => {
    if (!initialData?.lineup) return null;
    return {
      ourLineup: Array.isArray(initialData.lineup.ourLineup) ? initialData.lineup.ourLineup : [],
      opponentLineup: Array.isArray(initialData.lineup.opponentLineup) ? initialData.lineup.opponentLineup : [],
    };
  });
  const lineupsInitialized = useRef<number | null>(null);
  const ourLineupHydrated = useRef(false);
  const opponentLineupHydrated = useRef(false);
  const rosterFetched = useRef(false);

  // War results state
  interface AttackResult {
    attackerTag: string;
    attackerName: string | null;
    attackerTh: number | null;
    defenderTag: string;
    defenderName: string | null;
    defenderTh: number | null;
    defenderMapPosition: number | null;
    stars: number;
    destructionPct: number | null;
    attackOrder: number;
    isOurAttack: boolean;
  }
  const [dayResult, setDayResult] = useState<CwlDayResult | null>(initialData?.dayResult ?? null);
  const [attacks, setAttacks] = useState<AttackResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const opponent = useMemo(() => {
    return (
      opponents.find((o) => o.dayIndex === dayIndex) ?? {
        dayIndex,
        clanTag: '',
        clanName: '',
        thDistribution: null,
        rosterSnapshot: null,
        fetchedAt: null,
        status: 'unknown',
      }
    );
  }, [opponents, dayIndex]);

  // Generate day links for navigation
  const dayLinks = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const opp = opponents.find((o) => o.dayIndex === i + 1);
      return {
        dayNumber: i + 1,
        label: opp?.clanName || null,
      };
    });
  }, [opponents]);

  // Fetch CWL roster (SSOT) with ghost detection
  const fetchCwlRoster = useCallback(async () => {
    if (!homeClanTag) return;

    setCwlRosterLoading(true);
    try {
      const params = new URLSearchParams({
        seasonId,
        warSize: String(warSize),
      });
      if (homeClanTag) params.set('clanTag', homeClanTag);
      const res = await fetch(`/api/cwl/eligible?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load CWL roster');

      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        const currentRosterTags = rosterMembers.length
          ? new Set(
              rosterMembers
                .map((m) => normalizeTag(m.tag || ''))
                .filter((tag) => tag.length > 0),
            )
          : null;
        const existingGhosts = new Map(cwlRoster.map((m) => [m.tag, m.isGhost]));
        let nextGhostCount = 0;
        const roster = body.data
          .map((row: any) => {
            const tag = normalizeTag(row.player_tag || '');
            if (!tag) return null;
            const isGhost = currentRosterTags
              ? !currentRosterTags.has(tag)
              : existingGhosts.get(tag) ?? false;
            if (isGhost) nextGhostCount += 1;
            return {
              tag,
              name: row.player_name || row.player_tag,
              townHall: row.town_hall ?? null,
              heroPower: resolveHeroPower({ hero_levels: row.hero_levels }),
              heroes: row.hero_levels ?? null,
              isGhost,
              mapPosition: null,
            };
          })
          .filter(Boolean) as CwlPlayer[];

        if (roster.length > 0) {
          setCwlRoster(roster);
          setCwlRosterSource('cwl');
          setGhostCount(nextGhostCount);
        } else {
          setCwlRoster([]);
          setCwlRosterSource('clan');
          setGhostCount(0);
        }
      }
    } catch (err) {
      console.warn('[CWL Day Planner] Failed to load CWL roster:', err);
      // Fall back to regular roster
      setCwlRosterSource('clan');
    } finally {
      setCwlRosterLoading(false);
    }
  }, [homeClanTag, seasonId, warSize, rosterMembers, cwlRoster]);

  useEffect(() => {
    if (cwlRoster.length > 0 || rosterFetched.current) return;
    rosterFetched.current = true;
    fetchCwlRoster();
  }, [fetchCwlRoster, cwlRoster.length]);

  // Fetch war results for this day
  const fetchDayResults = useCallback(async (forceFetch = false) => {
    if (!homeClanTag) return;
    
    setResultsLoading(true);
    try {
      // First try to get existing results
      const resultParams = new URLSearchParams({
        clanTag: homeClanTag,
        seasonId,
        dayIndex: String(dayIndex),
      });
      const resultRes = await fetch(`/api/cwl/result?${resultParams.toString()}`);
      const resultBody = await resultRes.json();
      
      if (resultBody.success && resultBody.data) {
        const data = resultBody.data;
        const normalizedState = normalizeWarState(data.war_state);
        setDayResult({
          result: data.result,
          ourStars: data.our_stars ?? 0,
          opponentStars: data.opponent_stars ?? 0,
          ourDestructionPct: data.our_destruction_pct ?? 0,
          opponentDestructionPct: data.opponent_destruction_pct ?? 0,
          warState: normalizedState,
          opponentName: data.opponent_name,
        });
      }
      
      // If forcing fetch or no results yet, try to fetch from CoC API
      const shouldFetch = forceFetch || !isWarEnded(resultBody.data?.war_state);
      if (shouldFetch) {
        const fetchParams = new URLSearchParams({
          clanTag: homeClanTag,
          seasonId,
          dayIndex: String(dayIndex),
          force: forceFetch ? 'true' : 'false',
        });
        const fetchRes = await fetch(`/api/cwl/fetch-results?${fetchParams.toString()}`);
        const fetchBody = await fetchRes.json();
        
        if (fetchBody.success && fetchBody.data?.results) {
          const dayData = fetchBody.data.results.find((r: any) => r.dayIndex === dayIndex);
          if (dayData?.status === 'fetched' && dayData.data) {
            setDayResult({
              result: dayData.data.result,
              ourStars: dayData.data.ourStars ?? 0,
              opponentStars: dayData.data.opponentStars ?? 0,
              ourDestructionPct: dayData.data.ourDestruction ?? 0,
              opponentDestructionPct: dayData.data.opponentDestruction ?? 0,
              warState: 'warEnded',
              opponentName: dayData.data.opponent,
            });
          }
        }
      }
      
      // Fetch attack details from cwl_attack_results
      const attackParams = new URLSearchParams({
        clanTag: homeClanTag,
        seasonId,
        dayIndex: String(dayIndex),
      });
      const attackRes = await fetch(`/api/cwl/attacks?${attackParams.toString()}`);
      const attackBody = await attackRes.json();
      
      if (attackBody.success && attackBody.data?.attacks) {
        setAttacks(attackBody.data.attacks);
      }
      
    } catch (err) {
      console.warn('[CWL Day Planner] Failed to fetch results:', err);
    } finally {
      setResultsLoading(false);
    }
  }, [homeClanTag, seasonId, dayIndex]);

  // Load results on mount
  useEffect(() => {
    if (isWarEnded(dayResult?.warState)) return;
    fetchDayResults();
  }, [fetchDayResults, dayResult?.warState]);

  // Use CWL roster if available, otherwise fall back to current clan roster
  const availablePlayers: LineupPlayer[] = useMemo(() => {
    // Prefer CWL roster when available
    if (cwlRoster.length > 0) {
      return cwlRoster;
    }
    
    // Fall back to current roster
    if (rosterLoading && (!rosterMembers || rosterMembers.length === 0)) {
      return [];
    }
    return (rosterMembers || []).map((m) => ({
      tag: normalizeTag(m.tag || ''),
      name: m.name || m.tag,
      townHall: m.townHallLevel ?? (m as any).th ?? null,
      heroPower: m.heroPower ?? null,
      heroes: {
        bk: m.bk ?? null,
        aq: m.aq ?? null,
        gw: m.gw ?? null,
        rc: m.rc ?? null,
        mp: m.mp ?? null,
      },
    }));
  }, [cwlRoster, rosterMembers, rosterLoading]);

  // Convert opponent roster to LineupPlayer format
  const availableOpponents: LineupPlayer[] = useMemo(() => {
    return opponentRoster.map((m) => ({
      tag: normalizeTag(m.tag || ''),
      name: m.name || m.tag,
      townHall: m.townHall,
      heroPower: resolveHeroPower({ heroLevels: m.heroes }),
      heroes: m.heroes as any,
      isGhost: m.isGhost ?? false,
    }));
  }, [opponentRoster]);

  const hydrateOurLineupFromTags = useCallback(
    (ourTags: string[]) => {
      setOurLineup(
        Array.from({ length: warSize }, (_, i) => {
          const tag = normalizeTag(ourTags[i] || '');
          const player = tag ? availablePlayers.find((p) => p.tag === tag) || null : null;
          return { position: i + 1, player };
        })
      );
    },
    [availablePlayers, warSize],
  );

  const hydrateOpponentLineupFromTags = useCallback(
    (oppTags: string[]) => {
      setOpponentLineup(
        Array.from({ length: warSize }, (_, i) => {
          const tag = normalizeTag(oppTags[i] || '');
          const player = tag ? availableOpponents.find((p) => p.tag === tag) || null : null;
          return { position: i + 1, player };
        })
      );
    },
    [availableOpponents, warSize],
  );

  // Initialize empty lineups when warSize changes
  useEffect(() => {
    if (lineupsInitialized.current === warSize) return;
    setOurLineup(
      Array.from({ length: warSize }, (_, i) => ({
        position: i + 1,
        player: null,
      }))
    );
    setOpponentLineup(
      Array.from({ length: warSize }, (_, i) => ({
        position: i + 1,
        player: null,
      }))
    );
    lineupsInitialized.current = warSize;
  }, [warSize]);

  // Load opponents from API
  useEffect(() => {
    const loadOpponents = async () => {
      try {
        const params = new URLSearchParams({
          seasonId,
          warSize: String(warSize),
        });
        if (homeClanTag) params.set('clanTag', homeClanTag);
        const res = await fetch(`/api/cwl/opponents?${params.toString()}`);
        if (res.ok) {
          const body = await res.json();
          if (body?.data) {
            // Map snake_case API response to camelCase expected by the component
            const mapped: CwlDayOpponent[] = body.data.map((row: any) => ({
              dayIndex: row.day_index,
              clanTag: row.opponent_tag || '',
              clanName: row.opponent_name || '',
              thDistribution: row.th_distribution || null,
              rosterSnapshot: row.roster_snapshot || null,
              fetchedAt: row.fetched_at || null,
              status: row.roster_snapshot ? 'roster_loaded' : 'not_loaded',
            }));
            setOpponents(mapped);
          }
        }
      } catch {
        // ignore
      }
    };
    if (!initialData?.opponents?.length) {
      loadOpponents();
    }
  }, [seasonId, warSize, homeClanTag, initialData?.opponents?.length]);

  // Hydrate opponent roster from stored snapshot when available
  useEffect(() => {
    if (opponentRoster.length > 0) return;
    if (!opponents.length) return;
    const row = opponents.find((o) => o.dayIndex === dayIndex);
    if (!row?.rosterSnapshot) return;
    const roster = mapOpponentRosterSnapshot(row.rosterSnapshot);
    if (roster.length === 0) return;
    setOpponentRoster(roster);
    setOpponentClanName(row.clanName || opponentClanName);
    setOpponentGhostCount(roster.filter((m) => m.isGhost).length);
  }, [opponentRoster.length, opponents, dayIndex, opponentClanName]);

  // Hydrate saved lineup tags once rosters are available
  useEffect(() => {
    if (ourLineupHydrated.current) return;
    if (!savedLineupTags?.ourLineup?.length) return;
    if (availablePlayers.length === 0) return;
    hydrateOurLineupFromTags(savedLineupTags.ourLineup);
    ourLineupHydrated.current = true;
  }, [availablePlayers.length, hydrateOurLineupFromTags, savedLineupTags]);

  useEffect(() => {
    if (opponentLineupHydrated.current) return;
    if (!savedLineupTags?.opponentLineup?.length) return;
    if (availableOpponents.length === 0) return;
    hydrateOpponentLineupFromTags(savedLineupTags.opponentLineup);
    opponentLineupHydrated.current = true;
  }, [availableOpponents.length, hydrateOpponentLineupFromTags, savedLineupTags]);

  // Load saved lineup from API (fallback)
  useEffect(() => {
    if (savedLineupTags) return;
    const loadLineup = async () => {
      try {
        const params = new URLSearchParams({
          seasonId,
          warSize: String(warSize),
          dayIndex: String(dayIndex),
        });
        const res = await fetch(`/api/cwl/lineup?${params.toString()}`);
        if (res.ok) {
          const body = await res.json();
          const row = body?.data?.[0];
          if (row) {
            const ourTags = Array.isArray(row.our_lineup) ? row.our_lineup : [];
            const oppTags = Array.isArray(row.opponent_lineup) ? row.opponent_lineup : [];
            setSavedLineupTags({ ourLineup: ourTags, opponentLineup: oppTags });
            if (row.updated_at) {
              setLastSaved(new Date(row.updated_at).toLocaleTimeString());
            }
          }
        }
      } catch {
        // ignore
      }
    };
    loadLineup();
  }, [
    dayIndex,
    savedLineupTags,
    seasonId,
    warSize,
  ]);

  // Fetch opponent roster
  const fetchOpponentRoster = useCallback(async (options?: { force?: boolean; persist?: boolean }) => {
    const { force = false, persist = true } = options ?? {};
    const tag = opponent?.clanTag && isValidTag(opponent.clanTag) ? normalizeTag(opponent.clanTag) : null;
    if (!tag) {
      setOppError('Set a valid opponent tag in CWL Setup first.');
      return;
    }
    setOppLoading(true);
    setOppError(null);
    try {
      const params = new URLSearchParams({ opponentTag: tag, enrich: '50', rosterSource: 'cwl' });
      if (homeClanTag) params.set('ourClanTag', homeClanTag);
      params.set('dayIndex', String(dayIndex));
      if (force) params.set('refresh', 'true');
      if (persist) {
        params.set('persist', 'true');
        params.set('seasonId', seasonId);
        params.set('warSize', String(warSize));
      }
      const res = await fetch(`/api/war/opponent?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load opponent');
      const body = await res.json();
      const data = body?.data || {};
      const roster = mapOpponentRosterSnapshot(data.roster || []);
      setOpponentRoster(roster);
      setOpponentClanName(data.clan?.name || opponent.clanName || null);
      setOpponentGhostCount(data.ghostCount ?? roster.filter((m: any) => m.isGhost).length);
    } catch (err: any) {
      setOppError(err?.message || 'Failed to load opponent');
    } finally {
      setOppLoading(false);
    }
  }, [opponent, homeClanTag, dayIndex, seasonId, warSize]);

  // Auto-load opponent on mount
  useEffect(() => {
    if (
      opponent?.clanTag &&
      isValidTag(opponent.clanTag) &&
      opponentRoster.length === 0 &&
      !opponent.rosterSnapshot
    ) {
      fetchOpponentRoster();
    }
  }, [fetchOpponentRoster, opponent?.clanTag, opponent?.rosterSnapshot, opponentRoster.length]);

  // Save lineup
  const saveLineup = async () => {
    const ourTags = ourLineup.map((s) => s.player?.tag || null).filter(Boolean);
    const oppTags = opponentLineup.map((s) => s.player?.tag || null).filter(Boolean);
    
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
          ourLineup: ourTags,
          opponentLineup: oppTags,
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

  const loadAttendanceContext = useCallback(async () => {
    const priorDays = Array.from({ length: Math.max(dayIndex - 1, 0) }, (_, i) => i + 1);

    const loadAttendance = async (targetDayIndex: number, refresh = false) => {
      if (!homeClanTag) return null;
      const clanTag = normalizeTag(homeClanTag);
      if (!clanTag || !isValidTag(clanTag)) return null;
      const params = new URLSearchParams({
        clanTag,
        seasonId,
        dayIndex: String(targetDayIndex),
      });
      if (refresh) params.set('refresh', 'true');
      const res = await fetch(`/api/cwl/attendance?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        return { error: body?.error || 'Failed to load attendance' } as const;
      }
      return body?.data || null;
    };

    const mapAttendance = (data: any): AttendanceSummary => ({
      hasData: Array.isArray(data?.daysWithData) && data.daysWithData.length > 0,
      clanTag: data?.clanTag,
      seasonId: data?.seasonId,
      targetDayIndex: data?.targetDayIndex,
      error: null,
      days: Array.isArray(data?.priorDays) ? data.priorDays : [],
      daysWithData: Array.isArray(data?.daysWithData) ? data.daysWithData : [],
      missingDays: Array.isArray(data?.missingDays) ? data.missingDays : [],
      updatedAt: data?.updatedAt ?? null,
      noShows: Array.isArray(data?.noShows) ? data.noShows : [],
      missedAttacks: Array.isArray(data?.missedAttacks) ? data.missedAttacks : [],
      players: Array.isArray(data?.players) ? data.players : [],
    });

    let priorAttendance: AttendanceSummary | null = priorDays.length
      ? {
          hasData: false,
          clanTag: normalizeTag(homeClanTag || ''),
          seasonId,
          targetDayIndex: dayIndex,
          error: null,
          days: priorDays,
          daysWithData: [],
          missingDays: priorDays,
          updatedAt: null,
          noShows: [],
          missedAttacks: [],
          players: [],
        }
      : null;
    let priorSyncAttempted = false;

    const backfillPriorDays = async (days: number[], force = false) => {
      if (!days.length || !homeClanTag) return;
      const clanTag = normalizeTag(homeClanTag);
      if (!clanTag || !isValidTag(clanTag)) return;
      priorSyncAttempted = true;
      const uniqueDays = Array.from(new Set(days)).filter((d) => d >= 1 && d <= 7);
      for (const day of uniqueDays) {
        const params = new URLSearchParams({
          clanTag,
          seasonId,
          dayIndex: String(day),
        });
        if (force) params.set('force', 'true');
        const res = await fetch(`/api/cwl/fetch-results?${params.toString()}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          if (priorAttendance) priorAttendance.error = body?.error || 'Failed to sync CWL results';
          continue;
        }
        const errors = Array.isArray(body?.data?.results)
          ? body.data.results.filter((r: any) => r?.status === 'error').map((r: any) => r?.message).filter(Boolean)
          : [];
        if (errors.length && priorAttendance) {
          priorAttendance.error = errors.join('; ');
        }
      }
    };

    if (priorAttendance && homeClanTag) {
      const data = await loadAttendance(dayIndex, false);
      if (data && !(data as any).error) {
        priorAttendance = mapAttendance(data);
        if (priorAttendance.missingDays.length) {
          await backfillPriorDays(priorAttendance.missingDays, true);
          const refreshed = await loadAttendance(dayIndex, true);
          if (refreshed && !(refreshed as any).error) {
            priorAttendance = mapAttendance(refreshed);
          }
        }
      } else if (priorAttendance) {
        priorAttendance.error = (data as any)?.error || 'Failed to load attendance';
      }
    }

    let nextDaySignals: AttendanceSummary | null = null;
    if (dayIndex < 7 && homeClanTag) {
      const data = await loadAttendance(dayIndex + 1, false);
      if (data && !(data as any).error) {
        nextDaySignals = mapAttendance(data);
      }
    }

    return { priorAttendance, nextDaySignals, priorSyncAttempted };
  }, [dayIndex, homeClanTag, seasonId]);

  // Copy for AI - includes ghost detection and preamble
  const handleCopy = async () => {
    try {
      setCopyState('copying');
      // Identify ghosts on both sides
      const ourGhosts = availablePlayers.filter(p => p.isGhost);
      const theirGhosts = availableOpponents.filter(p => p.isGhost);
      const { priorAttendance, nextDaySignals, priorSyncAttempted } = await loadAttendanceContext();
      
      // Build preamble with context
      const preambleLines = [
        `# CWL Day ${dayIndex} War Planning Data`,
        ``,
        `## Context`,
        `- War size: ${warSize}v${warSize}`,
        `- Our clan roster: ${availablePlayers.length} players`,
        `- Opponent: ${opponentClanName || 'Unknown'} (${availableOpponents.length} players)`,
        ``,
      ];
      
      // Add ghost warnings prominently
      if (ourGhosts.length > 0 || theirGhosts.length > 0) {
        preambleLines.push(`## ⚠️ IMPORTANT: Ghost Players`);
        preambleLines.push(`Ghost players are registered in CWL but have LEFT their clan - they CANNOT attack.`);
        preambleLines.push(``);
        
        if (ourGhosts.length > 0) {
          preambleLines.push(`### OUR Ghosts (${ourGhosts.length}) - Cannot attack:`);
          ourGhosts.forEach(g => {
            preambleLines.push(`- ${g.name} (TH${g.townHall || '?'})`);
          });
          preambleLines.push(``);
        }
        
        if (theirGhosts.length > 0) {
          preambleLines.push(`### OPPONENT Ghosts (${theirGhosts.length}) - Free stars for us:`);
          theirGhosts.forEach(g => {
            preambleLines.push(`- ${g.name} (TH${g.townHall || '?'})`);
          });
          preambleLines.push(``);
        }
        
        preambleLines.push(`## Planning Implications`);
        if (ourGhosts.length > 0) {
          preambleLines.push(`- We have ${ourGhosts.length} ghost(s) who CANNOT attack - plan around this shortage`);
        }
        if (theirGhosts.length > 0) {
          preambleLines.push(`- Opponent has ${theirGhosts.length} ghost(s) - these are FREE 3-star targets`);
          preambleLines.push(`- Assign weaker attackers to ghost bases to save strong attacks for real threats`);
        }
        preambleLines.push(``);
      }

      if (priorAttendance) {
        const dayRange = priorAttendance.days.length === 1
          ? `Day ${priorAttendance.days[0]}`
          : priorAttendance.days.length > 1
            ? `Days ${priorAttendance.days[0]}-${priorAttendance.days[priorAttendance.days.length - 1]}`
            : 'Prior Days';
        preambleLines.push(`## ⏱ Prior Day Attendance (${dayRange})`);
        if (priorAttendance.error) {
          preambleLines.push(`- Could not load prior-day attendance (${priorAttendance.error}).`);
        } else if (!priorAttendance.hasData) {
          const seasonLabel = priorAttendance.seasonId ? ` for season ${priorAttendance.seasonId}` : '';
          const clanLabel = priorAttendance.clanTag ? ` (clan ${priorAttendance.clanTag})` : '';
          preambleLines.push(`- No stored attack data found for prior days${seasonLabel}${clanLabel}.`);
          preambleLines.push(priorSyncAttempted
            ? `- An automatic sync was attempted but no prior-day attacks were returned.`
            : `- Prior-day results have not been synced yet.`);
        } else {
          preambleLines.push(`- Based on stored CWL results only.`);
          if (priorAttendance.missingDays.length) {
            preambleLines.push(`- Missing data for day(s): ${priorAttendance.missingDays.join(', ')}`);
          }
          if (priorAttendance.noShows.length) {
            preambleLines.push(`### No-shows (0 attacks in prior days):`);
            priorAttendance.noShows.forEach((row) => {
              const days = row.missedByDay.map((d) => `D${d.day} ${d.missed}/${d.slots}`).join(', ');
              const displayName = row.name || row.tag;
              preambleLines.push(`- ${displayName} (${row.tag}) missed ${row.missedAttacks}/${row.attacksAvailable} attacks${days ? ` — ${days}` : ''}`);
            });
          } else {
            preambleLines.push(`- No complete no-shows recorded in prior days.`);
          }
          if (priorAttendance.missedAttacks.length) {
            preambleLines.push(`### Missed attacks (some slots unused):`);
            priorAttendance.missedAttacks.forEach((row) => {
              const days = row.missedByDay.map((d) => `D${d.day} ${d.missed}/${d.slots}`).join(', ');
              const displayName = row.name || row.tag;
              preambleLines.push(`- ${displayName} (${row.tag}) missed ${row.missedAttacks}/${row.attacksAvailable} attacks${days ? ` — ${days}` : ''}`);
            });
          } else {
            preambleLines.push(`- No missed attacks recorded in prior days.`);
          }
        }
        preambleLines.push(``);
      }

      if (nextDaySignals) {
        const targetDay = nextDaySignals.targetDayIndex ?? dayIndex + 1;
        const priorDayRange = nextDaySignals.days.length === 1
          ? `Day ${nextDaySignals.days[0]}`
          : nextDaySignals.days.length > 1
            ? `Days ${nextDaySignals.days[0]}-${nextDaySignals.days[nextDaySignals.days.length - 1]}`
            : 'Prior Days';
        preambleLines.push(`## 🔮 Forward Lineup Signals (Day ${targetDay})`);
        if (nextDaySignals.error) {
          preambleLines.push(`- Could not load forward signals (${nextDaySignals.error}).`);
        } else if (!nextDaySignals.hasData) {
          preambleLines.push(`- No stored attendance yet to inform Day ${targetDay}.`);
        } else {
          preambleLines.push(`- Based on stored attendance through ${priorDayRange}.`);
          if (nextDaySignals.missingDays.length) {
            preambleLines.push(`- Missing data for day(s): ${nextDaySignals.missingDays.join(', ')}`);
          }
          const reliable = nextDaySignals.players.filter((p) => p.status === 'reliable');
          const risk = nextDaySignals.players.filter((p) => p.status === 'risk');
          const noShow = nextDaySignals.players.filter((p) => p.status === 'no_show');
          if (noShow.length) {
            preambleLines.push(`### No-shows so far (bench unless needed):`);
            noShow.forEach((row) => {
              const displayName = row.name || row.tag;
              preambleLines.push(`- ${displayName} (${row.tag})`);
            });
          }
          if (risk.length) {
            preambleLines.push(`### Risk list (missed attacks earlier):`);
            risk.forEach((row) => {
              const displayName = row.name || row.tag;
              preambleLines.push(`- ${displayName} (${row.tag})`);
            });
          }
          if (reliable.length) {
            preambleLines.push(`### Reliable (attacked every prior day):`);
            reliable.forEach((row) => {
              const displayName = row.name || row.tag;
              preambleLines.push(`- ${displayName} (${row.tag})`);
            });
          }
        }
        preambleLines.push(``);
      }
      
      // Add war results if available
      if (isWarEnded(dayResult?.warState)) {
        preambleLines.push(`## 📊 WAR RESULTS (Completed)`);
        preambleLines.push(`- **Result:** ${dayResult.result === 'W' ? '🏆 WIN' : dayResult.result === 'L' ? '💀 LOSS' : '🤝 TIE'}`);
        preambleLines.push(`- **Stars:** ${dayResult.ourStars} vs ${dayResult.opponentStars}`);
        preambleLines.push(`- **Destruction:** ${dayResult.ourDestructionPct.toFixed(1)}% vs ${dayResult.opponentDestructionPct.toFixed(1)}%`);
        preambleLines.push(`- **Opponent:** ${dayResult.opponentName || 'Unknown'}`);
        preambleLines.push(``);
        preambleLines.push(`Use this result to inform future day planning and attack assignments.`);
        preambleLines.push(``);
      } else if (dayResult?.warState) {
        preambleLines.push(`## ⚔️ WAR STATUS`);
        preambleLines.push(`- **Status:** ${normalizeWarState(dayResult.warState) === 'inWar' ? 'In Progress' : 'Preparation'}`);
        preambleLines.push(`- **Opponent:** ${dayResult.opponentName || 'Unknown'}`);
        preambleLines.push(``);
      }
      
      preambleLines.push(`---`);
      preambleLines.push(``);
      
      const preamble = preambleLines.join('\n');
      
      // Build structured data
      const payload = {
        meta: {
          day: dayIndex,
          warSize,
          ourGhostCount: ourGhosts.length,
          opponentGhostCount: theirGhosts.length,
          warCompleted: isWarEnded(dayResult?.warState),
          warResult: isWarEnded(dayResult?.warState) ? {
            result: dayResult.result,
            ourStars: dayResult.ourStars,
            opponentStars: dayResult.opponentStars,
            ourDestructionPct: dayResult.ourDestructionPct,
            opponentDestructionPct: dayResult.opponentDestructionPct,
          } : null,
        },
        ourRoster: availablePlayers.map((p) => ({
          name: p.name,
          tag: p.tag,
          th: p.townHall,
          heroPower: p.heroPower,
          isGhost: p.isGhost || false,
          canAttack: !p.isGhost,
        })),
        ourLineup: ourLineup.map((s, i) => ({
          position: i + 1,
          player: s.player ? { 
            name: s.player.name, 
            tag: s.player.tag, 
            th: s.player.townHall,
            isGhost: s.isGhost || s.player.isGhost || false,
            canAttack: !(s.isGhost || s.player.isGhost),
          } : null,
        })),
        opponent: {
          name: opponentClanName,
          tag: opponent?.clanTag,
          ghostCount: theirGhosts.length,
          roster: availableOpponents.map((p) => ({
            name: p.name,
            tag: p.tag,
            th: p.townHall,
            heroPower: p.heroPower,
            isGhost: p.isGhost || false,
            canDefend: true, // Base still defends even if player left
            canAttack: !p.isGhost, // But they can't attack
          })),
        },
        opponentLineup: opponentLineup.map((s, i) => ({
          position: i + 1,
          player: s.player ? { 
            name: s.player.name, 
            tag: s.player.tag, 
            th: s.player.townHall,
            isGhost: s.player.isGhost || false,
            freeStars: s.player.isGhost || false, // Ghost = free 3 stars
          } : null,
        })),
        priorDayAttendance: priorAttendance,
        forwardLineupSignals: nextDaySignals,
      };
      
      // Combine preamble + JSON data
      const fullExport = preamble + '## Raw Data (JSON)\n```json\n' + JSON.stringify(payload, null, 2) + '\n```';
      
      await navigator.clipboard.writeText(fullExport);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  const handlePreplanCopy = async () => {
    try {
      setPreplanCopyState('copying');
      const { priorAttendance, nextDaySignals, priorSyncAttempted } = await loadAttendanceContext();

      const lines = [
        `# CWL Day ${dayIndex} Pre-Planning (Lineup Recommendation)`,
        ``,
        `## Goal`,
        `- Recommend a lineup of ${warSize} players for Day ${dayIndex}.`,
        `- Prioritize reliable attackers; avoid no-shows unless necessary.`,
        `- Keep TH balance and coverage across the map.`,
        `- Call out any risks or missing data.`,
        ``,
        `## Context`,
        `- War size: ${warSize}v${warSize}`,
        `- Eligible roster count: ${availablePlayers.length}`,
        `- Opponent: ${opponentClanName || 'Unknown'} (${availableOpponents.length} players)`,
        ``,
      ];

      if (priorAttendance) {
        const dayRange = priorAttendance.days.length === 1
          ? `Day ${priorAttendance.days[0]}`
          : priorAttendance.days.length > 1
            ? `Days ${priorAttendance.days[0]}-${priorAttendance.days[priorAttendance.days.length - 1]}`
            : 'Prior Days';
        lines.push(`## Attendance Signals (${dayRange})`);
        if (priorAttendance.error) {
          lines.push(`- Could not load prior-day attendance (${priorAttendance.error}).`);
        } else if (!priorAttendance.hasData) {
          lines.push(`- No stored attack data found for prior days.`);
          lines.push(priorSyncAttempted
            ? `- An automatic sync was attempted but no prior-day attacks were returned.`
            : `- Prior-day results have not been synced yet.`);
        } else {
          if (priorAttendance.noShows.length) {
            lines.push(`### No-shows so far (bench unless needed):`);
            priorAttendance.noShows.forEach((row) => {
              const displayName = row.name || row.tag;
              lines.push(`- ${displayName} (${row.tag})`);
            });
          }
          if (priorAttendance.missedAttacks.length) {
            lines.push(`### Risk list (missed attacks earlier):`);
            priorAttendance.missedAttacks.forEach((row) => {
              const displayName = row.name || row.tag;
              lines.push(`- ${displayName} (${row.tag})`);
            });
          }
          const reliable = priorAttendance.players.filter((p) => p.status === 'reliable');
          if (reliable.length) {
            lines.push(`### Reliable (attacked every prior day):`);
            reliable.forEach((row) => {
              const displayName = row.name || row.tag;
              lines.push(`- ${displayName} (${row.tag})`);
            });
          }
        }
        lines.push(``);
      }

      const preplanPayload = {
        meta: {
          day: dayIndex,
          warSize,
          rosterCount: availablePlayers.length,
        },
        currentLineup: ourLineup.map((slot) => ({
          position: slot.position,
          tag: slot.player?.tag || null,
          name: slot.player?.name || null,
          th: slot.player?.townHall ?? null,
        })),
        ourRoster: availablePlayers.map((p) => ({
          name: p.name,
          tag: p.tag,
          th: p.townHall,
          heroPower: p.heroPower,
          isGhost: p.isGhost || false,
        })),
        opponentSummary: {
          name: opponentClanName,
          tag: opponent?.clanTag,
          rosterCount: availableOpponents.length,
          thDistribution: opponentThDistribution,
        },
        priorDayAttendance: priorAttendance,
        forwardLineupSignals: nextDaySignals,
      };

      lines.push(`---`);
      lines.push(``);
      lines.push(`## Data (JSON)`);
      lines.push('```json');
      lines.push(JSON.stringify(preplanPayload, null, 2));
      lines.push('```');

      await navigator.clipboard.writeText(lines.join('\n'));
      setPreplanCopyState('copied');
      setTimeout(() => setPreplanCopyState('idle'), 1500);
    } catch {
      setPreplanCopyState('error');
      setTimeout(() => setPreplanCopyState('idle'), 2000);
    }
  };

  // Auto-fill our lineup with top players
  const autoFillOurLineup = () => {
    const sorted = [...availablePlayers].sort((a, b) => {
      const thDiff = (b.townHall ?? 0) - (a.townHall ?? 0);
      if (thDiff !== 0) return thDiff;
      return (b.heroPower ?? 0) - (a.heroPower ?? 0);
    });
    const newLineup: LineupSlot[] = Array.from({ length: warSize }, (_, i) => ({
      position: i + 1,
      player: sorted[i] || null,
    }));
    setOurLineup(newLineup);
  };

  // Auto-fill opponent lineup with top players
  const autoFillOpponentLineup = () => {
    const sorted = [...availableOpponents].sort((a, b) => {
      const thDiff = (b.townHall ?? 0) - (a.townHall ?? 0);
      if (thDiff !== 0) return thDiff;
      return (b.heroPower ?? 0) - (a.heroPower ?? 0);
    });
    const newLineup: LineupSlot[] = Array.from({ length: warSize }, (_, i) => ({
      position: i + 1,
      player: sorted[i] || null,
    }));
    setOpponentLineup(newLineup);
  };

  const clearOurLineup = () => {
    setOurLineup(
      Array.from({ length: warSize }, (_, i) => ({
        position: i + 1,
        player: null,
      }))
    );
  };

  const clearOpponentLineup = () => {
    setOpponentLineup(
      Array.from({ length: warSize }, (_, i) => ({
        position: i + 1,
        player: null,
      }))
    );
  };

  const rosterThDistribution = useMemo(() => buildThDistribution(availablePlayers), [availablePlayers]);
  const opponentThDistribution = useMemo(() => buildThDistribution(opponentRoster), [opponentRoster]);

  const filledOurCount = ourLineup.filter((s) => s.player !== null).length;
  const filledOppCount = opponentLineup.filter((s) => s.player !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            CWL Day {dayIndex} – {opponentClanName || opponent.clanName || 'TBD'}
          </h1>
          <p className="text-slate-300 text-sm">
            {warSize}v{warSize} lineup builder
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/new/war/cwl">
            <Button tone="ghost">Back to CWL Overview</Button>
          </Link>
        </div>
      </div>

      <CwlStepBar current="day" dayIndex={dayIndex} />

      {/* Day Navigation */}
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
                    {link.label && (
                      <span className={cn('text-[10px]', isActive ? 'text-slate-700' : 'text-slate-500')}>
                        {link.label}
                      </span>
                    )}
                  </span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* War Results Banner (shown if war is complete) */}
      {isWarEnded(dayResult?.warState) && (
        <div className={cn(
          "rounded-2xl border-2 p-4",
          dayResult.result === 'W' 
            ? "border-green-500/50 bg-green-950/30" 
            : dayResult.result === 'L'
              ? "border-red-500/50 bg-red-950/30"
              : "border-yellow-500/50 bg-yellow-950/30"
        )}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "text-4xl font-bold",
                dayResult.result === 'W' ? "text-green-400" : dayResult.result === 'L' ? "text-red-400" : "text-yellow-400"
              )}>
                {dayResult.result === 'W' ? '🏆 WIN' : dayResult.result === 'L' ? '💀 LOSS' : '🤝 TIE'}
              </div>
              <div className="text-sm">
                <div className="text-slate-300">vs <span className="font-semibold text-white">{dayResult.opponentName || 'Opponent'}</span></div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-white font-bold">{dayResult.ourStars}⭐</span>
                  <span className="text-slate-500">vs</span>
                  <span className="text-slate-300">{dayResult.opponentStars}⭐</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{dayResult.ourDestructionPct.toFixed(1)}%</span>
                  <span>vs</span>
                  <span>{dayResult.opponentDestructionPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <Button tone="ghost" onClick={() => fetchDayResults(true)} disabled={resultsLoading}>
              {resultsLoading ? 'Refreshing...' : 'Refresh Results'}
            </Button>
          </div>
        </div>
      )}

      {/* War In Progress or Pending Banner */}
      {dayResult && !isWarEnded(dayResult.warState) && dayResult.warState && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⚔️</div>
              <div>
                <div className="text-white font-semibold">
                  {normalizeWarState(dayResult.warState) === 'inWar' ? 'War In Progress' : 'War Preparation'}
                </div>
                <div className="text-sm text-slate-400">vs {dayResult.opponentName || 'Opponent'}</div>
              </div>
            </div>
            <Button tone="ghost" onClick={() => fetchDayResults(true)} disabled={resultsLoading}>
              {resultsLoading ? 'Checking...' : 'Check Status'}
            </Button>
          </div>
        </div>
      )}

      {/* No Results Yet */}
      {!dayResult && !resultsLoading && (
        <div className="rounded-2xl border border-dashed border-slate-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📋</div>
              <div>
                <div className="text-slate-300 font-medium">No war results yet</div>
                <div className="text-sm text-slate-500">War may not have started or data isn't available</div>
              </div>
            </div>
            <Button tone="ghost" onClick={() => fetchDayResults(true)} disabled={resultsLoading}>
              Fetch Results
            </Button>
          </div>
        </div>
      )}

      {/* Attack Breakdown (shown when war is complete and has attacks) */}
      {isWarEnded(dayResult?.warState) && attacks.length > 0 && (
        <Card title={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              ⚔️ Attack Breakdown
              <span className="text-xs text-slate-400 font-normal">
                ({attacks.filter(a => a.isOurAttack).length} attacks)
              </span>
            </span>
          </div>
        }>
          <div className="space-y-4">
            {/* Our Attacks Summary */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Our Attacks</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-wide border-b border-white/10">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Attacker</th>
                      <th className="text-center py-2 px-2">TH</th>
                      <th className="text-center py-2 px-2">→</th>
                      <th className="text-left py-2 px-2">Defender</th>
                      <th className="text-center py-2 px-2">TH</th>
                      <th className="text-center py-2 px-2">Stars</th>
                      <th className="text-center py-2 px-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attacks
                      .filter((a) => a.isOurAttack)
                      .sort((a, b) => (a.attackerMapPosition ?? 99) - (b.attackerMapPosition ?? 99) || a.attackOrder - b.attackOrder)
                      .map((attack, idx) => (
                        <tr 
                          key={`${attack.attackerTag}-${attack.attackOrder}`} 
                          className={cn(
                            "border-b border-white/5",
                            attack.stars === 3 && "bg-green-900/10",
                            attack.stars === 0 && "bg-red-900/10"
                          )}
                        >
                          <td className="py-2 px-2 text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-2 text-white">{attack.attackerName || attack.attackerTag}</td>
                          <td className="py-2 px-2 text-center text-slate-300">{attack.attackerTh || '?'}</td>
                          <td className="py-2 px-2 text-center text-slate-500">→</td>
                          <td className="py-2 px-2 text-slate-300">{attack.defenderName || attack.defenderTag}</td>
                          <td className="py-2 px-2 text-center text-slate-300">{attack.defenderTh || '?'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={cn(
                              "font-semibold",
                              attack.stars === 3 && "text-green-400",
                              attack.stars === 2 && "text-yellow-400",
                              attack.stars === 1 && "text-orange-400",
                              attack.stars === 0 && "text-red-400"
                            )}>
                              {'⭐'.repeat(attack.stars)}
                              {attack.stars === 0 && '💀'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center text-slate-400">
                            {attack.destructionPct?.toFixed(0) ?? '-'}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {attacks.filter(a => a.isOurAttack && a.stars === 3).length}
                </div>
                <div className="text-xs text-slate-400">3-Stars</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {attacks.filter(a => a.isOurAttack && a.stars === 2).length}
                </div>
                <div className="text-xs text-slate-400">2-Stars</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {attacks.filter(a => a.isOurAttack && (a.stars === 0 || a.stars === 1)).length}
                </div>
                <div className="text-xs text-slate-400">Fails</div>
              </div>
              <div className="text-center border-l border-white/10 pl-4">
                <div className="text-2xl font-bold text-clash-gold">
                  {(attacks.filter(a => a.isOurAttack).reduce((sum, a) => sum + a.stars, 0) / 
                    Math.max(1, attacks.filter(a => a.isOurAttack).length)).toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">Avg Stars</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Our Clan Summary */}
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">Our Roster</h3>
              {cwlRosterSource === 'cwl' && (
                <span className="rounded-full bg-clash-gold/20 px-2 py-0.5 text-[10px] font-medium text-clash-gold uppercase">
                  CWL War
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {ghostCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
                  <Ghost className="h-3 w-3" />
                  {ghostCount} ghost{ghostCount > 1 ? 's' : ''}
                </span>
              )}
              <span className="text-sm text-slate-400">{availablePlayers.length} players</span>
              <Button
                tone="ghost"
                className="text-xs"
                onClick={() => fetchCwlRoster()}
                disabled={cwlRosterLoading || rosterLoading}
              >
                {cwlRosterLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
          <ThDistributionBar distribution={rosterThDistribution} />
          {((cwlRoster.length === 0 && rosterLoading) || cwlRosterLoading) && (
            <div className="mt-2 text-xs text-slate-500">Loading roster...</div>
          )}
          {cwlRosterSource === 'cwl' && ghostCount > 0 && (
            <div className="mt-2 text-xs text-orange-300/80">
              👻 {ghostCount} player{ghostCount > 1 ? 's' : ''} left the clan but {ghostCount > 1 ? 'are' : 'is'} still in CWL (can't attack)
            </div>
          )}
          {cwlRosterSource === 'clan' && cwlRoster.length === 0 && !cwlRosterLoading && (
            <div className="mt-2 rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2">
              <div className="text-xs text-amber-400 font-medium">⚠️ No CWL roster saved yet</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Save your CWL roster in Setup to freeze the week. Until then, the planner uses the
                live clan roster and cannot flag ghosts reliably.
              </div>
            </div>
          )}
          {cwlRosterSource === 'cwl' && ghostCount === 0 && !cwlRosterLoading && (
            <div className="mt-2 text-xs text-green-400/80">
              ✓ CWL roster loaded - all members still in clan
            </div>
          )}
        </div>

        {/* Opponent Summary */}
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-white">{opponentClanName || 'Opponent'}</h3>
              <span className="text-xs text-slate-500">{opponent?.clanTag || 'No tag set'}</span>
            </div>
            <div className="flex items-center gap-2">
              {opponentGhostCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
                  <Ghost className="h-3 w-3" />
                  {opponentGhostCount} ghost{opponentGhostCount > 1 ? 's' : ''}
                </span>
              )}
              <Button tone="ghost" className="text-xs" onClick={() => fetchOpponentRoster({ force: true })} disabled={oppLoading}>
                {oppLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
          {opponentRoster.length > 0 ? (
            <>
              <ThDistributionBar distribution={opponentThDistribution} />
              {opponentGhostCount > 0 && (
                <div className="mt-2 text-xs text-orange-300/80">
                  👻 {opponentGhostCount} player{opponentGhostCount > 1 ? 's have' : ' has'} left their clan (can't attack)
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500">
              {oppError || 'No opponent roster loaded. Set tag in CWL Setup.'}
            </div>
          )}
        </div>
      </div>

      {/* Main Lineup Builder */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Our Lineup */}
        <Card 
          title={
            <div className="flex items-center justify-between w-full">
              <span>Our Lineup</span>
              <div className="flex gap-2">
                <Button tone="ghost" className="text-xs" onClick={autoFillOurLineup}>
                  Auto-fill top {warSize}
                </Button>
                <Button tone="ghost" className="text-xs" onClick={clearOurLineup}>
                  Clear
                </Button>
              </div>
            </div>
          }
        >
          <LineupBuilder
            warSize={warSize}
            availablePlayers={availablePlayers}
            lineup={ourLineup}
            onLineupChange={setOurLineup}
            label=""
          />
        </Card>

        {/* Opponent Lineup */}
        <Card 
          title={
            <div className="flex items-center justify-between w-full">
              <span>Opponent Lineup</span>
              <div className="flex gap-2">
                <Button tone="ghost" className="text-xs" onClick={autoFillOpponentLineup} disabled={availableOpponents.length === 0}>
                  Auto-fill top {warSize}
                </Button>
                <Button tone="ghost" className="text-xs" onClick={clearOpponentLineup}>
                  Clear
                </Button>
              </div>
            </div>
          }
        >
          {availableOpponents.length > 0 ? (
            <LineupBuilder
              warSize={warSize}
              availablePlayers={availableOpponents}
              lineup={opponentLineup}
              onLineupChange={setOpponentLineup}
              label=""
            />
          ) : (
            <div className="text-center py-8 text-slate-400">
              Load opponent roster to build their lineup
            </div>
          )}
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-300">
              <span className="text-slate-500">Our lineup:</span>{' '}
              <span className={filledOurCount === warSize ? 'text-green-400' : 'text-yellow-400'}>
                {filledOurCount}/{warSize}
              </span>
            </div>
            <div className="text-sm text-slate-300">
              <span className="text-slate-500">Opponent:</span>{' '}
              <span className={filledOppCount === warSize ? 'text-green-400' : 'text-yellow-400'}>
                {filledOppCount}/{warSize}
              </span>
            </div>
            {lastSaved && <span className="text-xs text-slate-500">Last saved: {lastSaved}</span>}
            {saveState === 'saved' && <span className="text-xs text-green-400">Saved ✓</span>}
            {saveState === 'error' && <span className="text-xs text-red-400">{saveError || 'Save failed'}</span>}
            {copyState === 'error' && <span className="text-xs text-red-400">Copy failed</span>}
            {preplanCopyState === 'error' && <span className="text-xs text-red-400">Pre-planning copy failed</span>}
          </div>
          <div className="flex gap-2">
            <Button
              tone="ghost"
              onClick={handlePreplanCopy}
              disabled={copyState === 'copying' || preplanCopyState === 'copying'}
            >
              {preplanCopyState === 'copying'
                ? 'Copying...'
                : preplanCopyState === 'copied'
                  ? 'Copied!'
                  : preplanCopyState === 'error'
                    ? 'Copy failed'
                    : 'Copy Pre-Planning'}
            </Button>
            <Button
              tone="ghost"
              onClick={handleCopy}
              disabled={copyState === 'copying' || preplanCopyState === 'copying'}
            >
              {copyState === 'copying'
                ? 'Copying...'
                : copyState === 'copied'
                  ? 'Copied!'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'Copy for AI'}
            </Button>
            <Button onClick={saveLineup} disabled={saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Lineup'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tips */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>💡 <strong className="text-slate-400">Tip:</strong> Click each slot to select a player from the dropdown. Players you've already selected won't appear in other slots.</p>
        <p>👻 <strong className="text-slate-400">Ghost players:</strong> Use "Manual entry" for players who left the clan but are still in CWL (they can't attack).</p>
      </div>
    </div>
  );
}
