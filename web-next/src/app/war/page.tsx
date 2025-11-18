"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, GlassCard, MetricCard, Tooltip } from '@/components/ui';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { WorkflowSteps } from '@/components/war/WorkflowSteps';
import { normalizeTag } from '@/lib/tags';
import type { WarPlanAIPayload } from '@/lib/war-planning/analysis';
import { useLeadership } from '@/hooks/useLeadership';
import { TOOLTIP_CONTENT } from '@/lib/tooltips/tooltip-content';

const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

const ORACLE_DIRECTIVE = `"You are designated as **'Clan War Oracle,'** a **World-Class Clash of Clans War Strategist**. Your expertise is absolute, based on a deep understanding of competitive war metrics and the cutting-edge META strategies of 2025.

Your singular mission is to perform a **deep, comprehensive analysis** of the subsequent \`War Plan Report\` data block, prioritizing the use of the structured JSON data for all quantitative conclusions.

**DYNAMIC DATA ANALYSIS & STRATEGIC CONTEXT (Referencing the provided data block):**
1.  **Outlook & Confidence:** Extract and report the numerical **Confidence Rating** and the overall **Outlook** (e.g., Favorable, Even, Unfavorable).
2.  **Firepower Edge:** Calculate the strategic significance of the **Average Hero Delta** and **Top-Five Hero Delta** on attack sequencing.
3.  **Challenge Areas:** Identify the exact number of **Danger Slots (TH Mismatches)** and formulate a mandatory plan for neutralizing the disadvantage.
4.  **Roster Composition:** Identify the primary **Town Hall Distribution** for both clans to tailor army recommendations in Section 4.

**CURRENT META AND MECHANICS (Must be integrated into strategy):**
*   **System Reworks:** Incorporate the impact of recent changes, including the **Magic Shield** and **Reworked Revenge System**, the **Unified Town Hall Upgrades**, and the **Spring Trap Rework** (targeting the highest housing space troop).
*   **Equipment Focus:** Ensure all strategies leverage prevailing **META Hero Equipment** (e.g., **Electro Boots**, **Fireball**, **Frozen Arrow**, **Giant Gauntlet**).

---

### **[OUTPUT FORMATTING & REQUIRED 6-SECTION ANALYSIS]**

"Generate your strategy in a professional tone using the following precise Markdown structure. **The outputs for Sections 3 and 6 must explicitly define WHO attacks WHO using names and corresponding slot numbers.**"

### **1. Executive War Briefing: Strategic Outlook (Data Synthesis)**

*   **Confidence Rating & Core Thesis:** Re-state the calculated **% confidence** and deliver a 1-2 sentence core thesis justifying the war plan.

### **2. Deep Matchup Analysis: Data-Driven Interpretation**

*   **Hero Firepower & Offensive Strategy:** Interpret the numerical impact of the Hero Delta on the initial attack wave. Confirm that any slots with a **TH Advantage** or exceptional **Hero Advantage** must be exploited aggressively.
*   **TH Roster Management Policy:** Clearly state the optimal CWL strategy type (e.g., **Bottom Up**, **Roster Switch**, or **Edge TH Switch**) to maximize star count against the opponent's TH distribution.

### **3. Optimized Attack Sequencing & Targeting (WHO vs. WHO)**

*   **Phase 1: Momentum & Exploitation (Triple Focus):** Define which players must attack which specific opponent bases (Slots 1-10) to secure high-value triples. **The output must be formatted as a bulleted list: [Our Player Name (Our Slot #) $\\rightarrow$ Opponent Name (Opponent Slot #)].** These assignments should leverage the clan's Hero Firepower advantage.
*   **Phase 2: Mismatch Management (Danger Slots/2-Star Focus):** Provide explicit instructions detailing which of **our players** are assigned to attack the **Danger Slots** (all bases with **TH Disadvantage**). The instruction must state the **Opponent's Name and Slot #** and prioritize a guaranteed high-percentage 2-star outcome.

### **4. World-Class META Attack Recommendations (Contextual and Dynamic)**

*   **3-Star Strategies (TH Mirror/Dip):** Recommend 2-3 current top-tier attack strategies. Tailor selections to the most common TH levels in our roster and include mandatory **Hero Equipment** pairings (e.g., **Root Rider Smash**, **Queen Charge Lalo (QCL)**, or **Fireball Rocket Loon/Dragon attacks**).
*   **2-Star Mismatch Strategies (Attacking Up):** Recommend precise armies for the designated 'attacking up' players (TH Disadvantage slots), focusing on securing the Town Hall and high destruction percentage (e.g., **Sneaky Goblin Blimp** followed by Baby Dragons/E-Drags).

### **5. Critical Defensive Preparation**

*   **CC Defense Strategy:** Recommend a maximum of three optimal Clan Castle (CC) defensive compositions suitable for the highest TH levels, explicitly naming troops known to delay or disrupt strong hero charges (e.g., **Ice Golems + Super Minions** or **2 IG + 1 Furnace**).
*   **Base Layout Review:** Advise clan members to review their **COC layout** to optimize against prevailing META attacks.

---

### **6. Mandatory Final Assignment Table**

**Produce a final, clear table listing the entire attack roster, stating the proposed strategy for the first attack only.**

| Our Slot # | Our Player Name | Target Opponent Slot # | Target Opponent Name | Primary Goal | Recommended Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [Our 1] | [Name] | [Opp 1] | [Name] | 3-Star | [META Strategy] |
| [Our 2] | [Name] | [Opp X] | [Name] | [Goal] | [Strategy] |
| ... | ... | ... | ... | ... | ... |
| [Our N] | [Name] | [Opp Y] | [Name] | [Goal] | [Strategy] |

---

### **[END OF CLAN WAR ORACLE INSTRUCTIONS. ANALYZE THE FOLLOWING DATA.]**

--- **BEGIN WARPLAN REPORT DATA** ---`;

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
  warPreference?: "in" | "out" | null;
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

type OpponentProfile = {
  clan: {
    tag: string;
    name?: string;
    level?: number;
    league?: { id: number; name: string } | null;
    memberCount?: number;
    warRecord?: { wins?: number; losses?: number; ties?: number; winStreak?: number };
    warFrequency?: string | null;
    publicWarLog?: boolean;
  };
  roster: Array<{
    tag: string;
    name: string;
    role?: string;
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
    th?: number | null;
    readinessScore?: number | null;
    isMax?: boolean;
    isRushed?: boolean;
  }>;
  thDistribution: Record<string, number>;
  recentForm: {
    lastWars: number;
    wlt: { w: number; l: number; t: number };
    avgStars?: number | null;
    avgDestruction?: number | null;
    teamSizes?: Record<string, number>;
  };
  briefing: { bullets: string[]; copy: string };
  limitations: {
    privateWarLog?: boolean;
    couldNotDetectOpponent?: boolean;
    partialPlayerDetails?: boolean;
  };
  detectedOpponentTag?: string | null;
  warState?: string | null;
};

type WarPlanBriefing = {
  headline: string;
  bullets: string[];
  narrative: string;
  confidenceBand: 'edge' | 'balanced' | 'underdog';
  generatedAt: string;
  source: string;
  model?: string;
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
  aiInput?: WarPlanAIPayload | null;
};

type MatchupResponse = {
  ourProfiles?: RosterMember[];
  opponentProfiles?: RosterMember[];
  analysis: MatchupAnalysis;
  useAI?: boolean;
  opponentClanName?: string | null;
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
  useAI?: boolean;
  opponentClanName?: string | null;
};

const EMPTY_HERO_LEVELS: HeroLevels = { bk: null, aq: null, gw: null, rc: null, mp: null };

