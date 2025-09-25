"use client";

import { useMemo } from 'react';
import {
  AlertTriangle,
  BellRing,
  ChevronRight,
  CircleCheck,
  DatabaseZap,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { useQuickActions } from './QuickActions';
import { Button, GlassCard } from '@/components/ui';
import { safeLocaleString } from '@/lib/date';
import { normalizeTag } from '@/lib/tags';

interface CommandRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

const cardClass =
  'rounded-3xl border border-brand-border/80 bg-brand-surfaceRaised/90 shadow-[0_20px_42px_-28px_rgba(8,15,31,0.78)] backdrop-blur-lg px-5 py-5 flex flex-col gap-3';

export const CommandRail: React.FC<CommandRailProps> = ({ isOpen, onToggle }) => {
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const normalizedTag = normalizeTag(clanTag);
  const smartInsights = useDashboardStore(selectors.smartInsights);
  const smartInsightsStatus = useDashboardStore(selectors.smartInsightsStatus);
  const smartInsightsError = useDashboardStore(selectors.smartInsightsError);
  const smartInsightsHeadlines = useDashboardStore(selectors.smartInsightsHeadlines);
  const smartInsightsIsStale = useDashboardStore(selectors.smartInsightsIsStale);
  const departureNotifications = useDashboardStore((state) => state.departureNotifications);
  const setShowDepartureManager = useDashboardStore((state) => state.setShowDepartureManager);
  const historyEntry = useDashboardStore((state) =>
    normalizedTag ? state.historyByClan[normalizedTag] : undefined
  );
  const lastLoadInfo = useDashboardStore((state) => state.lastLoadInfo);
  const setShowIngestionMonitor = useDashboardStore((state) => state.setShowIngestionMonitor);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt);

  const {
    handleRefreshData,
    handleRefreshInsights,
    handleGenerateInsightsSummary,
    handleCopySnapshotSummary,
    handleCopyRosterJson,
    handleExportSnapshot,
    isRefreshing,
    isRefreshingInsights,
    isGeneratingSummary,
    isExporting,
  } = useQuickActions();

  const latestChangeSummary = useMemo(() => {
    if (!historyEntry?.items?.length) return null;
    return historyEntry.items[0];
  }, [historyEntry]);

  const insightItems = useMemo(() => {
    if (!smartInsightsHeadlines?.length) return [];
    return smartInsightsHeadlines.slice(0, 4).map((item) => ({
      id: item.id || item.title,
      text: item.detail ? item.detail.split('\n')[0] : item.title,
      priority: item.priority,
    }));
  }, [smartInsightsHeadlines]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-0 top-[var(--command-rail-top,120px)] z-40 w-full max-w-md px-4 lg:relative lg:top-0 lg:z-auto lg:h-full lg:w-80 lg:max-w-none lg:px-0">
      <div
        className={`flex h-full flex-col gap-4 ${isOpen ? '' : 'lg:opacity-60'}`}
      >
        <div className="flex items-center justify-between rounded-3xl border border-brand-border/80 bg-brand-surfaceRaised/95 px-5 py-4 shadow-[0_20px_42px_-28px_rgba(8,15,31,0.78)] backdrop-blur-lg">
          <div className="flex items-center gap-3 text-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-surfaceSubtle text-brand-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Leadership Command Rail</p>
              <p className="text-sm font-semibold text-slate-100">Real-time signals & controls</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-200 hover:bg-brand-surfaceSubtle/80"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse command rail' : 'Expand command rail'}
          >
            {isOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>

        <div className={`${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Daily Smart Insights</h3>
              <p className="text-xs text-slate-400">Top highlights from the latest snapshot</p>
            </div>
            {smartInsightsStatus === 'loading' && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            )}
          </div>

          {smartInsightsError ? (
            <div className="rounded-2xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <p className="font-semibold">Insights unavailable</p>
                  <p className="text-xs">{smartInsightsError}</p>
                  <button
                    onClick={() => setShowIngestionMonitor(true)}
                    className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300 hover:text-amber-200"
                  >
                    Open monitor
                  </button>
                </div>
              </div>
            </div>
          ) : insightItems.length ? (
            <ul className="space-y-2 text-xs text-slate-200">
              {insightItems.map((headline) => (
                <li
                  key={headline.id}
                  className="flex items-start gap-3 rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2 text-left"
                >
                  <span className={`mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full ${
                    headline.priority === 'high'
                      ? 'bg-amber-300'
                      : headline.priority === 'medium'
                        ? 'bg-brand-primary'
                        : 'bg-slate-500'
                  }`} />
                  <span className="leading-snug">{headline.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle/70 px-3 py-3 text-xs text-slate-300">
              {smartInsightsIsStale
                ? 'Last insights are stale. Refresh to pull the latest headlines.'
                : 'No highlights yet. Run an ingestion job to generate today\'s summary.'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 text-xs">
            <Button
              size="xs"
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => handleRefreshInsights()}
              disabled={isRefreshingInsights || smartInsightsStatus === 'loading'}
            >
              Refresh
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setShowIngestionMonitor(true)}
            >
              Ingestion Monitor
            </Button>
          </div>
        </div>

        <div className={`${cardClass}`}>
          <div className="flex items-center gap-2 text-slate-100">
            <BellRing className="h-4 w-4 text-clash-gold" />
            <h3 className="text-sm font-semibold">Alerts & Signals</h3>
          </div>

          <div className="space-y-3 text-xs text-slate-200">
            <button
              onClick={() => setShowDepartureManager(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2 text-left transition hover:bg-brand-surfaceSubtle"
            >
              <div>
                <p className="font-semibold">Departure alerts</p>
                <p className="text-slate-400">Members needing review</p>
              </div>
              <span className={`flex h-6 min-w-[2.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                departureNotifications > 0
                  ? 'bg-amber-300/85 text-slate-900'
                  : 'bg-brand-surfaceRaised/70 text-slate-400'
              }`}>
                {departureNotifications}
              </span>
            </button>

            {latestChangeSummary ? (
              <div className="rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Latest summary</p>
                <p className="text-xs text-slate-100 line-clamp-3">
                  {latestChangeSummary.summary || 'Recent changes available. Open the change dashboard for details.'}
                </p>
                <button
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300 hover:text-blue-200"
                  onClick={() => {
                    const url = `/dashboard/changes?clanTag=${encodeURIComponent(clanTag)}`;
                    if (typeof window !== 'undefined') window.open(url, '_blank');
                  }}
                >
                  Open change dashboard
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2 text-slate-400">
                No change summaries yet. Run an ingestion or refresh to generate updates.
              </div>
            )}
          </div>
        </div>

        <div className={`${cardClass}`}>
          <div className="flex items-center gap-2 text-slate-100">
            <DatabaseZap className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold">Ingestion Status</h3>
          </div>

          <div className="space-y-3 text-xs text-slate-200">
            {lastLoadInfo ? (
              <div className="rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Last snapshot</p>
                <p className="font-semibold text-slate-100">
                  {lastLoadInfo.source === 'live' ? 'Live pull' : lastLoadInfo.source === 'snapshot' ? 'Snapshot' : 'Fallback'}
                  <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-slate-500">
                    {safeLocaleString(dataFetchedAt || Date.now(), {
                      options: { hour: '2-digit', minute: '2-digit' },
                      fallback: 'recently',
                      context: 'CommandRail last load info timestamp',
                    })}
                  </span>
                </p>
                <p className="mt-1 text-slate-300">
                  {lastLoadInfo.tenureMatches ?? 0}/{lastLoadInfo.total ?? 0} tenure records synced
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-brand-surfaceSubtle/80 px-3 py-2 text-slate-400">
                No ingestion runs recorded yet for this session.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 min-w-[8rem] bg-brand-surfaceSubtle text-slate-100 hover:bg-brand-surfaceRaised"
                onClick={() => handleRefreshData()}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh Snapshot
              </Button>
              <Button
                size="sm"
                className="flex-1 min-w-[8rem] bg-brand-primary text-white hover:bg-brand-secondary"
                onClick={() => setShowIngestionMonitor(true)}
              >
                Monitor Jobs
              </Button>
            </div>
          </div>
        </div>

        <GlassCard
          className="rounded-3xl border border-brand-border/80 bg-brand-surfaceRaised/90 shadow-[0_20px_42px_-28px_rgba(8,15,31,0.78)]"
          icon={<Wand2 className="h-5 w-5 text-brand-primary" />}
          title="Actions"
          subtitle="Run leadership workflows in one tap"
        >
          <div className="grid grid-cols-1 gap-2 text-xs text-slate-200">
            <Button
              size="sm"
              className="w-full justify-between bg-brand-primary text-white hover:bg-brand-secondary"
              onClick={() => handleGenerateInsightsSummary()}
              disabled={isGeneratingSummary}
            >
              Insights Summary
              {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-full justify-between bg-brand-surfaceSubtle text-slate-100 hover:bg-brand-surfaceRaised"
              onClick={() => handleCopySnapshotSummary()}
            >
              Copy Snapshot Summary
              <CircleCheck className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-full justify-between bg-brand-surfaceSubtle text-slate-100 hover:bg-brand-surfaceRaised"
              onClick={() => handleCopyRosterJson()}
            >
              Copy Roster JSON
              <CircleCheck className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 justify-between border-brand-border text-slate-100 hover:bg-brand-surfaceSubtle"
                onClick={() => handleExportSnapshot('json')}
                disabled={isExporting}
              >
                Export JSON
                <CircleCheck className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 justify-between border-brand-border text-slate-100 hover:bg-brand-surfaceSubtle"
                onClick={() => handleExportSnapshot('csv')}
                disabled={isExporting}
              >
                Export CSV
                <CircleCheck className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </aside>
  );
};

export default CommandRail;
