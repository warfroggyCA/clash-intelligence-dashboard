"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, GlassCard } from '@/components/ui';
import { normalizeTag } from '@/lib/tags';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

type HeroLevels = Record<string, number | null>;

type RosterMember = {
  tag: string;
  name: string;
  thLevel: number | null;
  role: string | null;
  trophies: number | null;
  rankedTrophies: number | null;
  warStars: number | null;
  heroLevels: HeroLevels;
  activityScore: number | null;
  lastUpdated: string | null;
};

type MatchupMetrics = {
  size: number;
  averageTownHall: number;
  maxTownHall: number;
  averageWarStars: number;
  averageRankedTrophies: number;
  averageHeroLevel: number;
};

type WarPlanMetrics = {
  townHall: {
    ourDistribution: Record<string, number>;
    opponentDistribution: Record<string, number>;
    maxTownHallDiff: number;
    highTownHallEdge: number;
  };
  heroFirepower: {
    averageHeroDelta: number;
    topFiveHeroDelta: number;
    heroDepthDelta: number;
  };
  warExperience: {
    medianWarStarDelta: number;
    veteranCountDelta: number;
  };
  rosterReadiness: {
    sizeDelta: number;
    highReadinessDelta: number;
    advantageSlots: number;
    dangerSlots: number;
  };
};

type WarPlanBriefing = {
  headline: string;
  bullets: string[];
  narrative: string;
  confidenceBand: 'edge' | 'balanced' | 'underdog';
  generatedAt: string;
  source: string;
};

type MatchupAnalysis = {
  summary: {
    confidence: number;
    outlook: string;
  };
  teamComparison: {
    ourMetrics: MatchupMetrics;
    opponentMetrics: MatchupMetrics;
    differentials: {
      townHall: number;
      heroLevels: number;
      warStars: number;
      rankedTrophies: number;
    };
  };
  slotBreakdown?: SlotBreakdown[];
  recommendations: string[];
  metrics?: WarPlanMetrics;
  briefing?: WarPlanBriefing;
};

type MatchupResponse = {
  ourProfiles?: RosterMember[];
  opponentProfiles?: RosterMember[];
  analysis: MatchupAnalysis;
};

type SavedPlan = {
  id: string;
  ourClanTag: string;
  opponentClanTag: string;
  ourSelection: string[];
  opponentSelection: string[];
  analysis?: MatchupAnalysis | null;
  analysisStatus?: string | null;
  analysisJobId?: string | null;
  analysisStartedAt?: string | null;
  analysisCompletedAt?: string | null;
  analysisVersion?: string | null;
  updatedAt: string;
};

type SlotBreakdown = {
  slot: number;
  ourTag: string | null;
  ourName: string | null;
  opponentTag: string | null;
  opponentName: string | null;
  ourTH: number | null;
  opponentTH: number | null;
  thDiff: number;
  heroDiff: number;
  rankedDiff: number;
  warStarDiff: number;
  summary: string;
};

const SectionTitle: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex items-center justify-between gap-4 mb-3">
    <h2 className="text-xl font-semibold">{title}</h2>
    {children}
  </div>
);

