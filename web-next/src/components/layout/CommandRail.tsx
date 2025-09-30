"use client";

import { useMemo } from 'react';
import { Loader2, PanelRightClose, PanelRightOpen, ShieldCheck } from 'lucide-react';
import { Button, GlassCard } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { useQuickActions } from './QuickActions';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import type { TabType } from '@/types';

interface CommandRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

const cardClass =
  'command-rail-card rounded-3xl border border-brand-border/80 bg-brand-surfaceRaised/90 shadow-[0_20px_42px_-28px_rgba(8,15,31,0.78)] backdrop-blur-lg px-5 py-5 flex flex-col gap-3';

const formatSnapshotFreshness = (hours: number | undefined) => {
  if (hours == null) return 'Unknown';
  if (hours <= 24) return 'Fresh (≤24h)';
  if (hours <= 48) return 'Stale (24–48h)';
  return 'Outdated (>48h)';
};

const smartInsightsState = (status: ReturnType<typeof selectors.smartInsightsStatus>, isStale: boolean) => {
  if (status === 'loading') return 'Refreshing';
  if (status === 'error') return 'Error';
  if (isStale) return 'Stale';
  return 'Fresh';
};

const CommandRail: React.FC<CommandRailProps> = ({ isOpen, onToggle }) => {
  const roster = useDashboardStore((state) => state.roster);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt);
  const lastLoadInfo = useDashboardStore((state) => state.lastLoadInfo);
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);
  const setShowIngestionMonitor = useDashboardStore((state) => state.setShowIngestionMonitor);

  const {
    handleRefreshData,
    handleRefreshInsights,
    isRefreshing,
    isRefreshingInsights,
    smartInsightsStatus,
    smartInsightsError,
    smartInsightsIsStale,
  } = useQuickActions();

  const memberCount = roster?.members?.length ?? 0;
  const snapshotDateLabel = snapshotMetadata?.snapshotDate
    ? safeLocaleDateString(snapshotMetadata.snapshotDate, {
        fallback: snapshotMetadata.snapshotDate,
        context: 'CommandRail snapshotMetadata.snapshotDate',
      })
    : 'Unknown snapshot';

  const fetchedAtSource = snapshotMetadata?.fetchedAt ?? dataFetchedAt;
  const fetchedAtLabel = fetchedAtSource
    ? safeLocaleString(fetchedAtSource, {
        fallback: 'recently',
        context: 'CommandRail snapshot fetchedAt',
      })
    : 'Unknown';

  const freshnessLabel = useMemo(
    () => formatSnapshotFreshness(dataAgeHours),
    [dataAgeHours]
  );

  const insightsLabel = useMemo(
    () => smartInsightsState(smartInsightsStatus, smartInsightsIsStale),
    [smartInsightsStatus, smartInsightsIsStale]
  );

  const handleNavigate = (tab: TabType) => {
    setActiveTab(tab);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-0 top-[var(--command-rail-top,120px)] z-40 w-full max-w-md px-4 lg:relative lg:top-0 lg:z-auto lg:h-full lg:w-80 lg:max-w-none lg:px-0">
      <div className={`flex h-full flex-col gap-4 ${isOpen ? '' : 'lg:opacity-60'}`}>
        <div className="command-rail-header flex items-center justify-between rounded-3xl border border-brand-border/80 bg-brand-surfaceRaised/95 px-5 py-4 shadow-[0_20px_42px_-28px_rgba(8,15,31,0.78)] backdrop-blur-lg">
          <div className="flex items-center gap-3 text-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-surfaceSubtle text-brand-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Leadership Command Rail</p>
              <p className="text-sm font-semibold text-slate-100">Quick status & controls</p>
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

        <GlassCard className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Snapshot status</p>
              <p className="text-sm font-semibold text-slate-100">{clanTag || 'No clan loaded'}</p>
            </div>
            {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-300">
            <p>
              Snapshot date: <span className="text-slate-100">{snapshotDateLabel}</span>
            </p>
            <p>
              Members tracked: <span className="text-slate-100">{memberCount}</span>
            </p>
            <p>
              Freshness: <span className="text-slate-100">{freshnessLabel}</span>
            </p>
            <p>
              Last fetched: <span className="text-slate-100">{fetchedAtLabel}</span>
            </p>
            {lastLoadInfo && (
              <p>
                Last load: <span className="text-slate-100">{`${lastLoadInfo.source ?? 'unknown'} • ${lastLoadInfo.ms ?? 0}ms`}</span>
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="flex-1 min-w-[8rem] bg-brand-primary text-white hover:bg-brand-secondary"
              onClick={() => handleRefreshData()}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Snapshot
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 min-w-[8rem] bg-brand-surfaceSubtle text-slate-100 hover:bg-brand-surfaceRaised"
              onClick={() => setShowIngestionMonitor(true)}
            >
              Monitor Jobs
            </Button>
          </div>
        </GlassCard>

        <GlassCard className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Insights status</p>
              <p className="text-sm font-semibold text-slate-100">{insightsLabel}</p>
            </div>
            {isRefreshingInsights && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-300">
            <p>
              Summary freshness: <span className="text-slate-100">{smartInsightsIsStale ? 'Needs refresh' : 'Current'}</span>
            </p>
            {smartInsightsError && (
              <p className="text-amber-300">{smartInsightsError}</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 min-w-[8rem] bg-brand-surfaceSubtle text-slate-100 hover:bg-brand-surfaceRaised"
              onClick={() => handleRefreshInsights()}
              disabled={isRefreshingInsights || smartInsightsStatus === 'loading'}
            >
              {isRefreshingInsights ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Insights
            </Button>
            <Button
              size="sm"
              className="flex-1 min-w-[8rem] bg-brand-primary text-white hover:bg-brand-secondary"
              onClick={() => handleNavigate('coaching')}
            >
              View Insights Tab
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 w-full text-slate-300 hover:text-white"
            onClick={() => handleNavigate('changes')}
          >
            Open History Overview
          </Button>
        </GlassCard>
      </div>
    </aside>
  );
};

export default CommandRail;
