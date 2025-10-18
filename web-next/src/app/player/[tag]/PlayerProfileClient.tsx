"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clipboard,
  ExternalLink,
  History,
  Plus,
  Sparkles,
  SquarePen,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { normalizeTag } from "@/lib/tags";
import { fetchPlayerProfileSupabase } from "@/lib/player-profile-supabase";
import type { SupabasePlayerProfilePayload } from "@/types/player-profile-supabase";
import { useLeadership } from "@/hooks/useLeadership";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cfg } from "@/lib/config";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { TownHallBadge } from "@/components/ui/TownHallBadge";
import TrophyChart from "@/components/player/TrophyChart";
import DonationChart from "@/components/player/DonationChart";
import { HERO_MAX_LEVELS } from "@/types";
import { HeroLevel } from "@/components/ui/HeroLevel";

const DashboardLayout = dynamic(() => import("@/components/layout/DashboardLayout"), {
  ssr: false,
});

type TabKey = "overview" | "history" | "evaluations" | "metrics";

type TimelineTone = "default" | "positive" | "warning";

interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  tone: TimelineTone;
  icon: "join" | "depart" | "return" | "tenure" | "warning" | "note" | "joiner";
}

interface PlayerProfileClientProps {
  tag: string;
}

const formatNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat().format(Number(value));
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("invalid");
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
};

const formatRelative = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("invalid");
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
};

const timelineIconClass = (tone: TimelineTone) => {
  switch (tone) {
    case "positive":
      return "bg-emerald-600/90 border-emerald-400/80 text-white shadow-[0_8px_16px_-10px_rgba(16,185,129,0.7)]";
    case "warning":
      return "bg-amber-600/90 border-amber-400/80 text-white shadow-[0_8px_16px_-10px_rgba(251,191,36,0.75)]";
    default:
      return "bg-slate-800/90 border-slate-600/70 text-slate-100 shadow-[0_8px_16px_-10px_rgba(148,163,184,0.5)]";
  }
};

const TimelineIcon = ({ type }: { type: TimelineItem["icon"] }) => {
  const size = "w-4 h-4";
  switch (type) {
    case "join":
      return <UserPlus className={size} />;
    case "depart":
      return <ArrowRight className={size} />;
    case "return":
      return <ArrowLeft className={size} />;
    case "tenure":
      return <UserCheck className={size} />;
    case "warning":
      return <AlertTriangle className={size} />;
    case "note":
      return <SquarePen className={size} />;
    case "joiner":
      return <Sparkles className={size} />;
    default:
      return <History className={size} />;
  }
};

function buildTimeline(
  profile: SupabasePlayerProfilePayload | null,
  includeLeadership: boolean,
): TimelineItem[] {
  if (!profile?.history) return [];
  const items: TimelineItem[] = [];

  const push = (item: TimelineItem) => {
    if (!item.date) return;
    items.push(item);
  };

  profile.history.movements.forEach((movement, index) => {
    if (!movement?.date) return;
    const title =
      movement.type === "joined"
        ? "Joined the clan"
        : movement.type === "departed"
          ? "Departed the clan"
          : "Returned to the clan";
    const descriptionParts: string[] = [];
    if (movement.reason) descriptionParts.push(movement.reason);
    if (movement.tenureAtDeparture != null) {
      descriptionParts.push(`${movement.tenureAtDeparture} day tenure credited`);
    }
    if (movement.notes) descriptionParts.push(movement.notes);
    push({
      id: `movement-${index}-${movement.date}`,
      date: movement.date,
      title,
      description: descriptionParts.join(" • ") || undefined,
      tone:
        movement.type === "departed"
          ? "warning"
          : movement.type === "returned"
            ? "positive"
            : "default",
      icon:
        movement.type === "joined"
          ? "join"
          : movement.type === "departed"
            ? "depart"
            : "return",
    });
  });

  if (includeLeadership) {
    profile.leadership.tenureActions.forEach((action) => {
      if (!action.createdAt) return;
      const isGrant = action.action === "granted";
      push({
        id: `tenure-${action.id}`,
        date: action.createdAt,
        title: isGrant ? "Tenure granted" : "Tenure revoked",
        description: action.reason || undefined,
        tone: isGrant ? "positive" : "warning",
        icon: "tenure",
      });
    });

    profile.leadership.warnings.forEach((warning) => {
      if (!warning.createdAt) return;
      push({
        id: `warning-${warning.id}`,
        date: warning.createdAt,
        title: warning.isActive ? "Warning issued" : "Warning recorded",
        description: warning.warningNote || undefined,
        tone: "warning",
        icon: "warning",
      });
    });

    profile.leadership.notes.forEach((note) => {
      if (!note.createdAt) return;
      push({
        id: `note-${note.id}`,
        date: note.createdAt,
        title: "Leadership note",
        description: note.note,
        tone: "default",
        icon: "note",
      });
    });
  }

  profile.joinerEvents.forEach((event) => {
    if (!event.detectedAt) return;
    push({
      id: `joiner-${event.id}`,
      date: event.detectedAt,
      title: event.status === "reviewed" ? "Joiner reviewed" : "New joiner detected",
      description:
        event.metadata?.source_snapshot_id
          ? `Snapshot ${event.metadata.source_snapshot_id}`
          : undefined,
      tone: event.status === "reviewed" ? "positive" : "default",
      icon: "joiner",
    });
  });

  return items.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });
}