const WarPlanningPage: React.FC = () => {
  const storeClanTag = useDashboardStore((s) => s.clanTag || s.homeClan || '');

  const [ourClanTagInput, setOurClanTagInput] = useState(storeClanTag);
  const [opponentClanTagInput, setOpponentClanTagInput] = useState('');

  const [ourRoster, setOurRoster] = useState<RosterMember[]>([]);
  const [opponentRoster, setOpponentRoster] = useState<RosterMember[]>([]);

  const [ourSelection, setOurSelection] = useState<Set<string>>(new Set());
  const [opponentSelection, setOpponentSelection] = useState<Set<string>>(new Set());

  const [loadingOurRoster, setLoadingOurRoster] = useState(false);
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  const [ourRosterError, setOurRosterError] = useState<string | null>(null);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [matchup, setMatchup] = useState<MatchupResponse | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);

  const normalizedOurClanTag = useMemo(
    () => (ourClanTagInput ? normalizeTag(ourClanTagInput) : ''),
    [ourClanTagInput],
  );

  const normalizedOpponentTag = useMemo(
    () => (opponentClanTagInput ? normalizeTag(opponentClanTagInput) : ''),
    [opponentClanTagInput],
  );

  const normalizedOurSelection = useMemo(
    () => Array.from(ourSelection).map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag)),
    [ourSelection],
  );

  const normalizedOpponentSelection = useMemo(
    () => Array.from(opponentSelection).map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag)),
    [opponentSelection],
  );

  useEffect(() => {
    if (storeClanTag) {
      setOurClanTagInput(storeClanTag);
    }
  }, [storeClanTag]);

  const toggleSelection = (tag: string, target: 'our' | 'opponent') => {
    if (target === 'our') {
      setOurSelection((prev) => {
        const next = new Set(prev);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        return next;
      });
    } else {
      setOpponentSelection((prev) => {
        const next = new Set(prev);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        return next;
      });
    }
  };

  const getSelectedRosters = useCallback(() => {
    const ourSelectedRoster = ourRoster.filter((member) => {
      const normalized = normalizeTag(member.tag ?? '') ?? '';
      return normalizedOurSelection.includes(normalized);
    });
    const opponentSelectedRoster = opponentRoster.filter((member) => {
      const normalized = normalizeTag(member.tag ?? '') ?? '';
      return normalizedOpponentSelection.includes(normalized);
    });
    return { ourSelectedRoster, opponentSelectedRoster };
  }, [ourRoster, opponentRoster, normalizedOurSelection, normalizedOpponentSelection]);

  const fetchOurRoster = useCallback(async (options?: { preserveSelection?: boolean }) => {
    setOurRosterError(null);
    setMatchup(null);
    setLoadingOurRoster(true);
    try {
      const params = new URLSearchParams();
      if (normalizedOurClanTag) {
        params.set('clanTag', normalizedOurClanTag);
      }
      const res = await fetch(`/api/v2/war-planning/our-roster?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const roster: RosterMember[] = body.data.roster ?? [];
      setOurRoster(roster);
      if (!options?.preserveSelection) {
        setOurSelection(new Set());
      }
    } catch (error) {
      setOurRosterError(error instanceof Error ? error.message : 'Failed to load our roster');
      setOurRoster([]);
      setOurSelection(new Set());
    } finally {
      setLoadingOurRoster(false);
    }
  }, [normalizedOurClanTag]);

  const fetchOpponents = useCallback(async (options?: { preserveSelection?: boolean }) => {
    if (!normalizedOpponentTag || normalizedOpponentTag.length < 5) {
      setOpponentError('Enter the full opponent clan tag (at least 5 characters).');
      setOpponentRoster([]);
      setOpponentSelection(new Set());
      return;
    }
    setOpponentError(null);
    setMatchup(null);
    setLoadingOpponents(true);
    try {
      const params = new URLSearchParams();
      params.set('clanTag', normalizedOpponentTag);
      const res = await fetch(`/api/v2/war-planning/opponents?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const opponents: RosterMember[] = body.data.opponents ?? [];
      setOpponentRoster(opponents);
      if (!options?.preserveSelection) {
        setOpponentSelection(new Set());
      }
    } catch (error) {
      setOpponentError(error instanceof Error ? error.message : 'Failed to load opponent roster');
      setOpponentRoster([]);
      setOpponentSelection(new Set());
    } finally {
      setLoadingOpponents(false);
    }
  }, [normalizedOpponentTag]);

  const runMatchupAnalysis = useCallback(async () => {
    setAnalysisError(null);
    setMatchup(null);
    setRunningAnalysis(true);
    try {
      const ourSelectedRoster = ourRoster.filter((member) => {
        const normalized = normalizeTag(member.tag ?? '') ?? '';
        return normalizedOurSelection.includes(normalized);
      });
      const opponentSelectedRoster = opponentRoster.filter((member) => {
        const normalized = normalizeTag(member.tag ?? '') ?? '';
        return normalizedOpponentSelection.includes(normalized);
      });

      const payload: MatchupPayload = {
        ourClanTag: normalizedOurClanTag || undefined,
        opponentClanTag: normalizedOpponentTag,
        ourSelected: normalizedOurSelection,
        opponentSelected: normalizedOpponentSelection,
        ourRoster: ourSelectedRoster,
        opponentRoster: opponentSelectedRoster,
      };
      const res = await fetch('/api/v2/war-planning/matchup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setMatchup(body.data as MatchupResponse);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Failed to generate matchup analysis');
    } finally {
      setRunningAnalysis(false);
    }
  }, [
    normalizedOpponentTag,
    normalizedOurClanTag,
    normalizedOpponentSelection,
    normalizedOurSelection,
    ourRoster,
    opponentRoster,
  ]);

  const hasAutoLoadedOurRoster = useRef(false);
  const autoFetchOpponentRef = useRef<number | null>(null);
  const planLoadedRef = useRef(false);
  const pendingPlanRef = useRef<SavedPlan | null>(null);

  useEffect(() => {
    return () => {
      if (autoFetchOpponentRef.current) {
        clearTimeout(autoFetchOpponentRef.current);
        autoFetchOpponentRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasAutoLoadedOurRoster.current && normalizedOurClanTag && !loadingOurRoster) {
      hasAutoLoadedOurRoster.current = true;
      const preserveSelection = Boolean(pendingPlanRef.current);
      void fetchOurRoster({ preserveSelection });
    }
  }, [normalizedOurClanTag, fetchOurRoster, loadingOurRoster]);

  useEffect(() => {
    planLoadedRef.current = false;
    pendingPlanRef.current = null;
    setSavedPlan(null);
  }, [normalizedOurClanTag]);


  const planStorageKey = normalizedOurClanTag ? `war-plan:${normalizedOurClanTag}` : null;

  const savePlanToLocal = useCallback(
    (plan: SavedPlan) => {
      if (!planStorageKey) return;
      try {
        localStorage.setItem(planStorageKey, JSON.stringify(plan));
      } catch (error) {
        console.warn('[WarPlanning] Failed to persist plan locally', error);
      }
    },
    [planStorageKey],
  );

  const loadPlanFromLocal = useCallback((): SavedPlan | null => {
    if (!planStorageKey) return null;
    try {
      const raw = localStorage.getItem(planStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.opponentClanTag) {
        return parsed as SavedPlan;
      }
    } catch (error) {
      console.warn('[WarPlanning] Failed to read plan from local storage', error);
    }
    return null;
  }, [planStorageKey]);

  const applyPlan = useCallback(
    (plan: SavedPlan, options?: { message?: string }) => {
      pendingPlanRef.current = plan;
      setSavedPlan(plan);
      savePlanToLocal(plan);
      setPlanError(null);
      if (options?.message) {
        setPlanMessage(options.message);
      } else {
        const statusNote = plan.analysisStatus ? ` — analysis: ${plan.analysisStatus}` : '';
        setPlanMessage(`Plan loaded vs ${plan.opponentClanTag}${statusNote}`);
      }
      setOpponentClanTagInput(plan.opponentClanTag);
      setOurSelection(new Set(plan.ourSelection ?? []));
      setOpponentSelection(new Set(plan.opponentSelection ?? []));
      if (plan.analysis) {
        setMatchup({ analysis: plan.analysis });
      } else {
        setMatchup(null);
      }
    },
    [savePlanToLocal],
  );

  const loadPlan = useCallback(
    async (clanTag: string) => {
      setPlanLoading(true);
      setPlanError(null);
      setPlanMessage(null);

      let plan: SavedPlan | null = null;
      try {
        const res = await fetch(`/api/v2/war-planning/plan?ourClanTag=${encodeURIComponent(clanTag)}`, {
          cache: 'no-store',
        });
        const body = await res.json();
        if (res.ok && body?.data) {
          plan = body.data as SavedPlan;
        }
      } catch (error) {
        console.warn('[WarPlanning] Failed to load plan from server', error);
      }

      if (!plan) {
        plan = loadPlanFromLocal();
      }

      if (plan) {
        const statusNote = plan.analysisStatus ? ` — analysis: ${plan.analysisStatus}` : '';
        applyPlan(plan, { message: `Restored plan vs ${plan.opponentClanTag}${statusNote}` });
      } else {
        setSavedPlan(null);
      }

      setPlanLoading(false);
    },
    [loadPlanFromLocal, applyPlan],
  );

  useEffect(() => {
    if (autoFetchOpponentRef.current) {
      clearTimeout(autoFetchOpponentRef.current);
      autoFetchOpponentRef.current = null;
    }
    if (!normalizedOpponentTag || normalizedOpponentTag.length < 5) {
      setOpponentRoster([]);
      setOpponentSelection(new Set());
      setOpponentError(null);
      return;
    }
    autoFetchOpponentRef.current = window.setTimeout(() => {
      const preserveSelection = Boolean(pendingPlanRef.current);
      void fetchOpponents({ preserveSelection });
    }, 600);
    return () => {
      if (autoFetchOpponentRef.current) {
        clearTimeout(autoFetchOpponentRef.current);
        autoFetchOpponentRef.current = null;
      }
    };
  }, [normalizedOpponentTag, fetchOpponents]);

  useEffect(() => {
    if (planLoadedRef.current) return;
    if (!normalizedOurClanTag) return;
    if (!ourRoster.length) return;
    planLoadedRef.current = true;
    void loadPlan(normalizedOurClanTag);
  }, [ourRoster, normalizedOurClanTag, loadPlan]);

  useEffect(() => {
    const pending = pendingPlanRef.current;
    if (!pending) return;
    if (normalizeTag(pending.opponentClanTag) !== normalizedOpponentTag) return;
    if (!opponentRoster.length) return;
    setOpponentSelection(new Set(pending.opponentSelection ?? []));
    pendingPlanRef.current = null;
  }, [opponentRoster, normalizedOpponentTag]);

  useEffect(() => {
    if (!savedPlan) return;
    const status = (savedPlan.analysisStatus ?? '').toLowerCase();
    if (!['queued', 'running'].includes(status)) return;

    let ignore = false;
    let lastStatus = savedPlan.analysisStatus ?? null;

    const refresh = async () => {
      try {
        const params = new URLSearchParams();
        params.set('ourClanTag', savedPlan.ourClanTag);
        if (savedPlan.opponentClanTag) {
          params.set('opponentClanTag', savedPlan.opponentClanTag);
        }
        const res = await fetch(`/api/v2/war-planning/plan?${params.toString()}`, {
          cache: 'no-store',
        });
        const body = await res.json();
        if (!ignore && res.ok && body?.success && body.data) {
          const latest = body.data as SavedPlan;
          setSavedPlan(latest);
          savePlanToLocal(latest);
          if (latest.analysis) {
            setMatchup({ analysis: latest.analysis });
          }
          const latestStatus = latest.analysisStatus ?? null;
          if (latestStatus !== lastStatus) {
            if (latestStatus && latestStatus.toLowerCase() === 'ready' && latest.analysis) {
              setPlanError(null);
              setPlanMessage(
                `Analysis ready — confidence ${latest.analysis.summary.confidence.toFixed(1)}%`,
              );
            } else if (latestStatus && latestStatus.toLowerCase() === 'error') {
              setPlanError('War plan analysis failed. Try regenerating or adjusting selections.');
            }
            lastStatus = latestStatus;
          }
        }
      } catch (error) {
        if (!ignore) {
          console.warn('[WarPlanning] Failed to refresh plan analysis', error);
        }
      }
    };

    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);

    void refresh();

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [
    savedPlan,
    savedPlan?.analysisStatus,
    savedPlan?.id,
    savedPlan?.opponentClanTag,
    savedPlan?.ourClanTag,
    savePlanToLocal,
  ]);

  const ourRosterLoaded = ourRoster.length > 0;
  const opponentRosterLoaded = opponentRoster.length > 0;
  const canRunAnalysis =
    normalizedOurSelection.length > 0 && normalizedOpponentSelection.length > 0 && !!normalizedOpponentTag;
  const canSavePlan =
    !!normalizedOurClanTag && !!normalizedOpponentTag &&
    normalizedOurSelection.length > 0 && normalizedOpponentSelection.length > 0;

  const handleSavePlan = useCallback(async () => {
    if (!canSavePlan) {
      setPlanError('Select players on both sides before saving.');
      return;
    }

    setSavingPlan(true);
    setPlanError(null);
    setPlanMessage(null);

    const payload = {
      ourClanTag: normalizedOurClanTag,
      opponentClanTag: normalizedOpponentTag,
      ourSelection: normalizedOurSelection,
      opponentSelection: normalizedOpponentSelection,
      updatedAt: new Date().toISOString(),
    };

    try {
      const ourSelectedRoster = ourRoster.filter((member) => {
        const normalized = normalizeTag(member.tag ?? '') ?? '';
        return normalizedOurSelection.includes(normalized);
      });
      const opponentSelectedRoster = opponentRoster.filter((member) => {
        const normalized = normalizeTag(member.tag ?? '') ?? '';
        return normalizedOpponentSelection.includes(normalized);
      });

      const res = await fetch('/api/v2/war-planning/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ourClanTag: payload.ourClanTag,
          opponentClanTag: payload.opponentClanTag,
          ourSelected: payload.ourSelection,
          opponentSelected: payload.opponentSelection,
          ourRoster: ourSelectedRoster,
          opponentRoster: opponentSelectedRoster,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const savedPlanResponse = body.data as SavedPlan;
      applyPlan(savedPlanResponse, {
        message: `Plan saved vs ${savedPlanResponse.opponentClanTag}${savedPlanResponse.analysisStatus ? ` — analysis: ${savedPlanResponse.analysisStatus}` : ''}`,
      });
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  }, [
    canSavePlan,
    normalizedOurClanTag,
    normalizedOpponentTag,
    normalizedOurSelection,
    normalizedOpponentSelection,
    applyPlan,
    ourRoster,
    opponentRoster,
  ]);

  const handleReloadSavedPlan = useCallback(() => {
    if (!savedPlan) return;
    const statusNote = savedPlan.analysisStatus ? ` — analysis: ${savedPlan.analysisStatus}` : '';
   applyPlan(savedPlan, { message: `Plan loaded vs ${savedPlan.opponentClanTag}${statusNote}` });
 }, [applyPlan, savedPlan]);

  const handleRegenerateAnalysis = useCallback(async () => {
    if (!savedPlan) {
      setPlanError('No saved plan to analyze.');
      return;
    }

    setPlanError(null);
    setPlanMessage(null);

    const ourTags = new Set(
      (savedPlan.ourSelection ?? []).map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag)),
    );
    const opponentTags = new Set(
      (savedPlan.opponentSelection ?? [])
        .map((tag) => normalizeTag(tag))
        .filter((tag): tag is string => Boolean(tag)),
    );

    const ourSelectedRoster = ourRoster.filter((member) => {
      const normalized = normalizeTag(member.tag ?? '');
      return normalized ? ourTags.has(normalized) : false;
    });
    const opponentSelectedRoster = opponentRoster.filter((member) => {
      const normalized = normalizeTag(member.tag ?? '');
      return normalized ? opponentTags.has(normalized) : false;
    });

    try {
      const res = await fetch('/api/v2/war-planning/plan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ourClanTag: savedPlan.ourClanTag,
          opponentClanTag: savedPlan.opponentClanTag,
          ourRoster: ourSelectedRoster,
          opponentRoster: opponentSelectedRoster,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const updated = body.data as SavedPlan;
      setSavedPlan(updated);
      savePlanToLocal(updated);
      setMatchup(updated.analysis ? { analysis: updated.analysis } : null);
      setPlanMessage(
        `Analysis requeued — status: ${updated.analysisStatus ?? 'queued'}${updated.analysisJobId ? ` (job ${shortId(updated.analysisJobId)})` : ''}`,
      );
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to re-run analysis.');
    }
  }, [savedPlan, ourRoster, opponentRoster, savePlanToLocal]);

  const handleCopyPlan = useCallback(async () => {
    if (!savedPlan) {
      setPlanError('No saved plan to copy.');
      return;
    }
    setPlanError(null);
    setPlanMessage(null);
    const analysis = savedPlan.analysis ?? matchup?.analysis ?? null;
    const report = buildAnalysisReport(analysis, savedPlan);
    const payload = {
      plan: savedPlan,
      analysis,
      ourRoster,
      opponentRoster,
      exportedAt: new Date().toISOString(),
      report,
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = `${report}\n\n---\n\n${JSON.stringify(payload, null, 2)}`;
        await navigator.clipboard.writeText(text);
        setPlanMessage('Plan payload + report copied to clipboard.');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (error) {
      setPlanError('Failed to copy plan to clipboard.');
    }
  }, [savedPlan, matchup, ourRoster, opponentRoster]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-3xl font-bold mb-2">War Planning Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Select our lineup, choose opponent targets, and run a quick matchup assessment before the war begins.
        </p>
      </header>

      <GlassCard className="p-4">
        <SectionTitle title="1. Load Our Roster">
          <Button variant="secondary" onClick={() => fetchOurRoster()} disabled={loadingOurRoster}>
            {loadingOurRoster ? 'Loading…' : 'Refresh'}
          </Button>
        </SectionTitle>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Our Clan Tag
            <input
              value={ourClanTagInput}
              onChange={(e) => setOurClanTagInput(e.target.value)}
              placeholder="#OURCLAN"
              className="rounded border border-border bg-background px-3 py-2"
            />
          </label>
          {ourRosterError && <p className="text-sm text-destructive">{ourRosterError}</p>}
          {ourRosterLoaded ? (
            <RosterList
              roster={ourRoster}
              selection={ourSelection}
              onToggle={(tag) => toggleSelection(tag, 'our')}
              emptyMessage="No members found for this clan."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Load your roster to start selecting participants.
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <SectionTitle title="2. Load Opponent Roster">
          <Button variant="secondary" onClick={() => fetchOpponents()} disabled={loadingOpponents}>
            {loadingOpponents ? 'Loading…' : 'Fetch Opponent'}
          </Button>
        </SectionTitle>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Opponent Clan Tag
            <input
              value={opponentClanTagInput}
              onChange={(e) => setOpponentClanTagInput(e.target.value)}
              placeholder="#OPPONENT"
              className="rounded border border-border bg-background px-3 py-2"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void fetchOpponents();
                }
              }}
            />
          </label>
          {opponentError && <p className="text-sm text-destructive">{opponentError}</p>}
          {opponentRosterLoaded ? (
            <RosterList
              roster={opponentRoster}
              selection={opponentSelection}
              onToggle={(tag) => toggleSelection(tag, 'opponent')}
              emptyMessage="No opponent members returned."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Fetch the opponent roster to choose targets for enrichment.
            </p>
          )}
        </div>
      </GlassCard>

      {savedPlan && (
        <GlassCard className="p-4">
          <SectionTitle
            title={`Saved Plan — vs ${savedPlan.opponentClanTag}`}
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleReloadSavedPlan}>
                Load Saved Plan
              </Button>
              <Button
                variant="secondary"
                onClick={handleRegenerateAnalysis}
                disabled={['queued', 'running'].includes((savedPlan.analysisStatus ?? '').toLowerCase())}
              >
                Re-run Analysis
              </Button>
              <Button variant="ghost" onClick={handleCopyPlan}>
                Copy Payload
              </Button>
            </div>
          </SectionTitle>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-2">
            <span>Updated {formatTimestamp(savedPlan.updatedAt)}</span>
            <span>• Analysis: {formatAnalysisStatus(savedPlan.analysisStatus)}</span>
            {savedPlan.analysisVersion && <span>• v{savedPlan.analysisVersion}</span>}
            {savedPlan.analysisJobId && <span>• Job {shortId(savedPlan.analysisJobId)}</span>}
            {savedPlan.analysisStartedAt && <span>• Started {formatTimestamp(savedPlan.analysisStartedAt)}</span>}
            {savedPlan.analysisCompletedAt && <span>• Completed {formatTimestamp(savedPlan.analysisCompletedAt)}</span>}
          </p>
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <SectionTitle title="3. Matchup Analysis">
          <Button onClick={runMatchupAnalysis} disabled={!canRunAnalysis || runningAnalysis}>
            {runningAnalysis ? 'Analyzing…' : 'Run Analysis'}
          </Button>
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Button variant="secondary" onClick={handleSavePlan} disabled={!canSavePlan || savingPlan}>
            {savingPlan ? 'Saving…' : 'Save Plan'}
          </Button>
          {planLoading && <span className="text-xs text-muted-foreground">Loading saved plan…</span>}
          {planMessage && <span className="text-xs text-emerald-400">{planMessage}</span>}
          {planError && <span className="text-xs text-destructive">{planError}</span>}
        </div>
        <div className="space-y-4">
          {!canRunAnalysis && (
            <p className="text-sm text-muted-foreground">
              Select at least one player on each side to run the matchup analysis.
            </p>
          )}
          {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
          {matchup && (
            <MatchupResult matchup={matchup} ourSelection={ourSelection} opponentSelection={opponentSelection} />
          )}
        </div>
      </GlassCard>
    </div>
  );
};

type MatchupPayload = {
  ourClanTag?: string;
  opponentClanTag: string;
  ourSelected: string[];
  opponentSelected: string[];
  ourRoster?: RosterMember[];
  opponentRoster?: RosterMember[];
};

const RosterList: React.FC<{
  roster: RosterMember[];
  selection: Set<string>;
  onToggle: (tag: string) => void;
  emptyMessage: string;
}> = ({ roster, selection, onToggle, emptyMessage }) => {
  if (!roster.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {roster.map((player) => {
        const isSelected = selection.has(player.tag);
        return (
          <label
            key={player.tag}
            className={`flex cursor-pointer flex-col gap-1 rounded border px-3 py-2 transition ${
              isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm truncate">{player.name}</span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(player.tag)}
                className="h-4 w-4"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Tag: {player.tag}</div>
              <div>TH: {player.thLevel ?? '—'}</div>
              <div>Heroes: {formatHeroSummary(player.heroLevels)}</div>
              <div>War Stars: {player.warStars ?? '—'}</div>
              <div>Activity: {player.activityScore ?? '—'}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
};

const MatchupResult: React.FC<{
  matchup: MatchupResponse;
  ourSelection: Set<string>;
  opponentSelection: Set<string>;
}> = ({ matchup }) => {
  const { analysis } = matchup;
  const recommendations = analysis.recommendations ?? [];
  const slotBreakdown = analysis.slotBreakdown ?? [];
  const metrics = analysis.metrics;
  const briefing = analysis.briefing;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Confidence" value={`${analysis.summary.confidence.toFixed(1)}%`} />
        <StatCard label="Outlook" value={analysis.summary.outlook} />
      </div>

      {briefing && (
        <GlassCard className="p-4 border border-primary/40 bg-primary/5 space-y-2">
          <div className="text-xs uppercase text-primary">{briefing.confidenceBand === 'edge' ? 'Advantage' : briefing.confidenceBand === 'underdog' ? 'Underdog' : 'Balanced'}</div>
          <h3 className="text-lg font-semibold">{briefing.headline}</h3>
          <ul className="list-disc pl-4 space-y-1 text-sm">
            {briefing.bullets.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Generated {formatTimestamp(briefing.generatedAt)} • Source: {briefing.source}
          </p>
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-2">Our Team Metrics</h3>
          <MetricList metrics={analysis.teamComparison.ourMetrics} />
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-2">Opponent Metrics</h3>
          <MetricList metrics={analysis.teamComparison.opponentMetrics} />
        </GlassCard>
      </div>

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            title="Town Hall Edge"
            items={[
              `Max TH diff: ${formatSignedNumber(metrics.townHall.maxTownHallDiff, 0)}`,
              `High-tier edge: ${formatSignedNumber(metrics.townHall.highTownHallEdge, 0)}`,
              `Our spread: ${summarizeDistribution(metrics.townHall.ourDistribution)}`,
              `Opponent spread: ${summarizeDistribution(metrics.townHall.opponentDistribution)}`,
            ]}
          />
          <InsightCard
            title="Hero Firepower"
            items={[
              `Average heroes: ${formatSignedNumber(metrics.heroFirepower.averageHeroDelta, 1)}`,
              `Top 5 hero delta: ${formatSignedNumber(metrics.heroFirepower.topFiveHeroDelta, 1)}`,
              `Hero depth delta: ${formatSignedNumber(metrics.heroFirepower.heroDepthDelta, 1)}`,
            ]}
          />
          <InsightCard
            title="War Experience"
            items={[
              `Median war stars: ${formatSignedNumber(metrics.warExperience.medianWarStarDelta, 0)}`,
              `Veteran edge (≥150 stars): ${formatSignedNumber(metrics.warExperience.veteranCountDelta, 0)}`,
            ]}
          />
          <InsightCard
            title="Roster Readiness"
            items={[
              `Roster size: ${formatSignedNumber(metrics.rosterReadiness.sizeDelta, 0)}`,
              `Hero-ready attackers (≥55): ${formatSignedNumber(metrics.rosterReadiness.highReadinessDelta, 0)}`,
              `Advantage slots: ${metrics.rosterReadiness.advantageSlots}`,
              `Pressure slots: ${metrics.rosterReadiness.dangerSlots}`,
            ]}
          />
        </div>
      )}

      <GlassCard className="p-4">
        <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
        <ul className="list-disc pl-4 space-y-1 text-sm">
          {recommendations.length ? (
            recommendations.map((item, idx) => <li key={idx}>{item}</li>)
          ) : (
            <li>No recommendations generated.</li>
          )}
        </ul>
      </GlassCard>
      {slotBreakdown.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-3">Slot Matchups</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Slot</th>
                  <th className="py-2 text-left">Our Player</th>
                  <th className="py-2 text-left">Opponent</th>
                  <th className="py-2 text-left">TH Δ</th>
                  <th className="py-2 text-left">Hero Δ</th>
                  <th className="py-2 text-left">Ranked Δ</th>
                  <th className="py-2 text-left">War Stars Δ</th>
                  <th className="py-2 text-left">Summary</th>
                </tr>
              </thead>
              <tbody>
                {slotBreakdown.map((slot) => (
                  <tr key={`slot-${slot.slot}`} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2">{slot.slot}</td>
                    <td className="py-2">
                      <div className="font-medium">{slot.ourName ?? slot.ourTag ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{slot.ourTag ?? '—'} • TH {slot.ourTH ?? '—'}</div>
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{slot.opponentName ?? slot.opponentTag ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{slot.opponentTag ?? '—'} • TH {slot.opponentTH ?? '—'}</div>
                    </td>
                    <td className="py-2">{slot.thDiff >= 0 ? `+${slot.thDiff}` : slot.thDiff}</td>
                    <td className="py-2">{slot.heroDiff >= 0 ? `+${slot.heroDiff.toFixed(1)}` : slot.heroDiff.toFixed(1)}</td>
                    <td className="py-2">{slot.rankedDiff >= 0 ? `+${slot.rankedDiff}` : slot.rankedDiff}</td>
                    <td className="py-2">{slot.warStarDiff >= 0 ? `+${slot.warStarDiff}` : slot.warStarDiff}</td>
                    <td className="py-2">{slot.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <GlassCard className="p-4">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold">{value}</div>
  </GlassCard>
);

const MetricList: React.FC<{ metrics: MatchupMetrics }> = ({ metrics }) => (
  <ul className="space-y-1 text-sm">
    <li>Players Selected: {metrics.size}</li>
    <li>Average TH: {metrics.averageTownHall.toFixed(2)}</li>
    <li>Max TH: {metrics.maxTownHall}</li>
    <li>Average War Stars: {metrics.averageWarStars.toFixed(1)}</li>
    <li>Average Ranked Trophies: {metrics.averageRankedTrophies.toFixed(0)}</li>
    <li>Average Hero Level: {metrics.averageHeroLevel.toFixed(1)}</li>
  </ul>
);

const InsightCard: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <GlassCard className="p-4 space-y-2">
    <h3 className="text-lg font-semibold">{title}</h3>
    <ul className="list-disc pl-4 space-y-1 text-sm">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  </GlassCard>
);

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortId(id?: string | null): string {
  if (!id) return '';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatAnalysisStatus(status?: string | null): string {
  if (!status) return 'pending';
  const normalized = status.toLowerCase();
  if (normalized === 'queued') return 'queued (awaiting job)';
  if (normalized === 'running') return 'running';
  if (normalized === 'ready') return 'ready';
  if (normalized === 'error') return 'error';
  return status;
}

function formatSignedNumber(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  if (value > 0) return `+${fixed}`;
  if (value === 0) return '0';
  return fixed;
}

function summarizeDistribution(distribution: Record<string, number>): string {
  const entries = Object.entries(distribution)
    .filter(([th]) => th !== 'unknown')
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 4)
    .map(([th, count]) => `TH${th}: ${count}`);
  if (!entries.length) {
    return 'No data';
  }
  return entries.join(' • ');
}

function formatHeroSummary(heroLevels: HeroLevels): string {
  const entries = Object.entries(heroLevels ?? {});
  if (!entries.length) return '—';
  return entries
    .filter(([, value]) => typeof value === 'number' && value != null)
    .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
    .join(', ');
}

function buildAnalysisReport(analysis: MatchupAnalysis | null | undefined, plan: SavedPlan | null): string {
  if (!analysis) {
    return 'War plan report unavailable — analysis has not finished running.';
  }

  const lines: string[] = [];
  const opponent = plan?.opponentClanTag ?? 'Opponent';
  const ours = plan?.ourClanTag ?? 'Our Clan';

  lines.push(`# War Plan Report: ${ours} vs ${opponent}`);
  lines.push('');
  lines.push(`- Confidence: ${analysis.summary.confidence.toFixed(1)}% (${analysis.summary.outlook})`);

  if (analysis.briefing) {
    lines.push(`- Briefing: ${analysis.briefing.headline}`);
    analysis.briefing.bullets.forEach((bullet) => {
      lines.push(`  - ${bullet}`);
    });
  }

  const metrics = analysis.metrics;
  if (metrics) {
    lines.push('');
    lines.push('## Metrics Snapshot');
    lines.push(`- Town Hall advantage: max diff ${formatSignedNumber(metrics.townHall.maxTownHallDiff, 0)}, high-tier edge ${formatSignedNumber(metrics.townHall.highTownHallEdge, 0)}`);
    lines.push(`- Hero firepower: avg hero delta ${formatSignedNumber(metrics.heroFirepower.averageHeroDelta, 1)}, top-5 ${formatSignedNumber(metrics.heroFirepower.topFiveHeroDelta, 1)}`);
    lines.push(`- War experience: median stars ${formatSignedNumber(metrics.warExperience.medianWarStarDelta, 0)}, veterans ${formatSignedNumber(metrics.warExperience.veteranCountDelta, 0)}`);
    lines.push(`- Roster readiness: size delta ${formatSignedNumber(metrics.rosterReadiness.sizeDelta, 0)}, hero-ready ${formatSignedNumber(metrics.rosterReadiness.highReadinessDelta, 0)}, advantage slots ${metrics.rosterReadiness.advantageSlots}, pressure slots ${metrics.rosterReadiness.dangerSlots}`);
  }

  const recommendations = analysis.recommendations ?? [];
  if (recommendations.length) {
    lines.push('');
    lines.push('## Recommendations');
    recommendations.forEach((rec) => lines.push(`- ${rec}`));
  }

  const slotBreakdown = analysis.slotBreakdown ?? [];
  if (slotBreakdown.length) {
    const highlightCount = Math.min(slotBreakdown.length, 5);
    lines.push('');
    lines.push(`## Slot Highlights (top ${highlightCount})`);
    slotBreakdown.slice(0, highlightCount).forEach((slot) => {
      lines.push(
        `- Slot ${slot.slot}: ${slot.ourName ?? slot.ourTag ?? '—'} vs ${slot.opponentName ?? slot.opponentTag ?? '—'} — ${slot.summary}`,
      );
    });
  }

  lines.push('');
  lines.push(`Generated ${formatTimestamp(analysis.briefing?.generatedAt ?? new Date().toISOString())}`);
  return lines.join('\n');
}

export default WarPlanningPage;
