"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Crown,
  ListChecks,
  ShieldCheck,
  Users,
  Swords,
  Settings,
  MessageSquare,
  Bell,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/new-ui/Card";
import { apiFetcher } from "@/lib/api/swr-fetcher";
import { cfg } from "@/lib/config";
import { normalizeTag } from "@/lib/tags";

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

const sections = [
  {
    title: "Leadership Dashboard",
    icon: Sparkles,
    items: [
      "Daily briefing & news feed",
      "Pending registrations",
      "Ingestion health + alerts",
    ],
    href: "/new/leadership/dashboard",
  },
  {
    title: "Leadership Assessment",
    icon: Crown,
    items: [
      "Composite Leadership Value (CLV)",
      "Promotion recommendations",
      "Demotion risk watchlist",
    ],
    href: "/new/leadership/assessment",
  },
  {
    title: "Review Queue",
    icon: ListChecks,
    items: [
      "New joiners review (Assess)",
      "Recent leaves (former members)",
      "Pending actions (awaiting cron)",
      "Active warnings & severity",
    ],
    href: "/new/assess",
  },
  {
    title: "Access & Onboarding",
    icon: Users,
    items: [
      "Pending registrations approvals",
      "Role assignment & access matrix",
      "Tracked clans management",
    ],
    href: "/new/leadership/access",
  },
  {
    title: "Player Database Tools",
    icon: ShieldCheck,
    items: [
      "Notes + warnings workflow",
      "Alias linking / linked accounts",
      "Leadership-only player history",
    ],
    href: "/new/player-database",
  },
  {
    title: "War Planning Suite",
    icon: Swords,
    items: [
      "Roster selection & lineup",
      "Opponent fetch + matchup",
      "Plan editor + assignments",
    ],
    href: "/new/war",
  },
  {
    title: "Discord Publisher",
    icon: MessageSquare,
    items: [
      "War result builder",
      "Donation + activity summaries",
      "Shareable clan updates",
    ],
    href: "/discord",
  },
  {
    title: "Settings & Thresholds",
    icon: Settings,
    items: [
      "Inactivity definitions",
      "Donation expectations",
      "Clan privacy & permissions",
    ],
    href: "/new/leadership/settings",
  },
  {
    title: "Command Center & Alerts",
    icon: Bell,
    items: [
      "Daily briefing / changes feed",
      "Action items for leaders",
      "Automated alert surfacing",
    ],
    href: "/new/leadership/dashboard",
  },
  {
    title: "Recruiting",
    icon: UserPlus,
    items: [
      "One-off candidate assessments",
      "Applicant scoring signals",
      "Recruitment decision support",
    ],
    href: "/new/assess",
  },
];

