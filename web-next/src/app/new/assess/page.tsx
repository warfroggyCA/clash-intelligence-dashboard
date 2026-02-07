"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { Card } from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import { Input } from "@/components/new-ui/Input";
import LeadershipGuard from "@/components/LeadershipGuard";
import { apiFetcher } from "@/lib/api/swr-fetcher";
import { useLeadership } from "@/hooks/useLeadership";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";
import { normalizeSearch } from "@/lib/search";
import { showToast } from "@/lib/toast";
import { formatDistanceToNow } from "date-fns";

type JoinerMetadata = {
  name?: string;
  role?: string | null;
  townHallLevel?: number | null;
  trophies?: number | null;
  notesCount?: number;
  warningsCount?: number;
  hasPreviousHistory?: boolean;
  previousName?: string | null;
  totalTenure?: number | null;
  lastDepartureDate?: string | null;
  linkedAccountTags?: string[];
  linkedAccountWarnings?: Array<{ tag?: string; warningNote?: string; createdAt?: string }>;
  hasLinkedAccountWarnings?: boolean;
  notificationPriority?: "low" | "medium" | "high" | "critical";
};

type JoinerRecord = {
  id: string;
  player_tag: string;
  detected_at: string;
  status?: "pending" | "reviewed" | string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  metadata?: JoinerMetadata | null;
  history?: { primary_name?: string; movements?: Array<{ type?: string; date?: string }> } | null;
  notes?: Array<{ note?: string }> | null;
  warnings?: Array<{ warning_note?: string }> | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-100 border-rose-400/40",
  high: "bg-amber-500/20 text-amber-100 border-amber-400/40",
  medium: "bg-cyan-500/20 text-cyan-100 border-cyan-400/40",
  low: "bg-slate-500/20 text-slate-200 border-slate-400/40",
};

const statusTone = (status?: string) =>
  status === "reviewed" ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40" : "bg-purple-500/20 text-purple-100 border-purple-400/40";

const resolveName = (joiner: JoinerRecord) =>
  joiner.metadata?.name || joiner.history?.primary_name || joiner.player_tag;

const resolveWarnings = (joiner: JoinerRecord) =>
  joiner.warnings?.length ?? joiner.metadata?.warningsCount ?? 0;

const resolveNotes = (joiner: JoinerRecord) =>
  joiner.notes?.length ?? joiner.metadata?.notesCount ?? 0;

const hasPreviousHistory = (joiner: JoinerRecord) =>
  Boolean(joiner.metadata?.hasPreviousHistory || joiner.history?.movements?.some((m) => m.type === "departed"));

const resolvePriority = (joiner: JoinerRecord) => {
  if (joiner.metadata?.notificationPriority) return joiner.metadata.notificationPriority;
  if (resolveWarnings(joiner) > 0 || joiner.metadata?.hasLinkedAccountWarnings) return "high";
  if (hasPreviousHistory(joiner)) return "medium";
  return "low";
};

const StatCard = ({
  label,
  value,
  icon,
  tone = "text-white",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: string;
}) => (
  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
      <span>{label}</span>
      <span className="text-slate-500">{icon}</span>
    </div>
    <div className={`mt-3 text-3xl font-black ${tone}`}>{value.toLocaleString()}</div>
  </div>
);