function deriveDonationSeries(profile: SupabasePlayerProfilePayload | null) {
  if (!profile?.timeline?.length) return [];
  return profile.timeline
    .filter((point) => point.snapshotDate)
    .map((point) => ({
      date: point.snapshotDate as string,
      donations: point.donations ?? null,
      donationsReceived: point.donationsReceived ?? null,
    }));
}

function deriveKudos(profile: SupabasePlayerProfilePayload | null) {
  if (!profile?.timeline?.length) {
    return "No seasonal activity captured yet — run a snapshot to generate kudos suggestions.";
  }
  const entries = profile.timeline.filter(
    (point) => point.donations != null || point.donationsReceived != null,
  );
  if (entries.length < 2) {
    return "Season just started — track donations for a few more pulls to surface kudos.";
  }
  const first = entries[0];
  const last = entries[entries.length - 1];
  const donationDelta =
    last.donations != null && first.donations != null ? last.donations - first.donations : 0;
  if (donationDelta > 0) {
    return `Delivered ${formatNumber(donationDelta)} troops across the latest tracking window — worthy of a quick shout-out.`;
  }
  return "No standout donation spikes this week — keep nudging for balance or review war participation instead.";
}

export default function PlayerProfileClient({ tag }: PlayerProfileClientProps) {
  const router = useRouter();
  const normalizedTag = useMemo(() => normalizeTag(tag), [tag]);
  const plainTag = normalizedTag.replace("#", "");

  const { permissions } = useLeadership();
  const canViewLeadership = permissions.canViewLeadershipFeatures;

  const currentUserEmail = useDashboardStore((state) => state.currentUser?.email ?? null);
  const fallbackClanTag = useDashboardStore(
    (state) => state.clanTag || state.homeClan || cfg.homeClanTag || null,
  );

  const [profile, setProfile] = useState<SupabasePlayerProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [warningSaving, setWarningSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!normalizedTag) return;
    try {
      const data = await fetchPlayerProfileSupabase(normalizedTag);
      setProfile(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load player profile. Please try again.";
      setError(message);
      throw err;
    }
  }, [normalizedTag]);

  useEffect(() => {
    let cancelled = false;
    if (!normalizedTag) {
      setProfile(null);
      setLoading(false);
      setError("Invalid player tag");
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    loadProfile()
      .catch(() => {
        /* handled earlier */
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedTag, loadProfile]);

  const summary = profile?.summary ?? null;
  const history = profile?.history ?? null;
  const activeWarning = canViewLeadership
    ? profile?.leadership.warnings.find((warning) => warning.isActive) ?? null
    : null;
  const latestNote = canViewLeadership ? profile?.leadership.notes[0] ?? null : null;

  const donationSeries = useMemo(() => deriveDonationSeries(profile), [profile]);
  const kudosSuggestion = useMemo(() => deriveKudos(profile), [profile]);
  const timelineItems = useMemo(
    () => buildTimeline(profile, canViewLeadership),
    [profile, canViewLeadership],
  );

  const heroCaps = useMemo(() => {
    if (!summary?.townHallLevel) return null;
    return HERO_MAX_LEVELS[summary.townHallLevel] ?? null;
  }, [summary?.townHallLevel]);

  const heroLevels = summary?.heroLevels && typeof summary.heroLevels === "object"
    ? summary.heroLevels
    : {};

  const handleCopySummary = useCallback(() => {
    if (!summary) return;
    const lines = [
      `${summary.name ?? "Unknown"} (${summary.tag})`,
      summary.clanName ? `Clan: ${summary.clanName}` : null,
      summary.role ? `Role: ${summary.role}` : null,
      summary.townHallLevel ? `Town Hall ${summary.townHallLevel}` : null,
      summary.donations?.given != null
        ? `Donations: ${formatNumber(summary.donations.given)} given, ${formatNumber(summary.donations.received)} received`
        : null,
      summary.war?.stars != null ? `War stars: ${formatNumber(summary.war.stars)}` : null,
      summary.activityScore != null ? `Activity score: ${summary.activityScore.toFixed(1)}` : null,
      history?.currentStint?.startDate
        ? `Current stint since ${formatDate(history.currentStint.startDate)}`
        : null,
    ].filter(Boolean);

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Copied leadership summary", "success"))
      .catch(() => showToast("Unable to copy summary — copy manually instead", "error"));
  }, [summary, history]);

  const handleOpenInClash = useCallback(() => {
    if (!plainTag) return;
    const href = `https://link.clashofclans.com/?playerTag=${encodeURIComponent(plainTag)}`;
    window.open(href, "_blank", "noopener");
  }, [plainTag]);

  const clanTagForActions = summary?.clanTag ?? fallbackClanTag ?? null;

  const handleSaveNote = async () => {
    if (!canViewLeadership || !clanTagForActions || !normalizedTag || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const response = await fetch("/api/player-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag: clanTagForActions,
          playerTag: normalizedTag,
          playerName: summary?.name ?? normalizedTag,
          note: noteText.trim(),
          createdBy: currentUserEmail ?? "Leadership Dashboard",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to save note");
      }
      showToast("Leadership note added", "success");
      setShowNoteModal(false);
      setNoteText("");
      await loadProfile();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save note. Please retry.";
      showToast(message, "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSaveWarning = async () => {
    if (!canViewLeadership || !clanTagForActions || !normalizedTag || !warningText.trim()) return;
    setWarningSaving(true);
    try {
      const response = await fetch("/api/player-warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag: clanTagForActions,
          playerTag: normalizedTag,
          playerName: summary?.name ?? normalizedTag,
          warningNote: warningText.trim(),
          createdBy: currentUserEmail ?? "Leadership Dashboard",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to record warning");
      }
      showToast("Warning recorded", "success");
      setShowWarningModal(false);
      setWarningText("");
      await loadProfile();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to record warning. Please retry.";
      showToast(message, "error");
    } finally {
      setWarningSaving(false);
    }
  };

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const statChips = useMemo(() => {
    if (!summary) return [];
    const chips = [
      {
        label: "Season Donations",
        value: summary.donations?.given != null ? formatNumber(summary.donations.given) : "—",
        accent: "from-cyan-500 via-sky-500 to-indigo-500",
        hint:
          summary.donations?.received != null
            ? `${formatNumber(summary.donations.received)} received`
            : null,
      },
      {
        label: "War Stars",
        value: summary.war?.stars != null ? formatNumber(summary.war.stars) : "—",
        accent: "from-amber-500 via-orange-500 to-red-500",
        hint:
          summary.war?.attackWins != null
            ? `${formatNumber(summary.war.attackWins)} attack wins`
            : null,
      },
      {
        label: "Activity Score",
        value:
          summary.activityScore != null
            ? summary.activityScore.toFixed(1)
            : "Awaiting metrics",
        accent: "from-emerald-500 via-lime-500 to-green-500",
        hint: summary.lastSeen ? `Last seen ${formatRelative(summary.lastSeen)}` : null,
      },
    ];

    if (canViewLeadership) {
      chips.push({
        label: "Warning Status",
        value: activeWarning ? "Active" : "Clear",
        accent: activeWarning
          ? "from-rose-500 via-red-500 to-amber-500"
          : "from-slate-500 via-slate-600 to-emerald-500",
        hint: activeWarning?.warningNote ?? (activeWarning ? undefined : "No active warnings"),
      });
    }

    return chips;
  }, [summary, canViewLeadership, activeWarning]);

  const aliasList = history?.aliases ?? [];

  const renderLoading = () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-300">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
        <p>Loading player profile…</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-8 py-6 text-center text-red-100 shadow-lg">
        <p className="font-semibold">We hit a snag loading this profile.</p>
        <p className="mt-2 text-sm text-red-200/80">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={handleGoBack}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setLoading(true);
              loadProfile()
                .catch(() => {
                  /* handled */
                })
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-950/95 pb-20">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10">
          <div className="mb-6 flex items-center gap-3 text-sm text-slate-400">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/50 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300 transition hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">Player Profile</span>
          </div>

          <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-900/80 to-slate-900 p-8 shadow-[0_40px_120px_-50px_rgba(79,70,229,0.6)]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl">
                      {summary?.townHallLevel ? (
                        <TownHallBadge level={summary.townHallLevel} />
                      ) : (
                        <span className="text-slate-300">TH?</span>
                      )}
                    </div>
                    <div>
                      <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">
                        {summary?.name ?? "Unknown Player"}
                      </h1>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-300/80">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.32em] text-slate-200">
                          {normalizedTag || "No Tag"}
                        </span>
                        {summary?.role && (
                          <span>{summary.role.replace(/([A-Z])/g, " $1").trim()}</span>
                        )}
                        {history?.status && <span>• {history.status.toUpperCase()}</span>}
                        {summary?.clanName && (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-1 text-xs font-medium text-indigo-200">
                            {summary.clanName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {statChips.map((chip) => (
                    <div
                      key={chip.label}
                      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${chip.accent} px-4 py-4 text-white shadow-[0_20px_45px_-28px_rgba(14,165,233,0.65)]`}
                    >
                      <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                        {chip.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{chip.value}</p>
                      {chip.hint && (
                        <p className="mt-1 text-xs text-white/80">{chip.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-3">
                <Button
                  variant="primary"
                  className="justify-center gap-2"
                  onClick={() => setShowNoteModal(true)}
                  disabled={!canViewLeadership}
                  title={
                    canViewLeadership
                      ? "Add a new leadership note"
                      : "Leadership access required"
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Leadership Note
                </Button>
                <Button
                  variant={activeWarning ? "warning" : "secondary"}
                  className="justify-center gap-2"
                  onClick={() => setShowWarningModal(true)}
                  disabled={!canViewLeadership}
                  title={
                    canViewLeadership
                      ? "Record or update a warning"
                      : "Leadership access required"
                  }
                >
                  <AlertTriangle className="h-4 w-4" />
                  Mark Warning
                </Button>
                <Button
                  variant="outline"
                  className="justify-center gap-2 text-slate-100"
                  onClick={handleCopySummary}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy Summary
                </Button>
                <Button
                  variant="ghost"
                  className="justify-center gap-2 border border-white/10 text-white hover:bg-white/20"
                  onClick={handleOpenInClash}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Clash
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(["overview", "history", "evaluations", "metrics"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "border-indigo-400 bg-indigo-500/30 text-indigo-200 shadow-[0_12px_30px_-20px_rgba(99,102,241,0.9)]"
                    : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                }`}
              >
                {tab === "overview" && <BarChart3 className="h-4 w-4" />}
                {tab === "history" && <History className="h-4 w-4" />}
                {tab === "evaluations" && <SquarePen className="h-4 w-4" />}
                {tab === "metrics" && <Activity className="h-4 w-4" />}
                {tab}
              </button>
            ))}
          </div>

          {loading && renderLoading()}
          {!loading && error && renderError()}

          {!loading && !error && (
            <div className="space-y-8">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
                  <div className="space-y-6">
                    <GlassCard
                      title="Profile Overview"
                      subtitle="Live data pulled from Supabase player backbone"
                      icon={<BarChart3 className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.9)]"
                    >
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Current League
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                              {summary?.league?.name ? (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">
                                  {summary.league.name}
                                </span>
                              ) : (
                                <span className="text-slate-400">Unknown</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Ranked Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rankedTrophies != null
                                ? formatNumber(summary.rankedTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Best Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.bestTrophies != null
                                ? formatNumber(summary.bestTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Battle Mode Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.battleModeTrophies != null
                                ? formatNumber(summary.battleModeTrophies)
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Seasonal Donations
                            </p>
                            <p className="mt-2 text-lg font-semibold text-emerald-300">
                              {summary?.donations?.given != null
                                ? formatNumber(summary.donations.given)
                                : "—"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {summary?.donations?.received != null
                                ? `${formatNumber(summary.donations.received)} received`
                                : "Received total not recorded"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Balance
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.donations?.balance != null
                                ? formatNumber(summary.donations.balance)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Activity Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-indigo-200">
                              {summary?.activityScore != null
                                ? summary.activityScore.toFixed(1)
                                : "Awaiting data"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {summary?.lastSeen
                                ? `Last seen ${formatRelative(summary.lastSeen) ?? ""}`
                                : "Last seen not captured"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              War Summary
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.war?.stars != null
                                ? `${formatNumber(summary.war.stars)} ⭐`
                                : "—"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {summary?.war?.attackWins != null
                                ? `${formatNumber(summary.war.attackWins)} attack wins`
                                : "Attack wins not tracked"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Best Versus Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.bestVersusTrophies != null
                                ? formatNumber(summary.bestVersusTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Tenure
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.tenureDays != null
                                ? `${formatNumber(summary.tenureDays)} days`
                                : "—"}
                            </p>
                            {history?.currentStint?.startDate && (
                              <p className="text-xs text-slate-400">
                                Since {formatDate(history.currentStint.startDate)}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Clan Alias
                            </p>
                            <p className="mt-2 text-sm text-slate-200">
                              {aliasList.length
                                ? aliasList.slice(0, 2).map((alias) => alias.name).join(", ")
                                : "No alternate names recorded"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

                    <GlassCard
                      title="Hero Progress"
                      subtitle="Track levels vs. Town Hall caps"
                      icon={<Sparkles className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {(["bk", "aq", "gw", "rc", "mp"] as const).map((key) => (
                          <HeroLevel
                            key={key}
                            hero={key.toUpperCase() as "BK" | "AQ" | "GW" | "RC" | "MP"}
                            level={
                              typeof heroLevels === "object" && heroLevels && key in heroLevels
                                ? Number((heroLevels as Record<string, unknown>)[key]) || 0
                                : 0
                            }
                            maxLevel={
                              heroCaps && key in heroCaps
                                ? Number((heroCaps as Record<string, unknown>)[key]) || 0
                                : 0
                            }
                            showName
                            size="lg"
                          />
                        ))}
                      </div>
                    </GlassCard>

                    <GlassCard
                      title="Availability & Signals"
                      subtitle="Quick leadership readout"
                      icon={<Activity className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            War opt-in
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-100">
                            Not yet tracked
                          </p>
                          <p className="text-xs text-slate-400">
                            War preference ingestion lands in the next pipeline refresh.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            Join status
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-100">
                            {history?.status ? history.status.toUpperCase() : "Unknown"}
                          </p>
                          {history?.currentStint?.startDate ? (
                            <p className="text-xs text-slate-400">
                              Current stint started {formatRelative(history.currentStint.startDate)}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No active stint start recorded
                            </p>
                          )}
                        </div>
                        {canViewLeadership && (
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Leadership spotlight
                            </p>
                            {latestNote ? (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-slate-100">
                                  {latestNote.note}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Logged {formatRelative(latestNote.createdAt)}
                                  {latestNote.createdBy ? ` • ${latestNote.createdBy}` : ""}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-400">
                                No leadership notes yet — add one to capture context.
                              </p>
                            )}
                            {activeWarning && (
                              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200 shadow-[0_20px_45px_-30px_rgba(251,191,36,0.8)]">
                                <p className="text-sm font-semibold">Active warning on file</p>
                                <p className="mt-1 text-xs text-amber-100/80">
                                  {activeWarning.warningNote}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </div>

                  <div className="space-y-6">
                    {canViewLeadership && (
                      <GlassCard
                        title="Leadership Quick Actions"
                        subtitle="Every action routes through Supabase APIs"
                        icon={<Sparkles className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        <div className="flex flex-col gap-3">
                          <Button
                            variant="primary"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() => setShowNoteModal(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add leadership note
                          </Button>
                          <Button
                            variant="warning"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() => setShowWarningModal(true)}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Mark warning
                          </Button>
                          <Button
                            variant="secondary"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() =>
                              showToast("Tenure actions land once the Supabase mutation is ready.", "info")
                            }
                          >
                            <UserCheck className="h-4 w-4" />
                            Adjust tenure (soon)
                          </Button>
                        </div>
                      </GlassCard>
                    )}

                    <GlassCard
                      title="Watchlist & Flags"
                      subtitle="Snapshot of risk + recruiting context"
                      icon={<AlertTriangle className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="space-y-4 text-sm text-slate-200">
                        <div className="flex items-center justify-between">
                          <span>Warning status</span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              activeWarning
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-emerald-500/20 text-emerald-200"
                            }`}
                          >
                            {activeWarning ? "Active" : "Clear"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Applicant evaluations</span>
                          <span className="text-slate-300">
                            {profile?.evaluations?.length
                              ? `${profile.evaluations.length} on file`
                              : "None recorded"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Joiner radar</span>
                          <span className="text-slate-300">
                            {profile?.joinerEvents?.length
                              ? `Last detected ${formatRelative(
                                  profile.joinerEvents[profile.joinerEvents.length - 1]
                                    ?.detectedAt ?? null,
                                ) ?? "recently"}`
                              : "No joiner events yet"}
                          </span>
                        </div>
                      </div>
                    </GlassCard>

                    <GlassCard
                      title="Related Links"
                      subtitle="Jump into supporting workflows"
                      icon={<ExternalLink className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="flex flex-col gap-3 text-sm text-indigo-200">
                        <Link
                          href={`/player/${encodeURIComponent(plainTag)}/history`}
                          className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-500/20"
                        >
                          View raw history analytics
                        </Link>
                        <button
                          type="button"
                          onClick={handleOpenInClash}
                          className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900/80"
                        >
                          Open in Clash client
                        </button>
                        <button
                          type="button"
                          onClick={handleCopySummary}
                          className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900/80"
                        >
                          Copy leadership summary
                        </button>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Timeline"
                    subtitle="Movements, leadership actions, and joiner events"
                    icon={<History className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    {timelineItems.length ? (
                      <div className="relative border-l border-slate-800/70 pl-8">
                        <div className="absolute -left-[13px] top-0 h-3 w-3 rounded-full border border-slate-600 bg-slate-900/90" />
                        <div className="space-y-6">
                          {timelineItems.map((item) => (
                            <div key={item.id} className="relative pl-4">
                              <div
                                className={`absolute -left-[34px] top-1 flex h-8 w-8 items-center justify-center rounded-full border ${timelineIconClass(item.tone)}`}
                              >
                                <TimelineIcon type={item.icon} />
                              </div>
                              <div className="flex flex-col gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/70 p-4 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.95)]">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {item.title}
                                  </h4>
                                  <span className="text-xs text-slate-400">
                                    {formatDate(item.date)}
                                  </span>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-slate-300">{item.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        We have not ingested any timeline events for this player yet.
                      </p>
                    )}
                  </GlassCard>

                  {aliasList.length > 0 && (
                    <GlassCard
                      title="Alias History"
                      subtitle="Known name changes and sightings"
                      icon={<Sparkles className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {aliasList.map((alias) => (
                          <div
                            key={`${alias.name}-${alias.firstSeen}`}
                            className="rounded-2xl border border-slate-800/60 bg-slate-900/70 px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-slate-100">{alias.name}</p>
                            <p className="text-xs text-slate-400">
                              First seen {formatDate(alias.firstSeen)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Last seen {formatDate(alias.lastSeen)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}

              {activeTab === "evaluations" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Applicant Evaluations"
                    subtitle="Latest recruiting readouts"
                    icon={<SquarePen className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                    actions={
                      canViewLeadership && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              showToast(
                                "Status transitions hook into the applicant pipeline next sprint.",
                                "info",
                              )
                            }
                          >
                            Update status
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              showToast(
                                "Evaluation notes will be editable once the modal lands.",
                                "info",
                              )
                            }
                          >
                            Add evaluation note
                          </Button>
                        </div>
                      )
                    }
                  >
                    {profile?.evaluations?.length ? (
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-indigo-100">
                          <p className="text-xs uppercase tracking-[0.28em] text-indigo-200/70">
                            Latest evaluation
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            Score{" "}
                            {profile.evaluations[profile.evaluations.length - 1]?.score != null
                              ? profile.evaluations[
                                  profile.evaluations.length - 1
                                ]?.score?.toFixed(1)
                              : "—"}
                          </p>
                          <p className="text-sm text-indigo-100/80">
                            {profile.evaluations[profile.evaluations.length - 1]?.recommendation ??
                              "No recommendation captured"}
                          </p>
                          <p className="mt-1 text-xs text-indigo-100/70">
                            {formatRelative(
                              profile.evaluations[profile.evaluations.length - 1]?.updatedAt ??
                                null,
                            ) ?? "Timing unknown"}
                          </p>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-slate-800/80">
                          <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
                            <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.28em] text-slate-400">
                              <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Score</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Recommendation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/70 bg-slate-950/40">
                              {profile.evaluations
                                .slice()
                                .reverse()
                                .map((evaluation) => (
                                  <tr key={evaluation.id}>
                                    <td className="px-4 py-3 text-slate-300">
                                      {formatDate(evaluation.updatedAt ?? evaluation.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-100">
                                      {evaluation.score != null
                                        ? evaluation.score.toFixed(1)
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-200">
                                      {evaluation.status ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                      {evaluation.recommendation ?? "No note"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        No applicant evaluations yet — sync the recruiting sheet or run the
                        interview workflow to populate this tab.
                      </p>
                    )}
                  </GlassCard>
                </div>
              )}

              {activeTab === "metrics" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Trophy & Donation Trends"
                    subtitle="Ranked season snapshots via nightly ingestion"
                    icon={<BarChart3 className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <TrophyChart data={profile?.timeline ?? []} />
                      <DonationChart data={donationSeries} />
                    </div>
                  </GlassCard>

                  <GlassCard
                    title="War Contribution Pulse"
                    subtitle="High-level indicators — full hit-rate tracking ships later"
                    icon={<Activity className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          War stars
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.stars != null ? formatNumber(summary.war.stars) : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pull detailed performance once war logs are ingested.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Offensive wins
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.attackWins != null
                            ? formatNumber(summary.war.attackWins)
                            : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Hit-rate logging aligns with the war event sync roadmap.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Defensive holds
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.defenseWins != null
                            ? formatNumber(summary.war.defenseWins)
                            : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Defensive analytics unlock after the war parser rollout.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard
                    title="Leadership Kudos"
                    subtitle="Auto-suggested recognition hooks"
                    icon={<Sparkles className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <p className="text-sm text-slate-200">{kudosSuggestion}</p>
                  </GlassCard>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {canViewLeadership && (
        <Modal
          isOpen={showNoteModal}
          onClose={() => {
            if (!noteSaving) {
              setShowNoteModal(false);
              setNoteText("");
            }
          }}
          title="Add leadership note"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Notes sync straight to Supabase so every leadership touchpoint stays in lockstep.
            </p>
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Capture coaching notes, context, or follow-ups…"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              disabled={noteSaving}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!noteSaving) {
                    setShowNoteModal(false);
                    setNoteText("");
                  }
                }}
                disabled={noteSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveNote}
                loading={noteSaving}
                disabled={!noteText.trim()}
              >
                Save note
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {canViewLeadership && (
        <Modal
          isOpen={showWarningModal}
          onClose={() => {
            if (!warningSaving) {
              setShowWarningModal(false);
              setWarningText("");
            }
          }}
          title="Mark warning"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Warning notes replace any existing active warning for this player. Use them when
              leadership alignment is critical.
            </p>
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="Outline the risk and next follow-up steps…"
              value={warningText}
              onChange={(event) => setWarningText(event.target.value)}
              disabled={warningSaving}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!warningSaving) {
                    setShowWarningModal(false);
                    setWarningText("");
                  }
                }}
                disabled={warningSaving}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                onClick={handleSaveWarning}
                loading={warningSaving}
                disabled={!warningText.trim()}
              >
                Save warning
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