export default function LeadershipPage() {
  const clanTag = normalizeTag(cfg.homeClanTag || "") || cfg.homeClanTag;
  const { data: highlights, error: highlightsError, isLoading: highlightsLoading } = useSWR<WeeklyHighlightsPayload>(
    clanTag ? `/api/leadership/highlights?clanTag=${encodeURIComponent(clanTag)}` : null,
    apiFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    },
  );

  const snapshotLabel = useMemo(() => {
    if (!highlights?.snapshotFetchedAt) return "Snapshot pending";
    const parsed = new Date(highlights.snapshotFetchedAt);
    if (Number.isNaN(parsed.getTime())) return "Snapshot pending";
    return `${parsed.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })} UTC`;
  }, [highlights?.snapshotFetchedAt]);

  const windowLabel = useMemo(() => {
    if (!highlights?.windowStart || !highlights?.windowEnd) return "Last 7 days";
    const start = new Date(highlights.windowStart);
    const end = new Date(highlights.windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Last 7 days";
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }, [highlights?.windowStart, highlights?.windowEnd]);

  const formatEventMeta = (event: HighlightEvent) => {
    if (event.detail) return event.detail;
    if (!event.occurredAt) return null;
    const parsed = new Date(event.occurredAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderList = (items: HighlightEvent[], emptyLabel: string, linkAnchor?: string) => (
    <div className="space-y-2.5">
      {items.length ? (
        items.map((item) => (
          <div 
            key={`${item.tag}-${item.value}-${item.occurredAt ?? "na"}`} 
            className="group rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] px-3 py-3 shadow-sm transition-all hover:border-white/20 hover:shadow-md hover:shadow-clash-gold/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {linkAnchor ? (
                  <Link
                    href={`/new/player/${encodeURIComponent(item.tag)}${linkAnchor}`}
                    className="font-semibold text-white transition-colors group-hover:text-clash-gold/90 text-sm mb-1 block"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <div className="font-semibold text-white transition-colors group-hover:text-clash-gold/90 text-sm mb-1">
                    {item.name}
                  </div>
                )}
                <div className="text-xs text-slate-300 leading-relaxed break-words">
                  {item.value}
                </div>
                {item.detail && (
                  <div className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    {item.detail}
                  </div>
                )}
              </div>
              {formatEventMeta(item) && !item.detail && (
                <div className="flex-shrink-0 text-xs text-slate-500 whitespace-nowrap">
                  {formatEventMeta(item)}
                </div>
              )}
            </div>
            {item.detail && formatEventMeta(item) && (
              <div className="mt-2 pt-2 border-t border-white/5 text-xs text-slate-500">
                {formatEventMeta(item)}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-slate-500">
          {emptyLabel}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-slate-950/60 px-6 py-5">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <Crown className="h-4 w-4 text-clash-gold" />
          Leadership
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Leadership tool map</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Section headings below outline what still needs to be built or wired for leadership workflows.
        </p>
      </header>

      <Card
        title={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-clash-gold" />
              Weekly highlights
              <span className="ml-2 text-xs font-normal text-slate-400">{windowLabel}</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">Last snapshot:</span>
                <span className="font-medium text-white">{snapshotLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Members:</span>
                <span className="font-medium text-white">{highlights?.memberCount ?? "—"}</span>
              </div>
            </div>
          </div>
        }
      >
        {highlightsError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {highlightsError.message || "Failed to load highlights."}
          </div>
        )}
        {highlightsLoading && !highlights ? (
          <div className="text-xs text-slate-400">Loading highlights…</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  <ArrowUpRight className="h-4 w-4 text-emerald-300" />
                  Promotions
                </div>
                {renderList(highlights?.promotions ?? [], "No promotions logged yet.", "#league-history")}
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  <Zap className="h-4 w-4 text-cyan-300" />
                  Hero upgrades
                </div>
                {renderList(highlights?.heroUpgrades ?? [], "No hero upgrades detected yet.")}
              </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  <UserPlus className="h-4 w-4 text-clash-gold" />
                  New joiners
                </div>
                {renderList(highlights?.newJoiners ?? [], "No new joiners detected yet.")}
              </div>
              {highlights?.demotions?.length ? (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    <ArrowDownRight className="h-4 w-4 text-rose-300" />
                    Demotions to watch
                  </div>
                  {renderList(highlights.demotions, "No demotions logged this week.", "#league-history")}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isAvailable = section.href !== "#";
          return (
            <Card 
              key={section.title} 
              className={`transition-all ${
                isAvailable 
                  ? 'border-white/20 bg-gradient-to-br from-white/[0.08] to-white/[0.04] shadow-md hover:border-clash-gold/30 hover:shadow-lg hover:shadow-clash-gold/10 hover:scale-[1.02]' 
                  : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
              title={
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isAvailable ? 'text-clash-gold' : 'text-slate-500'}`} />
                  <span>{section.title}</span>
                </div>
              }
            >
              <ul className="space-y-2 text-sm text-slate-300">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isAvailable ? (
                  <Link 
                    href={section.href} 
                    className="inline-flex items-center gap-1.5 rounded-lg bg-clash-gold/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-clash-gold transition-all hover:bg-clash-gold/20 hover:shadow-md hover:shadow-clash-gold/20"
                  >
                    Open
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                    Coming soon
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
