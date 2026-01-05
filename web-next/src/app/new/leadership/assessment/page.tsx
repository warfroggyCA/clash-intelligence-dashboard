"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Crown,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Card } from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import { Input } from "@/components/new-ui/Input";
import { apiFetcher } from "@/lib/api/swr-fetcher";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";
import { showToast } from "@/lib/toast";
import { formatDistanceToNow } from "date-fns";
import type {
  LeadershipAssessmentResponse,
  LeadershipBand,
  LeadershipAssessmentWeights,
} from "@/lib/leadership-assessment/engine";

const BAND_LABELS: Record<LeadershipBand, string> = {
  successor: "Successor",
  lieutenant: "Lieutenant",
  core: "Core",
  watch: "Watch",
  liability: "Liability",
};

const BAND_STYLES: Record<LeadershipBand, string> = {
  successor: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  lieutenant: "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
  core: "bg-slate-500/15 text-slate-200 border-slate-400/40",
  watch: "bg-amber-500/15 text-amber-200 border-amber-400/40",
  liability: "bg-rose-500/15 text-rose-200 border-rose-400/40",
};

const flagLabels: Record<string, string> = {
  leech_risk: "Leech risk",
  inactive_risk: "Inactive",
  war_participation_low: "Missed wars",
  rushed_base_risk: "Rushed",
  no_ranked_league: "No league attacks",
  tenure_gate: "Tenure gate",
};

const formatScore = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(1);

const formatInt = (value: number | null | undefined) =>
  value == null ? "—" : Math.round(value).toLocaleString();

