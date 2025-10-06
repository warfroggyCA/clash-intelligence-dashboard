"use client";

import { useMemo } from "react";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { calculateAceScores, createAceInputsFromRoster, ACE_DEFAULT_WEIGHTS, ACE_DEFAULT_LOGISTIC_ALPHA, computeAceLogistic } from "@/lib/ace-score";
import type { AceScoreResult } from "@/lib/ace-score";
import type { Member } from "@/types";
import { GlassCard, TownHallBadge } from "@/components/ui";

interface AceLeaderboardCardProps {
  className?: string;
}

interface RankedPlayer extends AceScoreResult {
  member?: Member;
  strengths: string;
  availabilityPercent: number;
  townHallLevel?: number | null;
  componentBreakdown: Array<{ code: string; weight: number; value: number; weighted: number }>;
  core: number;
  logistic: number;
  availabilityMultiplier: number;
}

const ACE_FACTORS: Array<{ code: string; name: string; description: string; weight: string; details: string }> = [
  {
    code: "OAE",
    name: "Offense Above Expectation",
    description: "New stars vs base difficulty and cleanup role",
    weight: "40%",
    details: "Sum of ((new stars - expected) ÷ SD) per attack with +10% cleanup boost and war decay.",
  },
  {
    code: "DAE",
    name: "Defense Above Expectation",
    description: "Holds compared to what attackers should score",
    weight: "15%",
    details: "Expected stars conceded minus actual, normalized by TH gap and decayed by war age.",
  },
  {
    code: "PR",
    name: "Participation & Reliability",
    description: "War + capital usage streaks",
    weight: "20%",
    details: "0.55×war attacks used + 0.30×capital usage + 0.15×full-war streak (no shrinkage).",
  },
  {
    code: "CAP",
    name: "Capital Value",
    description: "Loot efficiency, finishers, one-hits",
    weight: "15%",
    details: "0.6×VPA z-score + 0.2×FinisherRate + 0.2×OneHitRate with k=8 shrinkage.",
  },
  {
    code: "DON",
    name: "Donation Culture",
    description: "Net giving without padding",
    weight: "10%",
    details: "Robust z(balance) + 0.5×z(ratio) capped ±2.5 to avoid donation padding.",
  },
];

const COMPONENT_WEIGHT_BY_CODE: Record<string, number> = {
  OAE: ACE_DEFAULT_WEIGHTS.ova,
  DAE: ACE_DEFAULT_WEIGHTS.dva,
  PR: ACE_DEFAULT_WEIGHTS.par,
  CAP: ACE_DEFAULT_WEIGHTS.cap,
  DON: ACE_DEFAULT_WEIGHTS.don,
};

const COMPONENT_MAP = [
  { key: 'ova' as const, code: 'OAE' },
  { key: 'dva' as const, code: 'DAE' },
  { key: 'par' as const, code: 'PR' },
  { key: 'cap' as const, code: 'CAP' },
  { key: 'don' as const, code: 'DON' },
];