function buildRosterFromProfile(profile?: OpponentProfile | null): RosterMember[] {
  if (!profile?.roster?.length) return [];
  return profile.roster.map((player) => {
    const tag = normalizeTag(player.tag ?? '') || player.tag;
    return {
      tag,
      name: player.name || tag,
      thLevel: typeof player.th === 'number' ? player.th : null,
      role: player.role ?? null,
      trophies: typeof player.trophies === 'number' ? player.trophies : null,
      rankedTrophies: typeof player.trophies === 'number' ? player.trophies : null,
      warStars: null,
      heroLevels: { ...EMPTY_HERO_LEVELS },
      activityScore: typeof player.readinessScore === 'number' ? player.readinessScore : null,
      lastUpdated: null,
      warPreference: null,
    };
  });
}

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

const WarCenterPage: React.FC = () => {
  const router = useRouter();
  const search = useSearchParams();
  const {
    permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useLeadership();
  const canViewWarPrep = permissions.canViewWarPrep;
  const canManageWarPlans = permissions.canManageWarPlans;
  const canRunWarAnalysisPermission = permissions.canRunWarAnalysis;

  // Simple state - no Zustand (SSOT from API)
  const [clanTag, setClanTag] = useState('');
  const [clanName, setClanName] = useState('');

  const [ourClanTagInput, setOurClanTagInput] = useState('');
  const [opponentClanTagInput, setOpponentClanTagInput] = useState('');
  const [autoDetectOpponent, setAutoDetectOpponent] = useState(true);
  const [enrichLevel, setEnrichLevel] = useState(12);
  const [opponentProfile, setOpponentProfile] = useState<OpponentProfile | null>(null);
  const [opponentProfileLoading, setOpponentProfileLoading] = useState(false);
  const [opponentProfileError, setOpponentProfileError] = useState<string | null>(null);
  const [opponentProfileMessage, setOpponentProfileMessage] = useState<string | null>(null);

  // Load our clan info on mount
  useEffect(() => {
    async function loadClanInfo() {
      try {
        const res = await fetch('/api/v2/roster?mode=latest', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.clan) {
            const tag = data.data.clan.tag || '';
            const name = data.data.clan.name || '';
            setClanTag(tag);
            setClanName(name);
            setOurClanTagInput(tag); // Pre-fill form
          }
        }
      } catch (error) {
        console.warn('[WarPlanning] Failed to load clan info:', error);
      }
    }
    loadClanInfo();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('war-prep-opponent');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (!data?.profile) return;
      const age = Date.now() - (data.timestamp ?? 0);
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('war-prep-opponent');
        return;
      }
      setOpponentProfile(data.profile as OpponentProfile);
      setAutoDetectOpponent(data.autoDetect ?? true);
      setEnrichLevel(data.enrich ?? 12);
      if (data.opponentTag) {
        setOpponentClanTagInput(data.opponentTag);
      }
    } catch (error) {
      console.warn('[WarCenter] Failed to restore opponent profile', error);
    }
  }, []);

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
  const [useAI, setUseAI] = useState(true);
  const [opponentClanName, setOpponentClanName] = useState<string>('');

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

  const clearPlanState = useCallback(() => {
    pendingPlanRef.current = null;
    setSavedPlan(null);
    setPlanMessage(null);
    setPlanError(null);
    setMatchup(null);
    if (planStorageKey) {
      try {
        localStorage.removeItem(planStorageKey);
      } catch (error) {
        console.warn('[WarPlanning] Failed to clear local plan cache', error);
      }
    }
  }, [planStorageKey]);

  const cleanOpponentTag = normalizedOpponentTag;
  const cleanOurClanTag = normalizedOurClanTag;

  const recordOpponentHistory = useCallback(
    async (profileOverride?: OpponentProfile | null) => {
      if (!canManageWarPlans) return;
      if (!cleanOurClanTag) return;
      const sourceProfile = profileOverride ?? opponentProfile;
      if (!sourceProfile) return;
      const opponentTag = normalizeTag(sourceProfile.clan.tag ?? '') || cleanOpponentTag;
      if (!opponentTag) return;
      try {
        await fetch('/api/war/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ourClanTag: cleanOurClanTag,
            opponentTag,
            opponentName: sourceProfile.clan.name ?? null,
          }),
        });
      } catch (error) {
        console.warn('[WarCenter] Failed to record war history', error);
      }
    },
    [canManageWarPlans, cleanOurClanTag, cleanOpponentTag, opponentProfile],
  );

  const clearOpponentState = useCallback(() => {
    setOpponentProfile(null);
    setOpponentProfileError(null);
    setOpponentProfileMessage(null);
    setOpponentClanTagInput('');
    setOpponentClanName('');
    setOpponentSelection(new Set());
    setOurSelection(new Set());
    setOpponentRoster([]);
    try {
      localStorage.removeItem('war-prep-opponent');
    } catch {
      /* ignore */
    }
    clearPlanState();
  }, [clearPlanState]);

  const applyProfileRosterFallback = useCallback(
    (options?: { resetSelection?: boolean; requireTag?: string }) => {
      if (!opponentProfile) return false;
      if (options?.requireTag) {
        const profileTag = normalizeTag(opponentProfile.clan?.tag ?? '');
        if (!profileTag || profileTag !== normalizeTag(options.requireTag)) {
          return false;
        }
      }
      const fallbackRoster = buildRosterFromProfile(opponentProfile);
      if (!fallbackRoster.length) return false;
      setOpponentRoster(fallbackRoster);
      const shouldReset = options?.resetSelection ?? true;
      if (shouldReset) {
        setOpponentSelection(new Set());
      }
      return true;
    },
    [opponentProfile],
  );

  useEffect(() => {
    if (!opponentProfile) return;
    applyProfileRosterFallback();
    setOpponentError(null);
  }, [opponentProfile, applyProfileRosterFallback]);

  const lastArchivedOpponentTag = useRef<string | null>(null);

  useEffect(() => {
    if (!autoDetectOpponent || !opponentProfile) return;
    const state = opponentProfile.warState?.toLowerCase() || null;
    const opponentTag = normalizeTag(opponentProfile.clan.tag ?? '');
    if (!opponentTag) return;

    if (state === 'warended') {
      if (lastArchivedOpponentTag.current === opponentTag) return;
      lastArchivedOpponentTag.current = opponentTag;
      void (async () => {
        if (canManageWarPlans) {
          await recordOpponentHistory(opponentProfile);
        }
        clearOpponentState();
        setOpponentProfileMessage('Last war archived. Ready for the next opponent.');
      })();
    } else if (state === 'inwar' || state === 'preparation') {
      if (lastArchivedOpponentTag.current === opponentTag) {
        lastArchivedOpponentTag.current = null;
      }
    }
  }, [
    autoDetectOpponent,
    opponentProfile,
    canManageWarPlans,
    recordOpponentHistory,
    clearOpponentState,
  ]);

  const toggleSelection = useCallback(
    (tag: string, target: 'our' | 'opponent') => {
      if (!canManageWarPlans) {
        setPlanError('You do not have permission to modify war plan selections.');
        return;
      }
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
    },
    [canManageWarPlans],
  );

  useEffect(() => {
    if (!opponentProfile) return;
    try {
      localStorage.setItem('war-prep-opponent', JSON.stringify({
        profile: opponentProfile,
        timestamp: Date.now(),
        opponentTag: opponentProfile.clan.tag,
        autoDetect: autoDetectOpponent,
        enrich: enrichLevel,
      }));
    } catch (error) {
      console.warn('[WarCenter] Failed to cache opponent profile', error);
    }
  }, [opponentProfile, autoDetectOpponent, enrichLevel]);

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
      setOpponentClanName('');
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
      const opponents: RosterMember[] = (body.data.opponents ?? []).map((member: any) => ({
        ...member,
        heroLevels: member.heroLevels ?? { bk: null, aq: null, gw: null, rc: null, mp: null },
      }));
      setOpponentRoster(opponents);
      const fetchedClanName = body.data.clan?.name ?? '';
      if (fetchedClanName) {
        setOpponentClanName(fetchedClanName);
      } else if (!opponentClanName) {
        setOpponentClanName('');
      }
      if (!options?.preserveSelection) {
        setOpponentSelection(new Set());
      }
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : 'Failed to load opponent roster';
      const fallbackApplied = applyProfileRosterFallback({
        resetSelection: !options?.preserveSelection,
        requireTag: normalizedOpponentTag,
      });
      setOpponentError(
        fallbackApplied
          ? `${baseMessage}. Showing limited roster from opponent profile instead.`
          : baseMessage,
      );
      if (!fallbackApplied) {
        setOpponentRoster([]);
        if (!options?.preserveSelection) {
          setOpponentSelection(new Set());
        }
        setOpponentClanName('');
      }
    } finally {
      setLoadingOpponents(false);
    }
  }, [normalizedOpponentTag, opponentClanName, applyProfileRosterFallback]);

  const fetchOpponentProfile = useCallback(
    async (options: { pin?: boolean } = {}) => {
      const targetOpponentTag = cleanOpponentTag || (autoDetectOpponent ? 'auto-detect' : '');
      const currentOpponentTag = opponentProfile?.clan?.tag;

      if (
        targetOpponentTag &&
        currentOpponentTag &&
        normalizeTag(targetOpponentTag) === normalizeTag(currentOpponentTag) &&
        options.pin !== false
      ) {
        return;
      }

      setOpponentProfileLoading(true);
      setOpponentProfileError(null);
      setOpponentProfileMessage(null);
      setOpponentProfile(null);
      try {
        const params = new URLSearchParams();
        if (autoDetectOpponent && cleanOurClanTag) params.set('autoDetect', 'true');
        if (!autoDetectOpponent && cleanOpponentTag) params.set('opponentTag', cleanOpponentTag);
        if (autoDetectOpponent && cleanOurClanTag) params.set('ourClanTag', cleanOurClanTag);
        if (enrichLevel) params.set('enrich', String(enrichLevel));
        if (!autoDetectOpponent && cleanOpponentTag && cleanOurClanTag) params.set('ourClanTag', cleanOurClanTag);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch(`/api/war/opponent?${params.toString()}`, {
            signal: controller.signal,
            cache: 'no-store',
          });
          const body = await res.json();
          if (!res.ok || !body?.success) {
            throw new Error(body?.error || `HTTP ${res.status}`);
          }
          const profile = body.data as OpponentProfile;
          setOpponentProfile(profile);
          setOpponentProfileMessage('Opponent profile updated.');
          const detectedTag = normalizeTag(profile.clan.tag ?? '') || cleanOpponentTag;
          if (detectedTag) {
            setOpponentClanTagInput(detectedTag);
            if (!cleanOpponentTag) {
              setOpponentError(null);
            }
          }
          if (profile.clan?.name) {
            setOpponentClanName(profile.clan.name);
          }

          const url = new URL(window.location.href);
          url.searchParams.set('autoDetect', String(autoDetectOpponent));
          if (!autoDetectOpponent && detectedTag) url.searchParams.set('opponentTag', detectedTag);
          if (cleanOurClanTag) url.searchParams.set('ourClanTag', cleanOurClanTag);
          url.searchParams.set('enrich', String(enrichLevel));
          router.replace(`${url.pathname}?${url.searchParams.toString()}`);

          if (options.pin !== false && cleanOurClanTag && (detectedTag || profile.clan?.tag)) {
            const opponentTagForPin = detectedTag || profile.clan.tag;
            try {
              await fetch('/api/war/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ourClanTag: cleanOurClanTag,
                  opponentTag: opponentTagForPin,
                  profileData: profile,
                }),
              });
            } catch (error) {
              console.warn('[WarCenter] Failed to persist pinned opponent', error);
            }
          }

          if (detectedTag) {
            void fetchOpponents({ preserveSelection: true });
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        setOpponentProfileError(
          error instanceof Error ? error.message : 'Failed to fetch opponent profile',
        );
        setOpponentProfileMessage(null);
      } finally {
        setOpponentProfileLoading(false);
      }
    },
    [
      autoDetectOpponent,
      cleanOpponentTag,
      cleanOurClanTag,
      enrichLevel,
      opponentProfile,
      router,
      fetchOpponents,
    ],
  );

  const handleClearOpponent = useCallback(async () => {
    if (!canManageWarPlans) {
      setOpponentProfileError('You do not have permission to reset or record opponents.');
      return;
    }
    await recordOpponentHistory(opponentProfile);
    clearOpponentState();
  }, [canManageWarPlans, opponentProfile, recordOpponentHistory, clearOpponentState]);

  const handleClearSelections = useCallback(() => {
    if (!canManageWarPlans) {
      setPlanError('You do not have permission to modify selections.');
      return;
    }
    setOurSelection(new Set());
    setOpponentSelection(new Set());
    setMatchup(null);
    setPlanMessage(null);
    setPlanError(null);
  }, [canManageWarPlans]);

  const handlePinOpponent = useCallback(async () => {
    if (!canManageWarPlans) {
      setOpponentProfileError('You do not have permission to pin opponents.');
      return;
    }
    if (!cleanOurClanTag) {
      setOpponentProfileError('Set our clan tag before pinning an opponent.');
      return;
    }
    const targetTag = cleanOpponentTag || normalizeTag(opponentProfile?.clan?.tag ?? '');
    if (!targetTag) {
      setOpponentProfileError('Load an opponent before pinning.');
      return;
    }
    try {
      await fetch('/api/war/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ourClanTag: cleanOurClanTag,
          opponentTag: targetTag,
          profileData: opponentProfile,
        }),
      });
      setOpponentProfileError(null);
      setOpponentProfileMessage(`Pinned opponent ${targetTag} for ${cleanOurClanTag}.`);
    } catch (error) {
      setOpponentProfileError('Failed to pin opponent. Try again.');
      console.warn('[WarCenter] Failed to pin opponent manually', error);
    }
  }, [cleanOurClanTag, cleanOpponentTag, opponentProfile, canManageWarPlans]);

  // DISABLED: Auto-fetching opponent profile from URL params or pinned - now manual only
  // Users must click "Analyze Opponent" or "Sync Opponent" to fetch
  useEffect(() => {
    const sp = search;
    if (!sp) return;
    const qOpp = sp.get('opponentTag');
    const qAuto = sp.get('autoDetect');
    const qOur = sp.get('ourClanTag');
    const qEnrich = sp.get('enrich');
    // Only update form inputs, don't auto-fetch
    if (qEnrich) setEnrichLevel(Math.max(4, Math.min(50, Number(qEnrich) || 12)));
    if (qOur) setOurClanTagInput(qOur);
    if (qAuto != null) {
      const auto = qAuto === 'true';
      setAutoDetectOpponent(auto);
    }
    if (qOpp) {
      setOpponentClanTagInput(qOpp);
    }

    // DISABLED: Auto-loading pinned opponent
    // const loadPinned = async () => {
    //   const tag = cleanOurClanTag;
    //   if (!tag) return;
    //   try {
    //     const res = await fetch(`/api/war/pin?ourClanTag=${encodeURIComponent(tag)}`, {
    //       cache: 'no-store',
    //     });
    //     const body = await res.json();
    //     if (res.ok && body?.success && body?.data?.opponent_tag) {
    //       setAutoDetectOpponent(false);
    //       setOpponentClanTagInput(body.data.opponent_tag);
    //       if (body.data.profile_data) {
    //         setOpponentProfile(body.data.profile_data);
    //         if (body.data.profile_data?.clan?.name) {
    //           setOpponentClanName(body.data.profile_data.clan.name);
    //         }
    //       } else {
    //         await fetchOpponentProfile({ pin: false });
    //       }
    //     }
    //   } catch (error) {
    //     console.warn('[WarCenter] Failed to load pinned opponent', error);
    //   }
    // };
    // void loadPinned();
  }, [search, cleanOurClanTag]);

  const runMatchupAnalysis = useCallback(async () => {
    if (!canRunWarAnalysisPermission) {
      setAnalysisError('You do not have permission to run matchup analysis.');
      return;
    }
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

      const missingOur = normalizedOurSelection.filter(
        (tag) => !ourSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
      );
      const missingOpponent = normalizedOpponentSelection.filter(
        (tag) => !opponentSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
      );

      if (missingOur.length || missingOpponent.length) {
        setAnalysisError(
          missingOpponent.length
            ? 'Opponent roster data still loading. Wait a moment and retry.'
            : 'Our roster data still loading. Wait a moment and retry.',
        );
        setRunningAnalysis(false);
        return;
      }

      const payload: MatchupPayload = {
        ourClanTag: normalizedOurClanTag || undefined,
        opponentClanTag: normalizedOpponentTag,
        ourSelected: normalizedOurSelection,
        opponentSelected: normalizedOpponentSelection,
        ourRoster: ourSelectedRoster,
        opponentRoster: opponentSelectedRoster,
        useAI,
        opponentClanName: opponentClanName || savedPlan?.opponentClanName || null,
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
      const matchupResponse = body.data as MatchupResponse;
      setMatchup(matchupResponse);
      if (matchupResponse?.opponentClanName) {
        setOpponentClanName(matchupResponse.opponentClanName);
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Failed to generate matchup analysis');
    } finally {
      setRunningAnalysis(false);
    }
  }, [
    canRunWarAnalysisPermission,
    normalizedOpponentTag,
    normalizedOurClanTag,
    normalizedOpponentSelection,
    normalizedOurSelection,
    ourRoster,
    opponentRoster,
    useAI,
    opponentClanName,
    savedPlan,
  ]);

  const hasAutoLoadedOurRoster = useRef(false);
  const autoLoadedClanRef = useRef<string | null>(null);
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
    if (!normalizedOurClanTag || loadingOurRoster) return;
    if (autoLoadedClanRef.current === normalizedOurClanTag && hasAutoLoadedOurRoster.current) return;
    hasAutoLoadedOurRoster.current = true;
    autoLoadedClanRef.current = normalizedOurClanTag;
    const preserveSelection = Boolean(pendingPlanRef.current);
    void fetchOurRoster({ preserveSelection });
  }, [normalizedOurClanTag, fetchOurRoster, loadingOurRoster]);

  useEffect(() => {
    planLoadedRef.current = false;
    pendingPlanRef.current = null;
    setSavedPlan(null);
    setUseAI(true);
    setOpponentClanName('');
  }, [normalizedOurClanTag]);

  useEffect(() => {
    if (!savedPlan) return;
    if (!opponentClanName || savedPlan.opponentClanName === opponentClanName) return;
    const nextPlan = { ...savedPlan, opponentClanName };
    setSavedPlan(nextPlan);
    savePlanToLocal(nextPlan);
  }, [opponentClanName, savedPlan, savePlanToLocal]);

  const applyPlan = useCallback(
    (plan: SavedPlan, options?: { message?: string }) => {
      const normalizedUseAI =
        plan.useAI !== undefined
          ? plan.useAI
          : plan.analysis
            ? plan.analysis.briefing?.source === 'openai'
            : true;
      const nextPlan: SavedPlan = {
        ...plan,
        useAI: normalizedUseAI,
        opponentClanName: plan.opponentClanName ?? opponentClanName ?? null,
      };

      pendingPlanRef.current = nextPlan;
      setSavedPlan(nextPlan);
      savePlanToLocal(nextPlan);
      setPlanError(null);
      setUseAI(Boolean(normalizedUseAI));
      setOpponentClanName(nextPlan.opponentClanName ?? opponentClanName ?? '');
      if (options?.message) {
        setPlanMessage(options.message);
      } else {
        const statusNote = nextPlan.analysisStatus ? ` — analysis: ${nextPlan.analysisStatus}` : '';
        setPlanMessage(`Plan loaded vs ${nextPlan.opponentClanName || nextPlan.opponentClanTag}${statusNote}`);
      }
      setOpponentClanTagInput(nextPlan.opponentClanTag);
      setOurSelection(new Set(nextPlan.ourSelection ?? []));
      setOpponentSelection(new Set(nextPlan.opponentSelection ?? []));
      if (nextPlan.analysis) {
        setMatchup({ analysis: nextPlan.analysis });
      } else {
        setMatchup(null);
      }
    },
    [savePlanToLocal, opponentClanName],
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
        applyPlan(plan, { message: `Restored plan vs ${plan.opponentClanName || plan.opponentClanTag}${statusNote}` });
      } else {
        setSavedPlan(null);
      }

      setPlanLoading(false);
    },
    [loadPlanFromLocal, applyPlan],
  );

  // DISABLED: Auto-fetching opponent roster - now manual only
  // useEffect(() => {
  //   if (autoFetchOpponentRef.current) {
  //     clearTimeout(autoFetchOpponentRef.current);
  //     autoFetchOpponentRef.current = null;
  //   }
  //   if (!normalizedOpponentTag || normalizedOpponentTag.length < 5) {
  //     setOpponentRoster([]);
  //     setOpponentSelection(new Set());
  //     setOpponentError(null);
  //     return;
  //   }
  //   autoFetchOpponentRef.current = window.setTimeout(() => {
  //     const preserveSelection = Boolean(pendingPlanRef.current);
  //     void fetchOpponents({ preserveSelection });
  //   }, 600);
  //   return () => {
  //     if (autoFetchOpponentRef.current) {
  //       clearTimeout(autoFetchOpponentRef.current);
  //       autoFetchOpponentRef.current = null;
  //     }
  //   };
  // }, [normalizedOpponentTag, fetchOpponents]);

  // Auto-load saved plans once our roster is available
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

  // Only poll for analysis status when actively queued/running, and stop after completion or timeout
  useEffect(() => {
    if (!savedPlan) return;
    const status = (savedPlan.analysisStatus ?? '').toLowerCase();
    if (!['queued', 'running'].includes(status)) return;

    let ignore = false;
    let lastStatus = savedPlan.analysisStatus ?? null;
    let pollCount = 0;
    const MAX_POLLS = 120; // Max 5 minutes (120 * 5s = 600s)
    let intervalId: number | null = null;

    const refresh = async () => {
      if (pollCount >= MAX_POLLS) {
        // Stop polling after max attempts
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }
      pollCount++;
      
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
          // Stop polling if status is no longer queued/running
          if (latestStatus && !['queued', 'running'].includes(latestStatus.toLowerCase())) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
      } catch (error) {
        if (!ignore) {
          console.warn('[WarPlanning] Failed to refresh plan analysis', error);
        }
      }
    };

    // Use longer interval to reduce "vibrating" - poll every 5 seconds instead of 2.5
    intervalId = window.setInterval(() => {
      void refresh();
    }, 5000);

    void refresh();

    return () => {
      ignore = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
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
  const selectionReady =
    normalizedOurSelection.length > 0 &&
    normalizedOpponentSelection.length > 0 &&
    !!normalizedOpponentTag;
  const canRunAnalysis = canRunWarAnalysisPermission && selectionReady;
  const canSavePlan =
    canManageWarPlans &&
    !!normalizedOurClanTag &&
    !!normalizedOpponentTag &&
    normalizedOurSelection.length > 0 &&
    normalizedOpponentSelection.length > 0;

  const currentAnalysis = savedPlan?.analysis ?? matchup?.analysis ?? null;
  const currentBriefingSource = currentAnalysis
    ? currentAnalysis.briefing?.source === 'openai'
      ? `AI (${currentAnalysis.briefing?.model ?? 'OpenAI'})`
      : 'Heuristic'
    : null;

  const hasRostersReady = ourRosterLoaded && opponentRosterLoaded;
  const hasSelections = normalizedOurSelection.length > 0 && normalizedOpponentSelection.length > 0;
  const hasAnalysis = Boolean(matchup);
  const hasPlanArtifacts = Boolean(savedPlan);
  const workflowComplete = hasRostersReady && hasSelections && hasAnalysis && hasPlanArtifacts;

  const currentWorkflowStep = useMemo(() => {
    if (!hasRostersReady) return 1;
    if (!hasSelections) return 2;
    if (!hasAnalysis) return 3;
    if (!hasPlanArtifacts) return 4;
    return 4;
  }, [hasRostersReady, hasSelections, hasAnalysis, hasPlanArtifacts]);

  const workflowSteps = useMemo(() => {
    const resolveStatus = (step: number): 'complete' | 'current' | 'upcoming' => {
      if (workflowComplete) {
        return 'complete';
      }
      if (step < currentWorkflowStep) return 'complete';
      if (step === currentWorkflowStep) return 'current';
      return 'upcoming';
    };
    return [
      {
        number: 1,
        title: 'Load Rosters',
        description: 'Pull our clan & opponent data.',
        status: resolveStatus(1),
      },
      {
        number: 2,
        title: 'Select Players',
        description: 'Choose attackers and targets.',
        status: resolveStatus(2),
      },
      {
        number: 3,
        title: 'Analyze',
        description: 'Run AI/heuristic matchup analysis.',
        status: resolveStatus(3),
      },
      {
        number: 4,
        title: 'Review & Share',
        description: 'Save plans and copy briefs.',
        status: resolveStatus(4),
      },
    ];
  }, [currentWorkflowStep, workflowComplete]);

  const opponentThChips = useMemo(() => {
    if (!opponentProfile) return [] as Array<{ th: string; count: number }>;
    return Object.entries(opponentProfile.thDistribution)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([th, count]) => ({ th, count }));
  }, [opponentProfile]);

  const canFetchOpponentProfile = useMemo(() => {
    if (autoDetectOpponent) {
      return Boolean(cleanOurClanTag);
    }
    return Boolean(cleanOpponentTag);
  }, [autoDetectOpponent, cleanOpponentTag, cleanOurClanTag]);

  const isSameOpponentLoaded = useMemo(() => {
    if (!opponentProfile) return false;
    if (!cleanOpponentTag) return false;
    return normalizeTag(opponentProfile.clan.tag ?? '') === cleanOpponentTag;
  }, [opponentProfile, cleanOpponentTag]);

  const handleSavePlan = useCallback(async () => {
    if (!canManageWarPlans) {
      setPlanError('You do not have permission to save war plans.');
      return;
    }
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
      useAI,
      opponentClanName,
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

      const missingOur = normalizedOurSelection.filter(
        (tag) => !ourSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
      );
      const missingOpponent = normalizedOpponentSelection.filter(
        (tag) => !opponentSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
      );

      if (missingOur.length || missingOpponent.length) {
        setPlanError(
          missingOpponent.length
            ? 'Opponent roster hasn’t finished loading. Wait a moment before saving.'
            : 'Our roster hasn’t finished loading. Wait a moment before saving.',
        );
        setSavingPlan(false);
        return;
      }

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
          useAI,
          opponentClanName,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const savedPlanResponse = body.data as SavedPlan | null;
      if (!savedPlanResponse) {
        throw new Error('Server did not return a saved plan.');
      }
      savedPlanResponse.useAI = savedPlanResponse.useAI ?? useAI;
      savedPlanResponse.opponentClanName =
        savedPlanResponse.opponentClanName ?? opponentClanName ?? null;
      if (!savedPlanResponse.opponentClanName && opponentClanName) {
        savedPlanResponse.opponentClanName = opponentClanName;
      }
      applyPlan(savedPlanResponse, {
        message: `Plan saved vs ${savedPlanResponse.opponentClanName || savedPlanResponse.opponentClanTag}${savedPlanResponse.analysisStatus ? ` — analysis: ${savedPlanResponse.analysisStatus}` : ''}`,
      });
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  }, [
    canManageWarPlans,
    canSavePlan,
    normalizedOurClanTag,
    normalizedOpponentTag,
    normalizedOurSelection,
    normalizedOpponentSelection,
    applyPlan,
    ourRoster,
    opponentRoster,
    useAI,
    opponentClanName,
  ]);

  const handleReloadSavedPlan = useCallback(() => {
    if (!savedPlan) {
      // Try to load from server/local storage
      if (normalizedOurClanTag) {
        void loadPlan(normalizedOurClanTag);
      }
      return;
    }
    const statusNote = savedPlan.analysisStatus ? ` — analysis: ${savedPlan.analysisStatus}` : '';
    applyPlan(savedPlan, {
      message: `Plan loaded vs ${savedPlan.opponentClanName || savedPlan.opponentClanTag}${statusNote}`,
    });
  }, [applyPlan, savedPlan, normalizedOurClanTag, loadPlan]);

  const handleRegenerateAnalysis = useCallback(async () => {
    if (!canRunWarAnalysisPermission) {
      setPlanError('You do not have permission to re-run analysis.');
      return;
    }
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

    const missingOur = Array.from(ourTags).filter(
      (tag) => !ourSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
    );
    const missingOpponent = Array.from(opponentTags).filter(
      (tag) => !opponentSelectedRoster.some((member) => normalizeTag(member.tag ?? '') === tag),
    );

    if (missingOur.length || missingOpponent.length) {
      setPlanError(
        missingOpponent.length
          ? 'Opponent roster hasn’t finished loading. Wait a moment before regenerating.'
          : 'Our roster hasn’t finished loading. Wait a moment before regenerating.',
      );
      return;
    }

    try {
      const res = await fetch('/api/v2/war-planning/plan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ourClanTag: savedPlan.ourClanTag,
          opponentClanTag: savedPlan.opponentClanTag,
          ourRoster: ourSelectedRoster,
          opponentRoster: opponentSelectedRoster,
          useAI,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const updated = body.data as SavedPlan | null;
      if (!updated) {
        throw new Error('Server did not return an updated plan.');
      }
      updated.useAI = updated.useAI ?? useAI;
      updated.opponentClanName =
        updated.opponentClanName ?? opponentClanName ?? savedPlan.opponentClanName ?? null;
      const statusMessage = `Analysis requeued — status: ${updated.analysisStatus ?? 'queued'}${updated.analysisJobId ? ` (job ${shortId(updated.analysisJobId)})` : ''}`;
      applyPlan(updated, { message: statusMessage });
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to re-run analysis.');
    }
  }, [savedPlan, ourRoster, opponentRoster, applyPlan, useAI, opponentClanName, canRunWarAnalysisPermission]);

  const handleCopyPlan = useCallback(async () => {
    if (!savedPlan) {
      setPlanError('No saved plan to copy.');
      return;
    }
    setPlanError(null);
    setPlanMessage(null);
    const analysis = savedPlan.analysis ?? matchup?.analysis ?? null;
    const opponentNameForCopy = opponentClanName || savedPlan.opponentClanName || null;
    const planForCopy: SavedPlan = { ...savedPlan, opponentClanName: opponentNameForCopy };
    const report = buildAnalysisReport(analysis, planForCopy);
    const aiRequest = analysis?.aiInput ?? null;
    const payload = {
      plan: planForCopy,
      analysis,
      ourRoster,
      opponentRoster,
      exportedAt: new Date().toISOString(),
      report,
      useAI,
      aiRequest,
      opponentClanName: opponentNameForCopy,
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = `${ORACLE_DIRECTIVE}\n\n${report}\n\n---\n\n${JSON.stringify(payload, null, 2)}`;
        await navigator.clipboard.writeText(text);
        setPlanMessage('Plan payload + report copied to clipboard.');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (error) {
      setPlanError('Failed to copy plan to clipboard.');
    }
  }, [savedPlan, matchup, ourRoster, opponentRoster, useAI, opponentClanName]);

  const handleCopyDiscordPlan = useCallback(async () => {
    const analysis = savedPlan?.analysis ?? matchup?.analysis ?? null;
    const fallbackOur =
      savedPlan?.ourClanTag || normalizedOurClanTag || (clanName ? `Clan ${clanName}` : 'Our Clan');
    const fallbackOpponentTag = savedPlan?.opponentClanTag || normalizedOpponentTag || 'Opponent';
    const derivedOpponentName =
      savedPlan?.opponentClanName ||
      opponentClanName ||
      (opponentProfile?.clan?.name ?? null);

    const text = buildDiscordWarBrief(
      analysis,
      savedPlan ?? null,
      fallbackOur,
      fallbackOpponentTag,
      clanName || null,
      derivedOpponentName,
    );
    if (!text) {
      setPlanError('Run analysis before copying a Discord brief.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setPlanMessage('Discord-ready brief copied to clipboard.');
    } catch (error) {
      setPlanError('Failed to copy Discord brief.');
    }
  }, [
    savedPlan,
    matchup,
    normalizedOurClanTag,
    normalizedOpponentTag,
    clanName,
    opponentClanName,
  ]);

  const handleLoadPlanClick = useCallback(() => {
    if (!normalizedOurClanTag) {
      setPlanError('Set our clan tag before loading a saved plan.');
      return;
    }
    void loadPlan(normalizedOurClanTag);
  }, [normalizedOurClanTag, loadPlan]);

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
          <GlassCard className="p-6 text-center text-sm text-muted-foreground">
            Checking war-planning permissions…
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  if (permissionsError) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
          <GlassCard className="p-6 text-center text-sm text-destructive">
            {permissionsError || 'Unable to load permissions for War Center.'}
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  if (!canViewWarPrep) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
          <GlassCard className="p-6 text-center">
            <p className="text-lg font-semibold">War Center is restricted</p>
            <p className="text-sm text-muted-foreground">
              Your access level does not include War Prep visibility. Ask a leader to grant permission.
            </p>
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout clanName={clanName || undefined}>
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-6 p-4 md:p-6">
        <Breadcrumbs className="mb-2" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-3xl font-bold">⚔️ War Center</h1>
              <p className="text-sm text-muted-foreground">
                {opponentProfile
                  ? `Analyzing ${opponentProfile.clan.name ?? 'opponent'} (${opponentProfile.clan.tag})`
                  : 'Prep your opponent and build the war plan from a single workspace.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(event) => setUseAI(event.target.checked)}
                className="h-4 w-4"
              />
              <span className="flex flex-col leading-tight">
                <Tooltip content={TOOLTIP_CONTENT['AI Analysis']?.content ?? 'Enables AI-generated matchup intel'}>
                  <span className="inline-flex items-center gap-1">
                    AI Analysis
                    <span className="text-xs text-muted-foreground">ⓘ</span>
                  </span>
                </Tooltip>
                {currentBriefingSource && (
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Current: {currentBriefingSource}
                  </span>
                )}
              </span>
            </label>
            <div className="flex items-center gap-2 text-sm">
              <Tooltip content={TOOLTIP_CONTENT['Enrich Level']?.content ?? 'Controls how many top players to enrich'}>
                <span className="text-xs uppercase text-muted-foreground inline-flex items-center gap-1">
                  Enrich
                  <span className="text-[10px]">ⓘ</span>
                </span>
              </Tooltip>
              <input
                type="range"
                min={4}
                max={50}
                value={enrichLevel}
                onChange={(event) => setEnrichLevel(Math.max(4, Math.min(50, Number(event.target.value) || 12)))}
                className="h-1.5 w-32 accent-primary"
              />
              <span className="w-12 text-right text-xs text-muted-foreground">Top {enrichLevel}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => fetchOpponentProfile()}
              disabled={!canFetchOpponentProfile || opponentProfileLoading}
              loading={opponentProfileLoading}
            >
              {autoDetectOpponent ? 'Sync Opponent' : 'Fetch & Pin'}
            </Button>
          </div>
        </div>

        <WorkflowSteps steps={workflowSteps} />

        <div className="space-y-6">
          <CollapsibleSection
            title="Step 1 · Load Rosters"
            storageKey="war-workflow-step-1"
            defaultExpanded={currentWorkflowStep === 1}
            icon={<span className="text-xs text-muted-foreground">1</span>}
          >
            <div className="space-y-4">
              <GlassCard className="space-y-4 p-4">
                <SectionTitle title="Opponent Profile">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => fetchOpponentProfile()}
                      disabled={!canFetchOpponentProfile || opponentProfileLoading || (isSameOpponentLoaded && !autoDetectOpponent)}
                      loading={opponentProfileLoading}
                    >
                      {opponentProfileLoading ? 'Fetching…' : 'Analyze Opponent'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePinOpponent}
                      disabled={!canManageWarPlans || (!opponentProfile && !cleanOpponentTag)}
                    >
                      Pin Opponent
                    </Button>
                    {opponentProfile && (
                      <Button
                        variant="outline"
                        onClick={handleClearOpponent}
                        disabled={!canManageWarPlans}
                        className="text-destructive border-destructive hover:bg-destructive/10"
                        title="Clear opponent and record in war history"
                      >
                        Reset & Record
                      </Button>
                    )}
                  </div>
                </SectionTitle>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-muted-foreground">Opponent Tag</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      placeholder="#OPPONENT"
                      value={opponentClanTagInput}
                      onChange={(event) => setOpponentClanTagInput(event.target.value)}
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={autoDetectOpponent}
                        onChange={(event) => setAutoDetectOpponent(event.target.checked)}
                        className="h-4 w-4"
                      />
                      Auto-detect opponent (uses last synced war)
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-muted-foreground">Detected Opponent</label>
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      {opponentProfile ? (
                        <div className="space-y-1">
                          <div className="font-semibold">{opponentProfile.clan.name ?? 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">
                            {opponentProfile.clan.tag} • Level {opponentProfile.clan.level ?? '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {opponentProfile.clan.warRecord
                              ? `${opponentProfile.clan.warRecord.wins ?? 0}W-${opponentProfile.clan.warRecord.losses ?? 0}L ${
                                  opponentProfile.clan.warRecord.winStreak ? `• Streak ${opponentProfile.clan.warRecord.winStreak}` : ''
                                }`
                              : 'No war log'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No opponent fetched yet.</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-muted-foreground">Town Hall Spread</label>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {opponentThChips.length ? (
                        opponentThChips.map((chip) => (
                          <span key={chip.th} className="rounded-full border border-border px-3 py-1">
                            TH{chip.th}: {chip.count}
                          </span>
                        ))
                      ) : (
                        <span>No distribution yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <GlassCard className="p-4">
                  <SectionTitle title="Our Roster">
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => fetchOurRoster()} disabled={loadingOurRoster}>
                        {loadingOurRoster ? 'Loading…' : 'Refresh'}
                      </Button>
                    </div>
                  </SectionTitle>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                      Our Clan Tag
                      <input
                        value={ourClanTagInput}
                        onChange={(event) => setOurClanTagInput(event.target.value)}
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
                        disabled={!canManageWarPlans}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Load your roster to start selecting participants.</p>
                    )}
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <SectionTitle title="Opponent Roster">
                    <Button variant="secondary" onClick={() => fetchOpponents()} disabled={loadingOpponents}>
                      {loadingOpponents ? 'Loading…' : 'Fetch Opponent'}
                    </Button>
                  </SectionTitle>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                      Opponent Clan Tag
                      <input
                        value={opponentClanTagInput}
                        onChange={(event) => setOpponentClanTagInput(event.target.value)}
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
                    {opponentClanName && (
                      <p className="text-sm text-muted-foreground">
                        Opponent: <span className="font-medium">{opponentClanName}</span>
                      </p>
                    )}
                    {opponentError && <p className="text-sm text-destructive">{opponentError}</p>}
                    {opponentRosterLoaded ? (
                      <RosterList
                        roster={opponentRoster}
                        selection={opponentSelection}
                        onToggle={(tag) => toggleSelection(tag, 'opponent')}
                        emptyMessage="No opponent members returned."
                        disabled={!canManageWarPlans}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Fetch the opponent roster to choose targets for enrichment.</p>
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Step 2 · Select Players & Prep Plan"
            storageKey="war-workflow-step-2"
            defaultExpanded={currentWorkflowStep === 2}
            icon={<span className="text-xs text-muted-foreground">2</span>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassCard className="p-4 space-y-4">
                <SectionTitle title="Selection Summary">
                  {(ourSelection.size > 0 || opponentSelection.size > 0) && (
                    <Button variant="outline" onClick={handleClearSelections} disabled={!canManageWarPlans}>
                      Clear selections
                    </Button>
                  )}
                </SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Our selections</p>
                    <p className="text-3xl font-semibold">{ourSelection.size}</p>
                    <p className="text-xs text-muted-foreground">Pick the attackers we&rsquo;ll assign.</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Opponent picks</p>
                    <p className="text-3xl font-semibold">{opponentSelection.size}</p>
                    <p className="text-xs text-muted-foreground">Target bases to enrich + analyze.</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select at least one player on each side and set the opponent tag to unlock the analysis step.
                </p>
              </GlassCard>

              <GlassCard className="p-4 space-y-3">
                <SectionTitle title="Plan Actions" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={handleSavePlan} disabled={!canSavePlan || savingPlan}>
                    {savingPlan ? 'Saving…' : 'Save Plan'}
                  </Button>
                  <Button variant="outline" onClick={handleLoadPlanClick} disabled={!normalizedOurClanTag || planLoading}>
                    {planLoading ? 'Loading…' : 'Load Saved Plan'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saving stores your selections, analysis, and opponent info so you can resume prep instantly.
                </p>
                {planLoading && <span className="text-xs text-muted-foreground">Loading saved plan…</span>}
                {planMessage && <span className="text-xs text-emerald-400">{planMessage}</span>}
                {planError && <span className="text-xs text-destructive">{planError}</span>}
              </GlassCard>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Step 3 · Run Matchup Analysis"
            storageKey="war-workflow-step-3"
            defaultExpanded={currentWorkflowStep === 3}
            icon={<span className="text-xs text-muted-foreground">3</span>}
          >
            <GlassCard className="p-4 space-y-4">
              <SectionTitle title="Matchup Analysis">
                <Button onClick={runMatchupAnalysis} disabled={!canRunAnalysis || runningAnalysis}>
                  {runningAnalysis ? 'Analyzing…' : 'Run Analysis'}
                </Button>
              </SectionTitle>
              <p className="text-xs text-muted-foreground">
                AI toggle and enrich controls live in the header. Increase enrich to deepen the scouting pool.
              </p>
              {!canRunAnalysis && (
                <p className="text-sm text-muted-foreground">
                  {canRunWarAnalysisPermission
                    ? 'Select at least one player on each side to run the matchup analysis.'
                    : 'Leadership permission is required to run matchup analysis.'}
                </p>
              )}
              {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
              {!matchup && (
                <p className="text-xs text-muted-foreground">Results will appear in Step 4 after the analysis completes.</p>
              )}
            </GlassCard>
          </CollapsibleSection>

          <CollapsibleSection
            title="Step 4 · Review & Share"
            storageKey="war-workflow-step-4"
            defaultExpanded={currentWorkflowStep === 4}
            icon={<span className="text-xs text-muted-foreground">4</span>}
          >
            <div className="space-y-4">
              {savedPlan && (
                <GlassCard className="p-4">
                  <SectionTitle title={`Saved Plan — vs ${savedPlan.opponentClanName || savedPlan.opponentClanTag}`}>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={handleReloadSavedPlan}>
                        {savedPlan ? 'Reload Plan' : 'Load Saved Plan'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleRegenerateAnalysis}
                        disabled={
                          !canRunWarAnalysisPermission ||
                          ['queued', 'running'].includes((savedPlan.analysisStatus ?? '').toLowerCase())
                        }
                      >
                        Re-run Analysis
                      </Button>
                      <Button onClick={handleCopyPlan}>Copy Payload</Button>
                      <Button variant="outline" onClick={handleCopyDiscordPlan}>
                        Copy Discord Brief
                      </Button>
                    </div>
                  </SectionTitle>
                  <p className="text-sm text-muted-foreground flex flex-wrap gap-2">
                    <span>Updated {formatTimestamp(savedPlan.updatedAt)}</span>
                    <span>• Analysis: {formatAnalysisStatus(savedPlan.analysisStatus)}</span>
                    {savedPlan.analysisVersion && <span>• v{savedPlan.analysisVersion}</span>}
                    {savedPlan.analysisJobId && <span>• Job {shortId(savedPlan.analysisJobId)}</span>}
                    {savedPlan.analysisStartedAt && <span>• Started {formatTimestamp(savedPlan.analysisStartedAt)}</span>}
                    {savedPlan.analysisCompletedAt && (
                      <span>• Completed {formatTimestamp(savedPlan.analysisCompletedAt)}</span>
                    )}
                    {savedPlan.analysis?.briefing && (
                      <span>• Briefing: {formatBriefingSource(savedPlan.analysis.briefing)}</span>
                    )}
                    {savedPlan.opponentClanName && <span>• Opponent: {savedPlan.opponentClanName}</span>}
                  </p>
                </GlassCard>
              )}

              {matchup ? (
                <MatchupResult matchup={matchup} ourSelection={ourSelection} opponentSelection={opponentSelection} />
              ) : (
                <GlassCard className="p-4 text-sm text-muted-foreground">
                  Run an analysis to generate matchup metrics, recommendations, and slot breakdowns.
                </GlassCard>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </DashboardLayout>
  );
};

type MatchupPayload = {
  ourClanTag?: string;
  opponentClanTag: string;
  ourSelected: string[];
  opponentSelected: string[];
  ourRoster?: RosterMember[];
  opponentRoster?: RosterMember[];
  useAI?: boolean;
  opponentClanName?: string | null;
};

const RosterList: React.FC<{
  roster: RosterMember[];
  selection: Set<string>;
  onToggle: (tag: string) => void;
  emptyMessage: string;
  disabled?: boolean;
}> = ({ roster, selection, onToggle, emptyMessage, disabled = false }) => {
  if (!roster.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {roster.map((player) => {
        const isSelected = selection.has(player.tag);
        const isOptedIn = player.warPreference === 'in';
        return (
          <label
            key={player.tag}
            className={`flex flex-col gap-1 rounded border px-3 py-2 transition ${
              isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
            } ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isOptedIn && (
                  <span 
                    className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" 
                    title="War opt-in: This player has opted in to clan wars"
                  />
                )}
                <span className="font-medium text-sm truncate">{player.name}</span>
              </div>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  if (!disabled) {
                    onToggle(player.tag);
                  }
                }}
                disabled={disabled}
                className="h-4 w-4 flex-shrink-0"
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
        <MetricCard
          label="Confidence"
          value={`${analysis.summary.confidence.toFixed(1)}%`}
          tooltipKey="Confidence Rating"
        />
        <MetricCard label="Outlook" value={analysis.summary.outlook} />
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
            Generated {formatTimestamp(briefing.generatedAt)} • Source: {formatBriefingSource(briefing)}
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
              { text: `Max TH diff: ${formatSignedNumber(metrics.townHall.maxTownHallDiff, 0)}`, tooltipKey: 'TH Delta' },
              { text: `High-tier edge: ${formatSignedNumber(metrics.townHall.highTownHallEdge, 0)}`, tooltipKey: 'TH Delta' },
              `Our spread: ${summarizeDistribution(metrics.townHall.ourDistribution)}`,
              `Opponent spread: ${summarizeDistribution(metrics.townHall.opponentDistribution)}`,
            ]}
          />
          <InsightCard
            title="Hero Firepower"
            items={[
              { text: `Average heroes: ${formatSignedNumber(metrics.heroFirepower.averageHeroDelta, 1)}`, tooltipKey: 'Hero Delta' },
              { text: `Top 5 hero delta: ${formatSignedNumber(metrics.heroFirepower.topFiveHeroDelta, 1)}`, tooltipKey: 'Hero Delta' },
              { text: `Hero depth delta: ${formatSignedNumber(metrics.heroFirepower.heroDepthDelta, 1)}`, tooltipKey: 'Hero Delta' },
            ]}
          />
          <InsightCard
            title="War Experience"
            items={[
              { text: `Median war stars: ${formatSignedNumber(metrics.warExperience.medianWarStarDelta, 0)}`, tooltipKey: 'War Stars Delta' },
              { text: `Veteran edge (≥150 stars): ${formatSignedNumber(metrics.warExperience.veteranCountDelta, 0)}`, tooltipKey: 'War Stars Delta' },
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

type InsightItem = string | { text: string; tooltipKey?: string };

const InsightCard: React.FC<{ title: string; items: InsightItem[] }> = ({ title, items }) => (
  <GlassCard className="p-4 space-y-2">
    <h3 className="text-lg font-semibold">{title}</h3>
    <ul className="list-disc pl-4 space-y-1 text-sm">
      {items.map((item, idx) => {
        const resolved = typeof item === 'string' ? { text: item } : item;
        const tooltipContent = resolved.tooltipKey
          ? TOOLTIP_CONTENT[resolved.tooltipKey]?.content ?? resolved.text
          : null;
        const content = <span>{resolved.text}</span>;
        return (
          <li key={idx}>
            {tooltipContent ? (
              <Tooltip content={tooltipContent} position="top">
                {content}
              </Tooltip>
            ) : (
              content
            )}
          </li>
        );
      })}
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

function formatBriefingSource(briefing?: WarPlanBriefing | null): string {
  if (!briefing) return 'Heuristic';
  if (briefing.source === 'openai') {
    return briefing.model ? `OpenAI (${briefing.model})` : 'OpenAI';
  }
  return 'Heuristic';
}

function buildAnalysisReport(analysis: MatchupAnalysis | null | undefined, plan: SavedPlan | null): string {
  if (!analysis) {
    return 'War plan report unavailable — analysis has not finished running.';
  }

  const lines: string[] = [];
  const opponent = plan?.opponentClanName ?? plan?.opponentClanTag ?? 'Opponent';
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
  const briefingSource = analysis.briefing ? formatBriefingSource(analysis.briefing) : 'Heuristic';
  lines.push(
    `Generated ${formatTimestamp(analysis.briefing?.generatedAt ?? new Date().toISOString())} • Source: ${briefingSource}`,
  );
  return lines.join('\n');
}

function buildDiscordWarBrief(
  analysis: MatchupAnalysis | null | undefined,
  plan: SavedPlan | null,
  fallbackOur?: string | null,
  fallbackOpponent?: string | null,
  ourClanName?: string | null,
  opponentClanName?: string | null,
): string | null {
  if (!analysis) return null;
  const derivedOur = ourClanName || fallbackOur || plan?.ourClanTag || 'Our Clan';
  const derivedOpponent =
    opponentClanName || plan?.opponentClanName || fallbackOpponent || plan?.opponentClanTag || 'Opponent';

  const lines: string[] = [];
  lines.push(`**War Brief — ${derivedOur} vs ${derivedOpponent}**`);
  lines.push(`Confidence: ${analysis.summary.confidence.toFixed(1)}% (${analysis.summary.outlook})`);
  if (analysis.briefing?.headline) {
    lines.push(`Focus: ${analysis.briefing.headline}`);
  }

  if (analysis.metrics) {
    lines.push(`TH Edge: Δ${formatSignedNumber(analysis.metrics.townHall.highTownHallEdge, 0)} • Danger Slots: ${analysis.metrics.rosterReadiness.dangerSlots}`);
    lines.push(
      `Hero Firepower: avg ${formatSignedNumber(analysis.metrics.heroFirepower.averageHeroDelta, 1)}, top5 ${formatSignedNumber(
        analysis.metrics.heroFirepower.topFiveHeroDelta,
        1,
      )}`,
    );
  }

  const recs = (analysis.recommendations ?? []).slice(0, 3);
  if (recs.length) {
    lines.push('');
    lines.push('__Action Items__');
    recs.forEach((rec) => lines.push(`• ${rec}`));
  } else if (analysis.briefing?.bullets?.length) {
    lines.push('');
    lines.push('__Action Items__');
    analysis.briefing.bullets.slice(0, 3).forEach((bullet) => lines.push(`• ${bullet}`));
  }

  const slots = analysis.slotBreakdown ?? [];
  if (slots.length) {
    lines.push('');
    lines.push(`__Matchups__ (${slots.length})`);
    slots.forEach((slot) => {
      const oursRaw = slot.ourName || slot.ourTag || `Slot ${slot.slot}`;
      const ours = `**${oursRaw}**`;
      const opp = slot.opponentName || slot.opponentTag || 'Target';
      lines.push(`${slot.slot}) ${ours} → ${opp} — ${slot.summary}`);
    });
  }

  lines.push('');
  lines.push(
    `Generated ${formatTimestamp(analysis.briefing?.generatedAt ?? new Date().toISOString())} • Source: ${formatBriefingSource(analysis.briefing)}`,
  );
  return lines.join('\n');
}

export default WarCenterPage;
