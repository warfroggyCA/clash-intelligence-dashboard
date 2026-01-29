"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Bell,
  ClipboardCheck,
  Crown,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import LeadershipGuard from "@/components/LeadershipGuard";
import { Card } from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import { QuickActions } from "@/components/layout/QuickActions";
import IngestionMonitor from "@/components/layout/IngestionMonitor";
import NewsFeed, { type NewsFeedRef } from "@/components/leadership/NewsFeed";
import PendingRegistrations from "@/components/leadership/PendingRegistrations";
import ApplicantsPanel from "@/components/ApplicantsPanel";
import ClanGamesManager from "@/components/leadership/ClanGamesManager";
import { useRosterData } from "@/app/new/roster/useRosterData";
import { apiFetcher } from "@/lib/api/swr-fetcher";
import { formatLeadershipSnapshotLabel, formatLeadershipWindowLabel } from "@/lib/leadership-dashboard";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";
import { useLeadership } from "@/hooks/useLeadership";

type HighlightEvent = {
  tag: string;
  name: string;
  value: string;
  occurredAt: string | null;
  detail?: string | null;
};

type WeeklyHighlightsPayload = {
  windowStart: string | null;
  windowEnd: string | null;
  snapshotFetchedAt: string | null;
  snapshotDate: string | null;
  memberCount: number;
  promotions: HighlightEvent[];
  demotions: HighlightEvent[];
  heroUpgrades: HighlightEvent[];
  newJoiners: HighlightEvent[];
};

type JoinerRecord = {
  id: string;
  player_tag: string;
  detected_at: string;
  status: "pending" | "reviewed";
  metadata: Record<string, unknown>;
  history: any | null;
  notes: any[];
  warnings: any[];
};

const renderDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const HighlightList = ({
  title,
  emptyLabel,
  items,
  linkAnchor,
}: {
  title: string;
  emptyLabel: string;
  items: HighlightEvent[];
  linkAnchor?: string;
}) => (
  <div className="space-y-3">
    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{title}</div>
    {items.length ? (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.tag}-${item.value}-${item.occurredAt ?? "na"}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {linkAnchor ? (
                  <Link
                    href={`/new/player/${encodeURIComponent(item.tag)}${linkAnchor}`}
                    className="font-semibold text-white hover:text-clash-gold transition-colors"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <div className="font-semibold text-white">{item.name}</div>
                )}
                <div className="text-xs text-slate-400">{item.value}</div>
                {item.detail ? <div className="mt-1 text-xs text-slate-500">{item.detail}</div> : null}
              </div>
              {renderDate(item.occurredAt) ? (
                <div className="text-xs text-slate-500 whitespace-nowrap">{renderDate(item.occurredAt)}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
        {emptyLabel}
      </div>
    )}
  </div>
);

const JoinerReviewPanel = ({
  clanTag,
  canModify,
}: {
  clanTag: string | null;
  canModify: boolean;
}) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<JoinerRecord[]>(
    clanTag ? `/api/joiners?clanTag=${encodeURIComponent(clanTag)}&status=pending&days=7` : null,
    apiFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    },
  );

  const handleMarkReviewed = useCallback(
    async (id: string) => {
      if (!canModify) return;
      setActionError(null);
      const response = await fetch("/api/joiners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "reviewed" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setActionError(payload?.error || "Failed to update joiner.");
        return;
      }
      mutate((existing) => (existing ? existing.filter((joiner) => joiner.id !== id) : existing), false);
    },
    [canModify, mutate],
  );

  const joiners = data ?? [];

  return (
    <Card
      title={
        <div className="flex items-center gap-2 text-white">
          <UserPlus className="h-4 w-4 text-clash-gold" />
          Recent joiners
        </div>
      }
    >
      <div className="space-y-3">
        {(error || actionError) && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {actionError || error?.message || "Failed to load joiner queue."}
          </div>
        )}
        {isLoading ? (
          <div className="text-xs text-slate-400">Loading joiners...</div>
        ) : joiners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
            No pending joiners detected in the last week.
          </div>
        ) : (
          <div className="space-y-3">
            {joiners.map((joiner) => {
              const joinDate = new Date(joiner.detected_at).toLocaleString();
              const history = joiner.history;
              const lastDeparture = history?.movements?.filter((m: any) => m.type === "departed").slice(-1)[0];
              const hasWarnings = (joiner.warnings || []).length > 0;
              const latestNote = joiner.notes?.[0];
              return (
                <div
                  key={joiner.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-white">{joiner.player_tag}</div>
                      <div className="text-xs text-slate-400">Joined: {joinDate}</div>
                      {history ? (
                        <div className="text-xs text-slate-500 mt-1">
                          Status: {history.status}
                          {history.total_tenure ? ` • Tenure ${history.total_tenure} days` : ""}
                          {lastDeparture ? ` • Last departed ${new Date(lastDeparture.date).toLocaleDateString()}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      tone="ghost"
                      onClick={() => handleMarkReviewed(joiner.id)}
                      disabled={!canModify}
                      className="text-xs"
                    >
                      Mark reviewed
                    </Button>
                  </div>
                  {hasWarnings ? (
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs text-amber-200">
                      {joiner.warnings.length} active warning{joiner.warnings.length > 1 ? "s" : ""} on record.
                    </div>
                  ) : null}
                  {latestNote ? (
                    <div className="mt-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-2 py-2 text-xs text-blue-100/90">
                      <div className="font-semibold text-blue-200">Latest note</div>
                      <div className="text-[11px] text-blue-100/80">
                        {new Date(latestNote.created_at).toLocaleString()}
                      </div>
                      <div className="mt-1 text-blue-100">{latestNote.note}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default function NewLeadershipDashboard() {
  const { data: rosterData, clanTag } = useRosterData();
  const { permissions } = useLeadership();
  const [showIngestionMonitor, setShowIngestionMonitor] = useState(false);
  const normalizedTag = useMemo(() => {
    const fallback = clanTag || cfg.homeClanTag || "";
    return normalizeTag(fallback) || (fallback ? fallback : null);
  }, [clanTag]);

  const { data: highlights, error: highlightsError, isLoading: highlightsLoading } =
    useSWR<WeeklyHighlightsPayload>(
      normalizedTag ? `/api/leadership/highlights?clanTag=${encodeURIComponent(normalizedTag)}` : null,
      apiFetcher,
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        refreshInterval: 0,
      },
    );

  const windowLabel = formatLeadershipWindowLabel(highlights?.windowStart, highlights?.windowEnd);
  const snapshotLabel = formatLeadershipSnapshotLabel(highlights?.snapshotFetchedAt ?? null);

  const clanName =
    rosterData?.clanName || rosterData?.meta?.clanName || normalizedTag || "Clan";

  const newsFeedRef = useRef<NewsFeedRef | null>(null);

  const handleRefreshInsights = useCallback(async () => {
    if (!normalizedTag) return;
    await fetch("/api/health?cron=true&forceInsights=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);
    if (newsFeedRef.current) {
      await newsFeedRef.current.refresh();
    }
  }, [normalizedTag, newsFeedRef]);

  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                <Crown className="h-4 w-4 text-clash-gold" />
                Leadership Dashboard
              </div>
              <h1 className="text-3xl font-semibold text-white">{clanName}</h1>
              <p className="text-sm text-slate-400">
                Operational briefing for approvals, assessments, and roster oversight.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                {normalizedTag || "No clan tag"}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                <Bell className="h-3.5 w-3.5 text-slate-400" />
                Snapshot: <span className="text-slate-200">{snapshotLabel}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                Members: <span className="text-slate-200">{highlights?.memberCount ?? "—"}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <ClipboardCheck className="h-4 w-4 text-clash-gold" />
                  Quick actions
                </div>
              }
            >
              <QuickActions className="!border-transparent !bg-transparent !text-slate-100" />
            </Card>

            <Card
              title={
                <div className="flex items-center justify-between gap-3 text-white">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-clash-gold" />
                    Weekly highlights
                    <span className="text-xs text-slate-400">{windowLabel}</span>
                  </div>
                  <span className="text-xs text-slate-400">Leagues, heroes, and joiners</span>
                </div>
              }
            >
              {highlightsError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {highlightsError.message || "Failed to load highlights."}
                </div>
              )}
              {highlightsLoading && !highlights ? (
                <div className="text-xs text-slate-400">Loading highlights...</div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <HighlightList
                    title="Promotions"
                    emptyLabel="No promotions logged this week."
                    items={highlights?.promotions ?? []}
                    linkAnchor="#league-history"
                  />
                  <HighlightList
                    title="Hero upgrades"
                    emptyLabel="No hero upgrades detected."
                    items={highlights?.heroUpgrades ?? []}
                  />
                  <HighlightList
                    title="New joiners"
                    emptyLabel="No new joiners detected."
                    items={highlights?.newJoiners ?? []}
                  />
                  <HighlightList
                    title="Demotions"
                    emptyLabel="No demotions logged this week."
                    items={highlights?.demotions ?? []}
                    linkAnchor="#league-history"
                  />
                </div>
              )}
            </Card>

            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <Bell className="h-4 w-4 text-clash-gold" />
                  Leadership news feed
                </div>
              }
              footer={
                <div className="flex flex-wrap items-center gap-3">
                  <Button tone="ghost" onClick={handleRefreshInsights} className="text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh insights
                  </Button>
                  <span className="text-xs text-slate-400">Uses SSOT roster and alerts engine</span>
                </div>
              }
            >
              <NewsFeed ref={newsFeedRef} clanTag={normalizedTag} />
            </Card>
          </div>

          <div className="space-y-6">
            <JoinerReviewPanel clanTag={normalizedTag} canModify={permissions.canModifyClanData} />

            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <ClipboardCheck className="h-4 w-4 text-clash-gold" />
                  Applicants pipeline
                </div>
              }
            >
              <ApplicantsPanel defaultClanTag={normalizedTag || cfg.homeClanTag || ""} />
            </Card>

            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-4 w-4 text-clash-gold" />
                  Pending registrations
                </div>
              }
            >
              <PendingRegistrations clanTag={normalizedTag} />
            </Card>

            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <Trophy className="h-4 w-4 text-clash-gold" />
                  Clan games
                </div>
              }
            >
              <ClanGamesManager clanTag={normalizedTag} />
            </Card>

            <Card
              title={
                <div className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-4 w-4 text-clash-gold" />
                  Ingestion monitor
                </div>
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Inspect ingestion jobs and trigger manual refreshes when needed.
                </div>
                <Button tone="ghost" onClick={() => setShowIngestionMonitor((prev) => !prev)} className="text-xs">
                  {showIngestionMonitor ? "Close" : "Open"}
                </Button>
              </div>
              <div className="mt-3">
                {showIngestionMonitor ? (
                  <IngestionMonitor onClose={() => setShowIngestionMonitor(false)} />
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
                    Monitor idle. Open to view job history or start a refresh.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </LeadershipGuard>
  );
}
