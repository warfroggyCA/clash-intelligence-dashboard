"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDistanceToNow } from 'date-fns';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { generateAlerts } from '@/lib/alerts-engine';
import type { Member } from '@/lib/clan-metrics';
import type { ChangeSummary } from '@/types';
import { Button } from '@/components/ui';
import { showToast } from '@/lib/toast';
import { AlertTriangle, ClipboardCheck, Bell, Sparkles, Check } from 'lucide-react';

interface NewsFeedProps {
  clanTag?: string | null;
}

export interface NewsFeedRef {
  refresh: () => Promise<void>;
}

type Priority = 'high' | 'medium' | 'low';
type EventSource = 'alert' | 'change';

interface ActionEvent {
  id: string;
  source: EventSource;
  title: string;
  detail: string;
  priority: Priority;
  category: string;
  actionable?: string;
  players?: string[];
  bullets?: string[];
  timestamp?: string;
  summaryDate?: string;
  createdAt?: string;
  actionType: 'local' | 'server';
  isActioned: boolean;
  unread?: boolean;
}

interface HighlightCard {
  id: string;
  title: string;
  detail?: string | null;
  badge?: string | null;
  category?: string | null;
}

const ACTION_STORAGE_KEY = 'leadership-feed-actioned';
const HISTORY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const INSIGHTS_TTL_MS = 10 * 60 * 1000;