export default function AssessPage() {
  const clanTag = normalizeTag(cfg.homeClanTag || "") || cfg.homeClanTag;
  const { permissions } = useLeadership();
  const canViewSensitiveData = permissions.canViewSensitiveData;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"pending" | "reviewed" | "all">("pending");
  const [days, setDays] = useState<"7" | "30" | "all">("all");

  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, string>>({});
  const [assessmentSavingId, setAssessmentSavingId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    clanTag: clanTag ?? "",
    ...(status !== "all" ? { status } : {}),
    ...(days !== "all" ? { days } : {}),
  });

  const queryKey = clanTag ? `/api/joiners?${queryParams.toString()}` : null;
  const { data, error, isLoading, mutate } = useSWR<JoinerRecord[]>(queryKey, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const joiners = useMemo(() => data ?? [], [data]);

  const joinerTagsKey = useMemo(() => {
    if (!canViewSensitiveData || !clanTag || !joiners.length) return null;
    const tags = joiners
      .map((j) => normalizeTag(j.player_tag) || j.player_tag)
      .filter(Boolean);
    // Stable key: sort + dedupe, cap to keep URL sane
    const unique = Array.from(new Set(tags)).sort().slice(0, 100);
    if (!unique.length) return null;
    return `/api/player-assessments?clanTag=${encodeURIComponent(clanTag)}&playerTags=${encodeURIComponent(unique.join(','))}`;
  }, [canViewSensitiveData, clanTag, joiners]);

  const { data: assessmentsByTagResponse } = useSWR<{ success: boolean; data?: { latestByTag?: Record<string, any> }; error?: string }>(
    joinerTagsKey,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  const assessmentLatestByTag = assessmentsByTagResponse?.data?.latestByTag ?? {};

  const filteredJoiners = useMemo(() => {
    const term = normalizeSearch(search.trim());
    if (!term) return joiners;
    return joiners.filter((joiner) => {
      const name = normalizeSearch(resolveName(joiner));
      const tag = normalizeSearch(joiner.player_tag || "");
      const previousName = normalizeSearch(joiner.metadata?.previousName || "");
      return name.includes(term) || tag.includes(term) || previousName.includes(term);
    });
  }, [joiners, search]);

  const pendingCount = joiners.filter((j) => (j.status ?? "pending") === "pending").length;
  const reviewedCount = joiners.filter((j) => (j.status ?? "pending") === "reviewed").length;
  const warningCount = joiners.filter((j) => resolveWarnings(j) > 0 || j.metadata?.hasLinkedAccountWarnings).length;
  const returnerCount = joiners.filter((j) => hasPreviousHistory(j)).length;

  const handleStatusUpdate = async (id: string, nextStatus: "pending" | "reviewed") => {
    try {
      const res = await fetch("/api/joiners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus, reviewedBy: "Assess" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      showToast(`Marked as ${nextStatus}.`, "success");
      mutate();
    } catch (err: any) {
      showToast(err?.message || "Failed to update joiner.", "error");
    }
  };

  const handleSaveAssessment = async (joiner: JoinerRecord) => {
    const draft = (assessmentDrafts[joiner.id] || '').trim();
    if (!draft) {
      showToast('Add a quick note before saving.', 'error');
      return;
    }

    const tag = normalizeTag(joiner.player_tag) || joiner.player_tag;
    const name = resolveName(joiner);

    setAssessmentSavingId(joiner.id);
    try {
      const res = await fetch('/api/player-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clan_tag: clanTag,
          player_tag: tag,
          player_name: name,
          notes: draft,
          context: {
            source: 'new/assess',
            joinerId: joiner.id,
            detectedAt: joiner.detected_at,
            townHallLevel: joiner.metadata?.townHallLevel ?? null,
            trophies: joiner.metadata?.trophies ?? null,
            warningsCount: resolveWarnings(joiner),
            notesCount: resolveNotes(joiner),
            linkedAccountTags: joiner.metadata?.linkedAccountTags ?? [],
          },
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      setAssessmentDrafts((prev) => ({ ...prev, [joiner.id]: '' }));
      showToast('Assessment saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save assessment.', 'error');
    } finally {
      setAssessmentSavingId(null);
    }
  };

  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <div className="space-y-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6"
          style={{ boxShadow: "0 24px 48px -30px rgba(0,0,0,0.8)" }}
        >
          <div className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 15% 20%, rgba(99,102,241,0.18) 0%, transparent 45%), radial-gradient(circle at 85% 30%, rgba(14,165,233,0.15) 0%, transparent 45%)",
            }}
          />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Assess
                </h1>
                <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-purple-200">
                  New joiners
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Review new arrivals, scan for warnings, and document decisions before they join wars.
              </p>
            </div>
            <div className="flex gap-2">
              <Button tone="primary" onClick={() => mutate()} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Link
                href="/new/player-database"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Player Database
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending" value={pendingCount} icon={<Clock className="h-4 w-4" />} tone="text-purple-200" />
          <StatCard label="Reviewed" value={reviewedCount} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-emerald-200" />
          <StatCard label="Warnings" value={warningCount} icon={<AlertTriangle className="h-4 w-4" />} tone="text-rose-200" />
          <StatCard label="Returners" value={returnerCount} icon={<ShieldCheck className="h-4 w-4" />} tone="text-cyan-200" />
        </div>

        <Card title="Filters">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search name, tag, previous name"
              className="max-w-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex flex-wrap gap-2 text-xs">
              {(["pending", "reviewed", "all"] as const).map((key) => (
                <Button
                  key={key}
                  tone={status === key ? "accentAlt" : "ghost"}
                  className="h-10 px-4"
                  onClick={() => setStatus(key)}
                >
                  {STATUS_LABELS[key] ?? "All"}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(["7", "30", "all"] as const).map((key) => (
                <Button
                  key={key}
                  tone={days === key ? "accentAlt" : "ghost"}
                  className="h-10 px-4"
                  onClick={() => setDays(key)}
                >
                  {key === "all" ? "All time" : `Last ${key}d`}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {error ? (
          <Card>
            <div className="text-sm text-rose-200">Failed to load joiners. {error.message}</div>
          </Card>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="text-sm text-slate-300">Loading joiners…</div>
          </Card>
        ) : null}

        {!isLoading && !error ? (
          filteredJoiners.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredJoiners.map((joiner) => {
                const name = resolveName(joiner);
                const tag = normalizeTag(joiner.player_tag) || joiner.player_tag;
                const statusValue = joiner.status ?? "pending";
                const priority = resolvePriority(joiner);
                const priorityStyle = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
                const detectedAt = new Date(joiner.detected_at);
                const safeDetected = Number.isNaN(detectedAt.getTime()) ? null : detectedAt;
                const warnings = resolveWarnings(joiner);
                const notes = resolveNotes(joiner);
                const linkedTags = joiner.metadata?.linkedAccountTags ?? [];
                const linkedWarnings = joiner.metadata?.linkedAccountWarnings?.length ?? 0;

                return (
                  <div
                    key={joiner.id}
                    className="rounded-2xl border border-white/5 bg-white/5 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-white">{name}</div>
                        <div className="text-xs text-slate-400">{tag}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-[10px] uppercase tracking-widest">
                        <span className={`rounded-full border px-2.5 py-1 ${statusTone(statusValue)}`}>
                          {STATUS_LABELS[statusValue] ?? statusValue}
                        </span>
                        <span className={`rounded-full border px-2 py-1 ${priorityStyle}`}>
                          {priority} priority
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Detected</div>
                        <div>{safeDetected ? formatDistanceToNow(safeDetected, { addSuffix: true }) : "Unknown"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Town Hall</div>
                        <div>{joiner.metadata?.townHallLevel ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Warnings</div>
                        <div>{warnings}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Notes</div>
                        <div>{notes}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                      {canViewSensitiveData && assessmentLatestByTag?.[tag] ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-cyan-200">
                          Assessment on file
                        </div>
                      ) : null}
                      {hasPreviousHistory(joiner) ? (
                        <div className="flex items-center gap-2 text-amber-200">
                          <UserX className="h-4 w-4" />
                          <span>Returning member — prior history on record.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-200">
                          <UserPlus className="h-4 w-4" />
                          <span>First-time joiner.</span>
                        </div>
                      )}
                      {linkedTags.length ? (
                        <div className="text-slate-400">
                          Linked accounts: {linkedTags.slice(0, 3).join(", ")}
                          {linkedTags.length > 3 ? ` +${linkedTags.length - 3} more` : ""}
                        </div>
                      ) : null}
                      {linkedWarnings > 0 ? (
                        <div className="text-rose-200">
                          Linked warnings: {linkedWarnings}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/new/player/${encodeURIComponent(tag)}`}
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
                      >
                        View Profile
                      </Link>
                      {statusValue === "pending" ? (
                        <Button
                          tone="accentAlt"
                          className="h-10 px-4 text-xs"
                          onClick={() => handleStatusUpdate(joiner.id, "reviewed")}
                        >
                          Mark Reviewed
                        </Button>
                      ) : (
                        <Button
                          tone="ghost"
                          className="h-10 px-4 text-xs"
                          onClick={() => handleStatusUpdate(joiner.id, "pending")}
                        >
                          Undo Review
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500">Assessment note</div>
                      <textarea
                        className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-100"
                        rows={3}
                        placeholder="Freeform notes (saved automatically)…"
                        value={assessmentDrafts[joiner.id] ?? ''}
                        onChange={(e) => setAssessmentDrafts((prev) => ({ ...prev, [joiner.id]: e.target.value }))}
                      />
                      <div className="flex items-center justify-end">
                        <Button
                          tone="primary"
                          className="h-10 px-4 text-xs"
                          onClick={() => handleSaveAssessment(joiner)}
                          disabled={assessmentSavingId === joiner.id || !(assessmentDrafts[joiner.id] ?? '').trim()}
                        >
                          {assessmentSavingId === joiner.id ? 'Saving…' : 'Save assessment'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="text-sm text-slate-300">No new joiners to assess.</div>
            </Card>
          )
        ) : null}
      </div>
    </LeadershipGuard>
  );
}
