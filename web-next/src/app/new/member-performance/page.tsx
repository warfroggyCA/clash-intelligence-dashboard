"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowDownUp, Filter, Info, ShieldCheck, TrendingUp, Users, AlertTriangle, Sparkles } from "lucide-react";
import { Card } from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import { Input } from "@/components/new-ui/Input";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";
import { normalizeSearch } from "@/lib/search";
import LeadershipGuard from "@/components/LeadershipGuard";

type Tier = "S" | "A" | "B" | "C" | "D";

type MemberRow = {
  name: string;
  tag: string;
  wars: number;
  aei: number;
  consistency: number;
  holdRate: number;
  overall: number;
  tier: Tier;
  reliability: number;
  capitalLoot: number;
  capitalROI: number;
  capitalParticipation: number;
  capitalOverall: number;
  composite: number;
};

type WarIntelResponse = {
  data?: {
    metrics: Array<{
      playerTag: string;
      playerName: string;
      attackEfficiencyIndex: number;
      consistencyScore: number;
      defensiveHoldRate: number;
      overallScore: number;
      totalWars: number;
      performanceTier: string;
      participationRate?: number;
    }>;
    clanAverages: {
      averageAEI: number;
      averageConsistency: number;
      averageHoldRate: number;
      averageOverallScore: number;
    };
  };
};

type CapitalResponse = {
  data?: {
    metrics: Array<{
      playerTag: string;
      playerName: string;
      averageLootPerAttack: number;
      roiScore: number;
      participationRate: number;
      overallScore: number;
      performanceTier: string;
      totalAttacks?: number;
      totalWeekends?: number;
      weekendsParticipated?: number;
    }>;
    clanAverages: {
      averageLootPerAttack: number;
      averageROI: number;
      averageParticipation: number;
      averageOverallScore: number;
    };
  };
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<WarIntelResponse>;
};

const sampleRows: MemberRow[] = [
  { name: "Radiant–Tempest", tag: "#J1ZRPLQQ9", wars: 18, aei: 86, consistency: 78, holdRate: 22, overall: 84, reliability: 83, tier: "S", capitalLoot: 8200, capitalROI: 74, capitalParticipation: 92, capitalOverall: 81, composite: 83 },
  { name: "Chief–Tempest", tag: "#8QLCCVJ2", wars: 14, aei: 74, consistency: 70, holdRate: 18, overall: 76, reliability: 72, tier: "A", capitalLoot: 6100, capitalROI: 65, capitalParticipation: 88, capitalOverall: 69, composite: 73 },
  { name: "God Of LOYINS", tag: "#9VCJVUGV", wars: 12, aei: 72, consistency: 68, holdRate: 14, overall: 73, reliability: 69, tier: "A", capitalLoot: 5800, capitalROI: 60, capitalParticipation: 82, capitalOverall: 65, composite: 69 },
  { name: "WarFrog", tag: "#UL0LRJ02", wars: 10, aei: 65, consistency: 61, holdRate: 12, overall: 66, reliability: 63, tier: "B", capitalLoot: 5200, capitalROI: 58, capitalParticipation: 75, capitalOverall: 60, composite: 63 },
  { name: "CosmicThomas", tag: "#YYVUCPQ90", wars: 9, aei: 60, consistency: 58, holdRate: 10, overall: 61, reliability: 60, tier: "B", capitalLoot: 4700, capitalROI: 55, capitalParticipation: 70, capitalOverall: 57, composite: 59 },
];

function tierFromPerformance(tier?: string): Tier {
  if (!tier) return "C";
  if (tier.startsWith("excellent")) return "S";
  if (tier.startsWith("good")) return "A";
  if (tier.startsWith("average")) return "B";
  if (tier.startsWith("poor")) return "C";
  return "D";
}

function reliabilityScore(consistency: number, hold: number, participation?: number) {
  const part = participation ?? 80;
  return Math.round(consistency * 0.5 + hold * 0.2 + part * 0.3);
}