const formatDays = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value)}d`;

const DEFAULT_WEIGHTS: LeadershipAssessmentWeights = {
  war: 0.35,
  social: 0.25,
  reliability: 0.4,
};

const weightToPercent = (value: number) => Math.round(value * 100);

const normalizeWeightInput = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const percentToWeight = (value: number) => normalizeWeightInput(value) / 100;

const AssessmentSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="mt-6 space-y-4 animate-pulse">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={`assessment-skeleton-${index}`} className="rounded-2xl border border-white/5 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-44 rounded-full bg-white/10" />
            <div className="h-3 w-28 rounded-full bg-white/10" />
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-20 rounded-full bg-white/10" />
              <div className="h-6 w-16 rounded-full bg-white/10" />
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2 text-right">
              <div className="h-3 w-16 rounded-full bg-white/10" />
              <div className="h-6 w-12 rounded-full bg-white/10" />
            </div>
            <div className="h-8 w-24 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function LeadershipAssessmentPage() {
  const clanTag = normalizeTag(cfg.homeClanTag || "") || cfg.homeClanTag;
  const query = clanTag ? `/api/leadership/assessment?clanTag=${encodeURIComponent(clanTag)}` : null;
  const { data, error, isLoading, mutate } = useSWR<LeadershipAssessmentResponse>(query, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<LeadershipBand | "all">("all");
  const [actionOnly, setActionOnly] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedTags, setExpandedTags] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copiedBlurb, setCopiedBlurb] = useState<string | null>(null);
  const [weightInputs, setWeightInputs] = useState({
    war: weightToPercent(DEFAULT_WEIGHTS.war),
    social: weightToPercent(DEFAULT_WEIGHTS.social),
    reliability: weightToPercent(DEFAULT_WEIGHTS.reliability),
  });
  const [hasCustomWeights, setHasCustomWeights] = useState(false);
  const skipNextWeightSync = useRef(false);

  const results = data?.results ?? [];
  const assessment = data?.assessment;
  const activeWeights = assessment?.weights ?? DEFAULT_WEIGHTS;

  useEffect(() => {
    if (!assessment?.weights || hasCustomWeights) return;
    if (skipNextWeightSync.current) {
      skipNextWeightSync.current = false;
      return;
    }
    setWeightInputs({
      war: weightToPercent(assessment.weights.war),
      social: weightToPercent(assessment.weights.social),
      reliability: weightToPercent(assessment.weights.reliability),
    });
  }, [assessment?.weights, hasCustomWeights]);

  const normalizedInputs = useMemo(() => {
    const war = percentToWeight(weightInputs.war);
    const social = percentToWeight(weightInputs.social);
    const reliability = percentToWeight(weightInputs.reliability);
    const total = war + social + reliability;
    if (total <= 0) return DEFAULT_WEIGHTS;
    return {
      war: war / total,
      social: social / total,
      reliability: reliability / total,
    };
  }, [weightInputs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return results.filter((result) => {
      const matchesSearch =
        !term ||
        result.playerName.toLowerCase().includes(term) ||
        result.playerTag.toLowerCase().includes(term);
      const matchesBand = bandFilter === "all" || result.band === bandFilter;
      const matchesAction = !actionOnly || result.band === "successor" || result.band === "lieutenant" || result.band === "watch" || result.band === "liability";
      return matchesSearch && matchesBand && matchesAction;
    });
  }, [results, search, bandFilter, actionOnly]);

  const promotionCount = useMemo(
    () =>
      results.filter(
        (result) =>
          (result.band === "successor" || result.band === "lieutenant") &&
          isPromotionEligible(result.role)
      ).length,
    [results]
  );

  const riskCount = useMemo(
    () => results.filter((result) => result.band === "watch" || result.band === "liability").length,
    [results]
  );

  const calcContribution = (score: number | null | undefined, weight: number) => {
    if (score == null) return null;
    return score * weight;
  };

  const buildImprovementTips = (result: (typeof results)[number]) => {
    const tips: string[] = [];
    const scores = result.metrics.scores;

    if ((scores.war ?? 0) < 55) {
      tips.push("War: use both attacks consistently and focus on mirror targets.");
    }
    if ((scores.warParticipation ?? 0) < 65) {
      tips.push("Participation: avoid missed wars to lift reliability.");
    }
    if ((scores.social ?? 0) < 55) {
      tips.push("Support: increase donations and keep a positive ratio.");
    }
    if ((scores.capital ?? 0) < 55) {
      tips.push("Capital: complete raid weekend attacks and contribute gold.");
    }
    if ((scores.trophyPursuit ?? 0) < 55) {
      tips.push("League: complete weekly ranked attacks to stay placed.");
    }
    if ((scores.activity ?? 0) < 50) {
      tips.push("Activity: stay active daily (raids, donations, trophies).");
    }
    if ((scores.baseQuality ?? 0) < 60) {
      tips.push("Base: bring hero levels closer to TH max to reduce rush risk.");
    }
    if (result.flags.includes("tenure_gate")) {
      tips.push("Tenure: 30-day gate for Elder, 90-day gate for Co-leader.");
    }

    return tips.slice(0, 4);
  };

  function isPromotionEligible(role?: string | null) {
    const normalized = (role || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!normalized) return true;
    return normalized !== "leader" && normalized !== "coleader";
  }

  const topPromotions = useMemo(() =>
    results
      .filter((result) => (result.band === "successor" || result.band === "lieutenant") && isPromotionEligible(result.role))
      .slice(0, 6), [results]);
  const topRisks = useMemo(() =>
    results.filter((result) => result.band === "watch" || result.band === "liability").slice(0, 6), [results]);

  const handleRun = async () => {
    if (!clanTag) return;
    setIsRunning(true);
    try {
      const response = await fetch(`/api/leadership/assessment?clanTag=${encodeURIComponent(clanTag)}&run=true`, {
        method: "GET",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Run failed (${response.status})`);
      }
      showToast("Leadership assessment refreshed.", "success");
      mutate();
    } catch (err: any) {
      showToast(err?.message || "Failed to run assessment.", "error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyWeights = async () => {
    if (!clanTag) return;
    setIsRunning(true);
    setHasCustomWeights(true);
    try {
      const response = await fetch("/api/leadership/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag,
          runType: "manual",
          force: true,
          weights: normalizedInputs,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Run failed (${response.status})`);
      }
      showToast("Weights applied and assessment recalculated.", "success");
      mutate();
    } catch (err: any) {
      showToast(err?.message || "Failed to apply weights.", "error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyBlurb = async (playerTag: string, blurb: string) => {
    try {
      await navigator.clipboard.writeText(blurb);
      setCopiedBlurb(playerTag);
      showToast("Chat blurb copied.", "success");
      setTimeout(() => {
        setCopiedBlurb((current) => (current === playerTag ? null : current));
      }, 1800);
    } catch (err) {
      showToast("Failed to copy chat blurb.", "error");
    }
  };

  const resetWeights = () => {
    setHasCustomWeights(false);
    skipNextWeightSync.current = true;
    setWeightInputs({
      war: weightToPercent(DEFAULT_WEIGHTS.war),
      social: weightToPercent(DEFAULT_WEIGHTS.social),
      reliability: weightToPercent(DEFAULT_WEIGHTS.reliability),
    });
  };

  const lastRun = assessment?.createdAt
    ? formatDistanceToNow(new Date(assessment.createdAt), { addSuffix: true })
    : "Not yet run";

  const summary = assessment?.summary;
  const coverage = assessment?.coverage;

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6"
        style={{ boxShadow: "0 24px 48px -30px rgba(0,0,0,0.8)" }}
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 10% 20%, rgba(34,197,94,0.18) 0%, transparent 45%), radial-gradient(circle at 90% 20%, rgba(14,165,233,0.15) 0%, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-white" style={{ fontFamily: "var(--font-display)" }}>
                Leadership Assessment
              </h1>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200">
                CLV engine
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Auto-run leadership scoring with promotion and risk signals. Keep the complex math hidden, but surface
              the decisions that matter.
            </p>
            <div className="mt-2 text-xs text-slate-400">CLV = Composite Leadership Value.</div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>Last run: {lastRun}</span>
              {coverage ? (
                <span>
                  Coverage: War {coverage.warMetrics}/{summary?.assessmentCount ?? 0} • Capital {coverage.capitalMetrics}/{summary?.assessmentCount ?? 0}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={handleRun} disabled={isRunning}>
              <RefreshCw className="h-4 w-4" />
              {isRunning ? "Running" : "Run now"}
            </Button>
            <Button tone="ghost" onClick={() => mutate()}>
              Refresh
            </Button>
            <Link
              href="/new/leadership"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Leadership map
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span>Roster</span>
            <UserCog className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            {summary?.rosterCount ?? 0}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span>Promotion queue</span>
            <BadgeCheck className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-200">
            {promotionCount}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span>Demotion watch</span>
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <div className="mt-3 text-3xl font-black text-amber-200">
            {riskCount}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span>Signals tracked</span>
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-200">
            War {coverage?.warMetrics ?? 0} • Capital {coverage?.capitalMetrics ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Activity {coverage?.activityMetrics ?? 0} • Donations {coverage?.donationMetrics ?? 0}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Crown className="h-4 w-4 text-clash-gold" />Promotion candidates</span>}>
          {topPromotions.length ? (
            <div className="space-y-3">
              {topPromotions.map((result) => (
                <div key={result.playerTag} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-white">{result.playerName}</div>
                    <div className="truncate text-xs text-slate-400">{result.playerTag}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${BAND_STYLES[result.band]}`}>
                      {BAND_LABELS[result.band]}
                    </span>
                    <span className="text-lg font-black text-emerald-200">{formatScore(result.clvScore)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">No promotion candidates flagged yet.</div>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-300" />Demotion risks</span>}>
          {topRisks.length ? (
            <div className="space-y-3">
              {topRisks.map((result) => (
                <div key={result.playerTag} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-white">{result.playerName}</div>
                    <div className="truncate text-xs text-slate-400">{result.playerTag}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${BAND_STYLES[result.band]}`}>
                      {BAND_LABELS[result.band]}
                    </span>
                    <span className="text-lg font-black text-rose-200">{formatScore(result.clvScore)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">No demotion risks detected.</div>
          )}
        </Card>
      </div>

      <Card title="How the score works">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              CLV blends War, Social, and Reliability into a single 0-100 score. Higher means stronger
              leadership readiness. Each section below shows the raw signals that feed those three pillars.
            </p>
            <p>
              The weights let you decide what your clan values most. A war-heavy clan might weight War higher,
              while a culture-focused clan can lean into Social and Reliability.
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-400">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Signals used</div>
            <ul className="mt-3 space-y-2">
              <li>War: overall war performance, participation, consistency.</li>
              <li>Social: donation ratio, donation volume, capital contribution.</li>
              <li>Reliability: activity score, tenure, war participation, base quality, league participation.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Priority weights">
        <div className="grid gap-4 lg:grid-cols-3">
          {(["war", "social", "reliability"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>{key}</span>
                <span className="text-slate-200">{normalizeWeightInput(weightInputs[key])}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={weightInputs[key]}
                onChange={(event) =>
                  setWeightInputs((prev) => {
                    setHasCustomWeights(true);
                    return {
                      ...prev,
                      [key]: normalizeWeightInput(Number(event.target.value)),
                    };
                  })
                }
                className="mt-3 w-full accent-clash-gold"
              />
              <div className="mt-2 text-xs text-slate-400">
                Applied weight: {(normalizedInputs as any)[key].toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="primary" onClick={handleApplyWeights} disabled={isRunning}>
            Apply weights
          </Button>
          <Button tone="ghost" onClick={resetWeights}>
            Reset to default
          </Button>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 ml-auto">
            Active: {weightToPercent(activeWeights.war)} / {weightToPercent(activeWeights.social)} / {weightToPercent(activeWeights.reliability)}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Weights rebalance the Composite Leadership Value (CLV) and are saved with each assessment run.
        </p>
      </Card>

      <Card title="Assessment roster">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by name or tag"
            className="max-w-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {(["all", "successor", "lieutenant", "core", "watch", "liability"] as const).map((band) => (
              <Button
                key={band}
                tone={bandFilter === band ? "accentAlt" : "ghost"}
                className="h-10 px-4"
                onClick={() => setBandFilter(band)}
              >
                {band === "all" ? "All bands" : BAND_LABELS[band as LeadershipBand]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              tone={actionOnly ? "accentAlt" : "ghost"}
              className="h-10 px-4"
              onClick={() => setActionOnly((prev) => !prev)}
            >
              {actionOnly ? "Action only" : "All signals"}
            </Button>
            <Button
              tone={showDetails ? "accentAlt" : "ghost"}
              className="h-10 px-4"
              onClick={() => setShowDetails((prev) => !prev)}
            >
              {showDetails ? "Hide deep dive" : "Show deep dive"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error.message}
          </div>
        ) : null}

        {isLoading ? <AssessmentSkeleton /> : null}

        {!isLoading && !error && filtered.length === 0 ? (
          <div className="mt-6 text-sm text-slate-400">No assessments match this filter.</div>
        ) : null}

        <div className="mt-6 space-y-4">
          {filtered.map((result) => (
            <div key={result.playerTag} className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-white">{result.playerName}</div>
                      <div className="truncate text-xs text-slate-400">{result.playerTag}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${BAND_STYLES[result.band]}`}>
                      {BAND_LABELS[result.band]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 px-2 py-1">Role {result.role || "member"}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">TH {formatInt(result.townHall)}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Tenure {formatDays(result.tenureDays)}</span>
                    <Link
                      href={`/new/player/${encodeURIComponent(result.playerTag)}`}
                      className="rounded-full border border-white/10 px-2 py-1 text-clash-gold hover:text-clash-gold/80"
                    >
                      Profile
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CLV</div>
                    <div className="text-2xl font-black text-white">{formatScore(result.clvScore)}</div>
                  </div>
                  <div className="max-w-xs text-xs text-slate-300">
                    {result.recommendation}
                  </div>
                  <Button
                    tone="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() =>
                      setExpandedTags((prev) =>
                        prev.includes(result.playerTag)
                          ? prev.filter((tag) => tag !== result.playerTag)
                          : [...prev, result.playerTag]
                      )
                    }
                  >
                    {expandedTags.includes(result.playerTag) ? "Hide breakdown" : "View breakdown"}
                  </Button>
                </div>
              </div>
              {result.metrics.chatBlurb ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400">Chat blurb</span>
                    <Button
                      tone="ghost"
                      className="h-7 px-3 text-[11px]"
                      onClick={() => handleCopyBlurb(result.playerTag, result.metrics.chatBlurb as string)}
                    >
                      {copiedBlurb === result.playerTag ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="mt-2 text-slate-100">{result.metrics.chatBlurb}</div>
                </div>
              ) : null}

              {result.flags.length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  {result.flags.map((flag) => (
                    <span key={flag} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                      {flagLabels[flag] ?? flag}
                    </span>
                  ))}
                </div>
              ) : null}

              {(showDetails || expandedTags.includes(result.playerTag)) ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Scores</div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center justify-between"><span>War</span><span>{formatScore(result.metrics.scores.war)}</span></div>
                      <div className="flex items-center justify-between"><span>Social</span><span>{formatScore(result.metrics.scores.social)}</span></div>
                      <div className="flex items-center justify-between"><span>Reliability</span><span>{formatScore(result.metrics.scores.reliability)}</span></div>
                      <div className="flex items-center justify-between"><span>Activity</span><span>{formatScore(result.metrics.scores.activity)}</span></div>
                      <div className="mt-2 text-xs text-slate-400">
                        {result.metrics.raw.activityLevel ? `Level: ${result.metrics.raw.activityLevel}` : 'Level: —'}
                      </div>
                      <div
                        className="text-xs text-slate-500"
                        title={(result.metrics.raw.activityIndicators ?? []).join(', ')}
                      >
                        Signals:{' '}
                        {(result.metrics.raw.activityIndicators && result.metrics.raw.activityIndicators.length > 0)
                          ? `${result.metrics.raw.activityIndicators.slice(0, 3).join(', ')}${result.metrics.raw.activityIndicators.length > 3 ? ` +${result.metrics.raw.activityIndicators.length - 3} more` : ''}`
                          : 'None in last 7d'}
                      </div>
                      {result.metrics.raw.activityLastActiveAt ? (
                        <div className="text-xs text-slate-500">
                          Last activity {formatDistanceToNow(new Date(result.metrics.raw.activityLastActiveAt), { addSuffix: true })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Signals</div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center justify-between"><span>Donation ratio</span><span>{formatScore(result.metrics.scores.donationRatio)}</span></div>
                      <div className="flex items-center justify-between"><span>Capital</span><span>{formatScore(result.metrics.scores.capital)}</span></div>
                      <div className="flex items-center justify-between"><span>Base quality</span><span>{formatScore(result.metrics.scores.baseQuality)}</span></div>
                      <div className="flex items-center justify-between"><span>League participation</span><span>{formatScore(result.metrics.scores.trophyPursuit)}</span></div>
                      <div className="flex items-center justify-between"><span>War participation</span><span>{formatScore(result.metrics.scores.warParticipation)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">DNA & notes</div>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                      <div className="flex items-center justify-between"><span>Archetype</span><span>{result.metrics.archetype}</span></div>
                      <div className="text-xs text-slate-400">Elder eval: {result.metrics.elderRecommendation}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 md:col-span-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Score recipe</div>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                      {[
                        { label: "War", score: result.metrics.scores.war, weight: activeWeights.war },
                        { label: "Social", score: result.metrics.scores.social, weight: activeWeights.social },
                        { label: "Reliability", score: result.metrics.scores.reliability, weight: activeWeights.reliability },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{item.label}</span>
                            <span>{Math.round(item.weight * 100)}%</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span>{formatScore(item.score)}</span>
                            <span className="text-slate-300">
                              {formatScore(calcContribution(item.score, item.weight))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 md:col-span-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">How to improve</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                      {buildImprovementTips(result).map((tip) => (
                        <span key={tip} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                          {tip}
                        </span>
                      ))}
                      {buildImprovementTips(result).length === 0 ? (
                        <span className="text-slate-400">No major gaps detected.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