const NewsFeed = forwardRef<NewsFeedRef, NewsFeedProps>(({ clanTag: propClanTag }, ref) => {
  const fallbackClanTag = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag || '');
  const resolvedClanTag = normalizeTag(propClanTag || fallbackClanTag || '');

  const roster = useDashboardStore(useShallow((state) => state.roster));
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const { smartInsights, smartInsightsStatus } = useDashboardStore(useShallow((state) => ({
    smartInsights: state.smartInsights,
    smartInsightsStatus: state.smartInsightsStatus,
  })));
  const historyEntry = useDashboardStore((state) =>
    resolvedClanTag ? state.historyByClan[resolvedClanTag] : undefined
  );
  const loadHistory = useDashboardStore((state) => state.loadHistory);
  const mutateHistoryItems = useDashboardStore((state) => state.mutateHistoryItems);
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Hydrate actioned events from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = resolvedClanTag ? `${ACTION_STORAGE_KEY}:${resolvedClanTag}` : null;
    if (!key) {
      setLocalCompleted(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLocalCompleted(new Set(Array.isArray(parsed) ? parsed : []));
      } else {
        setLocalCompleted(new Set());
      }
    } catch (error) {
      console.warn('[Leadership NewsFeed] Failed to load local action state:', error);
      setLocalCompleted(new Set());
    }
  }, [resolvedClanTag]);

  const persistLocalCompleted = useCallback(
    (next: Set<string>) => {
      setLocalCompleted(new Set(next));
      if (typeof window === 'undefined') return;
      if (!resolvedClanTag) return;
      try {
        localStorage.setItem(`${ACTION_STORAGE_KEY}:${resolvedClanTag}`, JSON.stringify([...next]));
      } catch (error) {
        console.warn('[Leadership NewsFeed] Failed to persist action state:', error);
      }
    },
    [resolvedClanTag]
  );

  // Ensure history data is loaded and refreshed periodically
  useEffect(() => {
    if (!resolvedClanTag) return;
    const lastFetched = historyEntry?.lastFetched ?? 0;
    const isStale = Date.now() - lastFetched > HISTORY_TTL_MS;
    if ((!historyEntry || isStale) && historyEntry?.status !== 'loading') {
      void loadHistory(resolvedClanTag, { force: !historyEntry });
    }
  }, [resolvedClanTag, historyEntry, loadHistory]);

  // Ensure smart insights are loaded
  useEffect(() => {
    if (!resolvedClanTag) return;
    void loadSmartInsights(resolvedClanTag, { ttlMs: INSIGHTS_TTL_MS });
  }, [resolvedClanTag, loadSmartInsights]);

  // Expose refresh handle
  const refreshData = useCallback(async () => {
    if (!resolvedClanTag) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        loadHistory(resolvedClanTag, { force: true }),
        loadSmartInsights(resolvedClanTag, { force: true }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [resolvedClanTag, loadHistory, loadSmartInsights]);

  useImperativeHandle(ref, () => ({ refresh: refreshData }), [refreshData]);

  // Members data for alerts
  const members: Member[] = useMemo(() => {
    return (roster?.members as Member[]) || [];
  }, [roster?.members?.length]);

  const alerts = useMemo(() => {
    if (!members.length) return [];
    try {
      return generateAlerts(members);
    } catch (error) {
      console.warn('[Leadership NewsFeed] Failed to generate alerts:', error);
      return [];
    }
  }, [members]);

  const priorityWeight: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

  const alertEvents: ActionEvent[] = useMemo(() => {
    return alerts.map((alert) => {
      const idBase = [
        alert.category,
        alert.title,
        alert.metric || '',
        [...alert.affectedMembers].sort().join('-'),
      ].join(':');
      return {
        id: `alert:${idBase}`,
        source: 'alert',
        title: alert.title,
        detail: alert.description,
        actionable: alert.actionable,
        priority: alert.priority,
        category: alert.category,
        players: alert.affectedMembers,
        timestamp: alert.timestamp,
        actionType: 'local',
        isActioned: false,
      };
    });
  }, [alerts]);

  const changeEvents: ActionEvent[] = useMemo(() => {
    if (!historyEntry?.items?.length) return [];
    const summaries = historyEntry.items.slice(0, 5);
    return summaries
      .filter((summary) => Array.isArray(summary.changes) && summary.changes.length > 0)
      .map((summary) => {
        const prettyDate = (() => {
          try {
            const date = summary.createdAt || summary.date;
            if (!date) return 'Snapshot review';
            return new Date(date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          } catch {
            return 'Snapshot review';
          }
        })();

        return {
          id: `change:${summary.date}:${summary.createdAt ?? ''}`,
          source: 'change',
          title: `Snapshot ${prettyDate}`,
          detail: summary.summary || 'Snapshot recorded updates for the clan.',
          priority: summary.unread ? 'high' : summary.actioned ? 'low' : 'medium',
          category: 'changes',
          timestamp: summary.createdAt || summary.date,
          bullets: summary.changes?.map((change) => change.description) ?? [],
          actionType: 'server',
          summaryDate: summary.date,
          createdAt: summary.createdAt,
          isActioned: summary.actioned,
          unread: summary.unread,
        };
      });
  }, [historyEntry?.items]);

  const actionQueue: ActionEvent[] = useMemo(() => {
    const events = [...alertEvents, ...changeEvents];
    return events
      .sort((a, b) => {
        const aWeight = priorityWeight[a.priority] + (a.unread ? 1 : 0);
        const bWeight = priorityWeight[b.priority] + (b.unread ? 1 : 0);
        return bWeight - aWeight;
      })
      .slice(0, 8);
  }, [alertEvents, changeEvents]);

  const highlightCards: HighlightCard[] = useMemo(() => {
    const highlights = smartInsights?.briefing?.highlights ?? [];
    if (!highlights.length) {
      const recognition = smartInsights?.recognition?.players ?? [];
      return recognition.slice(0, 3).map((player) => ({
        id: `recognition:${player.tag}`,
        title: `${player.name} recognized`,
        detail: player.reason ?? 'Consistent performance flagged by VIP.',
        badge: player.category ?? 'recognition',
      }));
    }
    return highlights.slice(0, 4).map((highlight) => ({
      id: highlight.id ?? `highlight:${highlight.category}:${highlight.headline}`,
      title: highlight.headline,
      detail: highlight.detail,
      badge: highlight.priority?.toUpperCase() ?? 'VIP',
      category: highlight.category,
    }));
  }, [smartInsights]);

  const overviewSummary = smartInsights?.briefing?.summary ?? smartInsights?.context?.changeSummary?.content;
  const dataDate = smartInsights?.metadata?.snapshotDate ?? snapshotMetadata?.snapshotDate ?? null;
  const generatedAt = smartInsights?.metadata?.generatedAt ?? null;

  const isHistoryLoading = historyEntry?.status === 'loading';
  const historyError = historyEntry?.status === 'error' ? historyEntry.error : null;

  const localCompletedIds = localCompleted;

  const handleToggleAction = useCallback(
    async (event: ActionEvent) => {
      if (event.isActioned) return;
      if (event.actionType === 'server') {
        if (!resolvedClanTag || !event.summaryDate) return;
        setPendingAction(event.id);
        try {
          const response = await fetch('/api/snapshots/changes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clanTag: resolvedClanTag, date: event.summaryDate, action: 'actioned' }),
          });

          if (!response.ok) {
            const message = await response.text().catch(() => 'Failed to update event');
            throw new Error(message);
          }

          mutateHistoryItems(resolvedClanTag, (items) =>
            items.map((item) => {
              if (item.date === event.summaryDate) {
                return { ...item, actioned: true, unread: false };
              }
              return item;
            })
          );
        } catch (error: any) {
          console.error('[Leadership NewsFeed] Failed to mark change event as actioned:', error);
          showToast(error?.message || 'Failed to update event', 'error');
        } finally {
          setPendingAction(null);
        }
      } else {
        const next = new Set(localCompletedIds);
        if (next.has(event.id)) {
          next.delete(event.id);
        } else {
          next.add(event.id);
        }
        persistLocalCompleted(next);
      }
    },
    [resolvedClanTag, localCompletedIds, mutateHistoryItems, persistLocalCompleted]
  );

  const isEventCompleted = useCallback(
    (event: ActionEvent) => {
      if (event.actionType === 'server') {
        return event.isActioned;
      }
      return localCompletedIds.has(event.id);
    },
    [localCompletedIds]
  );

  const priorityTone = (priority: Priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-300';
      case 'medium':
        return 'text-amber-300';
      case 'low':
        return 'text-slate-300';
      default:
        return 'text-slate-300';
    }
  };

  const dataFreshnessLabel = useMemo(() => {
    if (!dataDate) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(dataDate), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  }, [dataDate]);

  const insightsGeneratedLabel = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return formatDistanceToNow(new Date(generatedAt), { addSuffix: true });
    } catch {
      return null;
    }
  }, [generatedAt]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          isRefreshing
            ? 'border-blue-700/50 bg-blue-900/20 text-blue-200'
            : 'border-slate-700/50 bg-slate-900/30 text-slate-400'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {dataDate ? `Snapshot ${new Date(dataDate).toLocaleDateString()} • ` : ''}
            {dataFreshnessLabel && `Data ${dataFreshnessLabel}`}
            {insightsGeneratedLabel && ` • Insights ${insightsGeneratedLabel}`}
          </span>
          <Button size="xs" variant="ghost" onClick={() => void refreshData()} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {overviewSummary && (
        <div className="rounded-lg border border-cyan-700/50 bg-cyan-900/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            <Sparkles className="h-4 w-4" />
            Today&rsquo;s Overview
          </div>
          <p className="text-sm leading-relaxed text-cyan-50 whitespace-pre-wrap">{overviewSummary}</p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Action Queue
        </div>

        {historyError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {historyError}
          </div>
        )}

        {actionQueue.length === 0 ? (
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-4 text-sm text-slate-400">
            No actionable items right now. You&rsquo;re all caught up!
          </div>
        ) : (
          actionQueue.map((event) => {
            const completed = isEventCompleted(event);
            return (
              <div
                key={event.id}
                className={`rounded-lg border px-4 py-3 text-sm transition ${
                  completed ? 'border-green-700/40 bg-green-900/20' : 'border-slate-800/60 bg-slate-900/40'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                      <span className={`${priorityTone(event.priority)} font-semibold`}>
                        {event.priority.toUpperCase()}
                      </span>
                      <span className="text-slate-400">{event.category}</span>
                      {event.unread && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          New
                        </span>
                      )}
                      {completed && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <Check className="h-3 w-3" />
                          Done
                        </span>
                      )}
                    </div>
                    <div className="text-slate-100 font-semibold">{event.title}</div>
                    <p className="text-slate-300 leading-relaxed">{event.detail}</p>
                    {event.bullets && event.bullets.length > 0 && (
                      <ul className="list-disc list-inside text-slate-300 space-y-1">
                        {event.bullets.slice(0, 4).map((bullet, index) => (
                          <li key={`${event.id}-bullet-${index}`}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {event.players && event.players.length > 0 && (
                      <div className="text-xs text-slate-400">
                        Players: {event.players.map((tag) => tag.replace('#', '')).join(', ')}
                      </div>
                    )}
                    {event.actionable && (
                      <div className="rounded-md border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                        <ClipboardCheck className="mr-2 inline h-3 w-3 text-emerald-300" />
                        {event.actionable}
                      </div>
                    )}
                  </div>

                  {!completed && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingAction === event.id}
                      onClick={() => void handleToggleAction(event)}
                      className="self-start"
                    >
                      {event.actionType === 'server' ? 'Mark Actioned' : 'Mark Done'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Bell className="h-4 w-4 text-sky-400" />
          Latest Highlights
        </div>
        {smartInsightsStatus === 'loading' && (
          <div className="text-xs text-slate-400">Loading highlights…</div>
        )}
        {highlightCards.length === 0 ? (
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-4 text-sm text-slate-400">
            No highlights available. Run a fresh ingestion to populate VIP stories.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {highlightCards.map((card) => (
              <div key={card.id} className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>{card.badge || card.category || 'VIP Highlight'}</span>
                  <Sparkles className="h-3 w-3 text-slate-500" />
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{card.title}</div>
                {card.detail && <p className="mt-1 text-sm text-slate-300">{card.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
});

NewsFeed.displayName = 'NewsFeed';

export default NewsFeed;