function TierPill({ tier }: { tier: Tier }) {
  const tone =
    tier === "S" ? "bg-emerald-500/25 text-emerald-200" :
    tier === "A" ? "bg-cyan-500/25 text-cyan-100" :
    tier === "B" ? "bg-amber-500/20 text-amber-100" :
    tier === "C" ? "bg-orange-500/20 text-orange-100" :
    "bg-slate-500/25 text-slate-100";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {tier}
    </span>
  );
}

function MemberPerformanceInner({ previewBypass }: { previewBypass?: boolean }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof MemberRow>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [daysBack, setDaysBack] = useState(90);

  const clanTag = normalizeTag(cfg.homeClanTag || "") || cfg.homeClanTag;
  const warKey = !previewBypass && clanTag
    ? `/api/war-intelligence?clanTag=${encodeURIComponent(clanTag)}&daysBack=${daysBack}`
    : null;

  const weeksBack = Math.max(4, Math.round(daysBack / 7));

  const { data: warData, error: warError, isLoading: warLoading } = useSWR<WarIntelResponse>(warKey, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: capData, error: capError, isLoading: capLoading } = useSWR<CapitalResponse>(
    !previewBypass && clanTag ? `/api/capital-analytics?clanTag=${encodeURIComponent(clanTag)}&weeksBack=${weeksBack}` : null,
    async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return res.json() as Promise<CapitalResponse>;
    },
    { revalidateOnFocus: false }
  );

  const hasAuthError = !!warError && `${warError.message}`.toLowerCase().includes("unauthorized");
  const hasCapAuthError = !!capError && `${capError.message}`.toLowerCase().includes("unauthorized");

  const useSample =
    previewBypass ||
    hasAuthError ||
    hasCapAuthError ||
    !(warData?.data?.metrics?.length);

  const metrics = useSample ? [] : warData?.data?.metrics ?? [];
  const clanAvg = useSample ? undefined : warData?.data?.clanAverages;

  const capitalMetrics = useSample ? [] : capData?.data?.metrics ?? [];
  const capitalAvg = useSample ? undefined : capData?.data?.clanAverages;
  const isLoading = !useSample && (warLoading || capLoading);

  const merged: Record<string, MemberRow> = {};

  metrics.forEach((m) => {
    const base: MemberRow = {
      name: m.playerName || m.playerTag,
      tag: m.playerTag,
      wars: m.totalWars,
      aei: Math.round(m.attackEfficiencyIndex),
      consistency: Math.round(m.consistencyScore),
      holdRate: Math.round(m.defensiveHoldRate),
      overall: Math.round(m.overallScore),
      tier: tierFromPerformance(m.performanceTier),
      reliability: reliabilityScore(Math.round(m.consistencyScore), Math.round(m.defensiveHoldRate), m.participationRate),
      capitalLoot: 0,
      capitalROI: 0,
      capitalParticipation: 0,
      capitalOverall: 0,
      composite: Math.round(m.overallScore),
    };
    merged[m.playerTag] = base;
  });

  capitalMetrics.forEach((c) => {
    const existing = merged[c.playerTag] || {
      name: c.playerName || c.playerTag,
      tag: c.playerTag,
      wars: 0,
      aei: 0,
      consistency: 0,
      holdRate: 0,
      overall: 0,
      tier: tierFromPerformance(c.performanceTier),
      reliability: reliabilityScore(60, 40, c.participationRate),
      capitalLoot: 0,
      capitalROI: 0,
      capitalParticipation: 0,
      capitalOverall: 0,
      composite: 0,
    };
    existing.capitalLoot = Math.round(c.averageLootPerAttack);
    existing.capitalROI = Math.round(c.roiScore);
    existing.capitalParticipation = Math.round(c.participationRate);
    existing.capitalOverall = Math.round(c.overallScore);
    const warComponent = existing.overall || existing.aei;
    const capComponent = existing.capitalOverall || existing.capitalROI;
    existing.composite = Math.round((warComponent * 0.6 + capComponent * 0.4) || 0);
    merged[c.playerTag] = existing;
  });

  const rows: MemberRow[] = Object.values(merged);

  // Preview / no-auth/no-data fallback uses sample data
  const effectiveRows = useSample || rows.length === 0 ? sampleRows : rows;

  const filtered = useMemo(() => {
    const term = normalizeSearch(search.trim());
    const dataRows = effectiveRows.filter(
      (m) =>
        !term ||
        normalizeSearch(m.name).includes(term) ||
        normalizeSearch(m.tag).includes(term)
    );
    return [...dataRows].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return 0;
    });
  }, [effectiveRows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const count = effectiveRows.length || 1;
    const sum = (key: keyof MemberRow) =>
      Math.round(
        (effectiveRows.reduce((acc, m) => acc + (typeof m[key] === "number" ? (m[key] as number) : 0), 0) /
          count) *
          10
      ) / 10;
    return {
      aei: clanAvg?.averageAEI ?? sum("aei"),
      consistency: clanAvg?.averageConsistency ?? sum("consistency"),
      hold: clanAvg?.averageHoldRate ?? sum("holdRate"),
      overall: clanAvg?.averageOverallScore ?? sum("overall"),
      reliability: sum("reliability"),
      capitalLoot: capitalAvg?.averageLootPerAttack ?? sum("capitalLoot"),
      capitalROI: capitalAvg?.averageROI ?? sum("capitalROI"),
      capitalParticipation: capitalAvg?.averageParticipation ?? sum("capitalParticipation"),
      capitalOverall: capitalAvg?.averageOverallScore ?? sum("capitalOverall"),
    };
  }, [effectiveRows, clanAvg, capitalAvg]);

  const toggleSort = (key: keyof MemberRow) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortButton = ({ column, label }: { column: keyof MemberRow; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-semibold text-white/80"
      onClick={() => toggleSort(column)}
    >
      {label}
      <ArrowDownUp className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  const timeRanges = [30, 60, 90, 180];

  const topAei = effectiveRows.slice().sort((a, b) => b.aei - a.aei)[0];
  const topReliability = effectiveRows.slice().sort((a, b) => b.reliability - a.reliability)[0];
  const topCapital = effectiveRows.slice().sort((a, b) => b.capitalOverall - a.capitalOverall)[0];
  const topComposite = effectiveRows.slice().sort((a, b) => b.composite - a.composite)[0];

  const needsAttention = effectiveRows
    .filter((m) => m.reliability < 60 || m.capitalParticipation < 60)
    .slice(0, 4);

  const copySummary = () => {
    const lines = [
      `Top composite: ${topComposite?.name ?? "—"} (${topComposite?.composite ?? 0})`,
      `Top AEI: ${topAei?.name ?? "—"} (${topAei?.aei ?? 0})`,
      `Top reliability: ${topReliability?.name ?? "—"} (${topReliability?.reliability ?? 0})`,
      `Top capital: ${topCapital?.name ?? "—"} (${topCapital?.capitalOverall ?? 0})`,
      needsAttention.length
        ? `Needs attention: ${needsAttention.map((m) => `${m.name} (rel ${m.reliability}%, cap part ${m.capitalParticipation}%)`).join("; ")}`
        : "Needs attention: none flagged",
    ];
    const text = lines.join("\n");
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white">Member Performance</h1>
          <p className="text-sm text-white/70">
            War efficiency, consistency, and defensive impact across the roster.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button tone="ghost">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button tone="accentAlt" onClick={copySummary}>
            Copy highlights
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard icon={<Users className="h-4 w-4 text-cyan-300" />} label="Players tracked" value={effectiveRows.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-300" />} label="Avg AEI" value={`${totals.aei}%`} />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} label="Avg hold rate" value={`${totals.hold}%`} />
        <StatCard icon={<Info className="h-4 w-4 text-cyan-200" />} label="Avg overall" value={`${totals.overall}%`} />
        <StatCard icon={<Sparkles className="h-4 w-4 text-indigo-200" />} label="Reliability" value={`${totals.reliability}%`} />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-cyan-300" />} label="Capital loot/atk" value={totals.capitalLoot ? `${totals.capitalLoot}` : "—"} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-300" />} label="Capital ROI" value={totals.capitalROI ? `${totals.capitalROI}%` : "—"} />
        <StatCard icon={<Users className="h-4 w-4 text-indigo-200" />} label="Capital part." value={totals.capitalParticipation ? `${totals.capitalParticipation}%` : "—"} />
        <StatCard icon={<Info className="h-4 w-4 text-cyan-200" />} label="Capital overall" value={totals.capitalOverall ? `${totals.capitalOverall}%` : "—"} />
      </div>

      <Card surface="panel" className="border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by name or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Window:</span>
            {timeRanges.map((days) => (
              <button
                key={days}
                onClick={() => setDaysBack(days)}
                className={`rounded-full px-3 py-1 font-semibold ${
                  daysBack === days
                    ? "bg-[var(--accent-alt)] text-slate-900"
                    : "bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
          <div className="text-xs text-white/60">
            {filtered.length} of {effectiveRows.length} players
          </div>
        </div>
        {hasAuthError ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Showing sample data; sign in as leadership to view live metrics.
          </div>
        ) : null}
      </Card>

      <Card surface="bg">
        <div className="flex flex-wrap items-center gap-3 pb-3 text-xs text-white/70">
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            Top AEI:{" "}
            <span className="font-semibold text-white">
              {topAei?.name ?? "—"}
            </span>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            Best reliability:{" "}
            <span className="font-semibold text-white">
              {topReliability?.name ?? "—"}
            </span>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            Top capital:{" "}
            <span className="font-semibold text-white">
              {topCapital?.name ?? "—"}
            </span>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            Top composite:{" "}
            <span className="font-semibold text-white">
              {topComposite?.name ?? "—"}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/80">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-right"><SortButton column="wars" label="Wars" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="aei" label="AEI" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="consistency" label="Consistency" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="holdRate" label="Hold" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="overall" label="Overall" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="reliability" label="Reliability" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalLoot" label="Cap Loot/Atk" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalROI" label="Cap ROI" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalParticipation" label="Cap Part." /></th>
                <th className="px-3 py-2 text-right"><SortButton column="capitalOverall" label="Cap Overall" /></th>
                <th className="px-3 py-2 text-right"><SortButton column="composite" label="Composite" /></th>
                <th className="px-3 py-2 text-center">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((m) => (
                <tr key={m.tag} className="hover:bg-white/5">
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{m.name}</span>
                      <span className="text-xs font-mono text-white/60">{m.tag}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{m.wars}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.aei}%</td>
                  <td className="px-3 py-3 text-right font-mono">{m.consistency}%</td>
                  <td className="px-3 py-3 text-right font-mono">{m.holdRate}%</td>
                  <td className="px-3 py-3 text-right font-mono">{m.overall}%</td>
                  <td className="px-3 py-3 text-right font-mono">{m.reliability}%</td>
                  <td className="px-3 py-3 text-right font-mono">{m.capitalLoot || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.capitalROI ? `${m.capitalROI}%` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.capitalParticipation ? `${m.capitalParticipation}%` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.capitalOverall ? `${m.capitalOverall}%` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.composite || "—"}</td>
                  <td className="px-3 py-3 text-center"><TierPill tier={m.tier} /></td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-white/60">
                    No data available for this window.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card surface="panel">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
          <div className="text-xl font-semibold text-white">{value}</div>
        </div>
      </div>
    </Card>
  );
}

export default function MemberPerformancePage() {
  const previewBypass =
    process.env.NEXT_PUBLIC_LEADERSHIP_PREVIEW === "true" ||
    (typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname));

  if (previewBypass) {
    return <MemberPerformanceInner />;
  }

  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <MemberPerformanceInner />
    </LeadershipGuard>
  );
}