export const AceLeaderboardCard: React.FC<AceLeaderboardCardProps> = ({ className = "" }) => {
  const roster = useDashboardStore((state) => state.roster);

  const topPlayers = useMemo<RankedPlayer[]>(() => {
    if (!roster?.members?.length) return [];

    const inputs = createAceInputsFromRoster(roster);
    if (!inputs.length) return [];

    const scores = calculateAceScores(inputs);
    const topFive = scores.slice(0, 5);

    const memberMap = new Map<string, Member>();
    for (const member of roster.members) {
      memberMap.set(member.tag, member);
    }

    return topFive.map((player) => {
      const member = memberMap.get(player.tag);
      const townHall = member?.townHallLevel ?? member?.th ?? null;
      let availability = player.availability ?? 1;
      let availabilityPercent = Math.round(availability * 100);

      const strengths = deriveStrengthSummary(player);

      let componentBreakdown = [
        { code: 'OAE', weight: COMPONENT_WEIGHT_BY_CODE.OAE, value: player.breakdown.ova.shrunk },
        { code: 'DAE', weight: COMPONENT_WEIGHT_BY_CODE.DAE, value: player.breakdown.dva.shrunk },
        { code: 'PR', weight: COMPONENT_WEIGHT_BY_CODE.PR, value: player.breakdown.par.shrunk },
        { code: 'CAP', weight: COMPONENT_WEIGHT_BY_CODE.CAP, value: player.breakdown.cap.shrunk },
        { code: 'DON', weight: COMPONENT_WEIGHT_BY_CODE.DON, value: player.breakdown.don.shrunk },
      ].map((entry) => ({
        ...entry,
        weighted: entry.weight * entry.value,
      }));

      let core = componentBreakdown.reduce((sum, entry) => sum + entry.weight * entry.value, 0);
      let logistic = computeAceLogistic(core, ACE_DEFAULT_LOGISTIC_ALPHA);

      const aceExtras = (member as any)?.extras?.ace;
      if (aceExtras) {
        const extrasComponents = Array.isArray(aceExtras.components)
          ? aceExtras.components
          : Array.isArray(aceExtras.componentBreakdown)
            ? aceExtras.componentBreakdown
            : null;

        if (extrasComponents?.length) {
          componentBreakdown = extrasComponents.map((comp: any) => {
            const code = (comp.code || comp.id || '').toString().toUpperCase();
            const weight = typeof comp.weight === 'number'
              ? comp.weight
              : COMPONENT_WEIGHT_BY_CODE[code] ?? 0;
            const value = typeof comp.value === 'number'
              ? comp.value
              : typeof comp.z === 'number'
                ? comp.z
                : 0;
            const weighted = typeof comp.weighted === 'number'
              ? comp.weighted
              : weight * value;
            return { code, weight, value, weighted };
          });
        }

        if (typeof aceExtras.core === 'number') {
          core = aceExtras.core;
        } else {
          core = componentBreakdown.reduce((sum, entry) => sum + entry.weight * entry.value, 0);
        }

        if (typeof aceExtras.logistic === 'number') {
          logistic = aceExtras.logistic;
        } else {
          logistic = computeAceLogistic(core, ACE_DEFAULT_LOGISTIC_ALPHA);
        }

        if (typeof aceExtras.availability === 'number') {
          availability = aceExtras.availability;
        }
      }

      availabilityPercent = Math.round(availability * 100);
      let aceScore = logistic * 100 * availability;
      if (typeof aceExtras?.score === 'number') {
        aceScore = aceExtras.score;
      }

      return {
        ...player,
        ace: aceScore,
        member,
        strengths,
        availabilityPercent,
        townHallLevel: townHall,
        componentBreakdown,
        core,
        logistic,
        availabilityMultiplier: availability,
      };
    });
  }, [roster]);

  const cardClasses = [
    "min-h-[18rem]",
    className,
  ].filter(Boolean).join(" ");

  return (
    <GlassCard className={cardClasses}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">ACE Leaderboard</p>
            <span className="rounded-full border border-brand-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              All-Mode Clan Excellence
            </span>
          </div>
          <h3 className="text-2xl font-semibold text-slate-100">Top performers this week</h3>
          <p className="text-sm text-slate-400">
            Tap the leader in roster stats to open this view. Scores blend offense, defense, reliability, capital value, and donation culture.
          </p>
        </header>

        {topPlayers.length ? (
          <ul className="space-y-3">
            {topPlayers.map((player, index) => {
              const townHallLevel = player.townHallLevel;
              const availabilityLabel = `${Math.min(100, Math.max(70, player.availabilityPercent))}% availability`;

              const descriptorParts: string[] = [];
              if (townHallLevel) descriptorParts.push(`TH${townHallLevel}`);
              descriptorParts.push(availabilityLabel);
              if (player.strengths) descriptorParts.push(`Strength: ${player.strengths}`);

              return (
                <li
                  key={player.tag}
                  className="flex items-center justify-between gap-4 rounded-3xl bg-brand-surfaceSubtle/60 px-4 py-3 shadow-[0_16px_32px_-28px_rgba(8,15,31,0.65)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-surfaceRaised/80 text-sm font-semibold text-slate-100">
                      #{index + 1}
                    </div>

                    {townHallLevel ? (
                      <div className="hidden sm:block">
                        <TownHallBadge
                          level={townHallLevel}
                          size="md"
                          showLevel
                          showBox={false}
                        />
                      </div>
                    ) : null}

                    <div>
                      <p className="text-sm font-semibold text-slate-100">{player.name}</p>
                      <p className="text-xs text-slate-400">
                        {descriptorParts.join(" • ")}
                      </p>
                    </div>
                  </div>

                  <div className="group relative text-right">
                    <p className="text-xl font-semibold text-slate-100">{player.ace.toFixed(1)}</p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">ACE</p>
                    <div className="pointer-events-auto absolute right-0 bottom-full z-50 mb-2 hidden w-72 -translate-y-1 flex-col gap-2 rounded-2xl bg-slate-950/95 px-4 py-3 text-[11px] leading-snug text-slate-200 shadow-xl group-hover:flex">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary/80">Score breakdown</span>
                      <div className="space-y-1 text-slate-300">
                        {player.componentBreakdown.map((component) => (
                          <div key={component.code} className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-100">{component.code}</span>
                            <span>{`${component.weight.toFixed(2)} × ${component.value.toFixed(2)} = ${component.weighted.toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1 border-t border-slate-700/60 pt-2 text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>Core sum</span>
                          <span>{player.core.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Logistic α{ACE_DEFAULT_LOGISTIC_ALPHA.toFixed(2)}</span>
                          <span>{player.logistic.toFixed(3)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Availability</span>
                          <span>{(player.availabilityMultiplier * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-slate-100">
                          <span>ACE</span>
                          <span>{player.ace.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-brand-border/60 bg-brand-surfaceSubtle/40 px-4 py-6 text-center text-sm text-slate-400">
            ACE rankings appear once we have roster data with donations or participation insight.
          </div>
        )}

        <section className="rounded-2xl bg-brand-surfaceSubtle/40 px-4 py-4 text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">How ACE is scored</p>
          <ul className="mt-3 space-y-2">
            {ACE_FACTORS.map((factor) => (
              <li key={factor.code} className="group relative flex flex-col gap-2 rounded-xl bg-brand-surfaceRaised/50 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 items-center gap-2">
                  <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">
                    {factor.code}
                  </span>
                  <span className="font-semibold text-slate-100">{factor.name}</span>
                  <span className="relative ml-1 flex items-center">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/20 text-[10px] font-semibold text-brand-primary">i</span>
                    <div className="pointer-events-auto absolute left-1/2 bottom-full z-50 mb-2 hidden w-60 -translate-x-1/2 -translate-y-1 flex-col gap-2 rounded-2xl bg-slate-950/95 px-4 py-3 text-[11px] leading-snug text-slate-200 shadow-xl group-hover:flex">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary/80">Underlying math</span>
                      <p>{factor.details}</p>
                    </div>
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 sm:flex-1 sm:text-center">{factor.description}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-100 sm:w-12 sm:text-right">{factor.weight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            Logistic scaling keeps scores on a 0–100 range, then an availability multiplier (0.85–1.00) rewards month-long reliability.
          </p>
        </section>
      </div>
    </GlassCard>
  );
};

function deriveStrengthSummary(player: AceScoreResult): string {
  const components = COMPONENT_MAP.map(({ key, code }) => ({
    code,
    value: player.breakdown[key].shrunk,
  }));

  const sorted = components.sort((a, b) => b.value - a.value);
  const positive = sorted.filter((entry) => entry.value > 0.15);
  const picks = (positive.length ? positive : sorted).slice(0, 2);

  return picks.map((entry) => entry.code).join(" & ");
}

export default AceLeaderboardCard;
