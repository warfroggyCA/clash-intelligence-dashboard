"use client";

import { useMemo } from 'react';
import { useDashboardStore, selectors, useShallow } from '@/lib/stores/dashboard-store';
import { GlassCard, Button } from '@/components/ui';
import TodaysBriefing from '@/components/TodaysBriefing';
import LeadershipGuard from '@/components/LeadershipGuard';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import { normalizeTag } from '@/lib/tags';
import type { ChangeSummary, TabType } from '@/types';

const SectionTitle: React.FC<{ icon: string; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-slate-100">
      <span className="text-xl">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
    {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
  </div>
);

const navigateTo = (tab: TabType, setActiveTab: (tab: TabType) => void) => () => {
  setActiveTab(tab);
};

export const InsightsDashboard: React.FC = () => {
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const roster = useDashboardStore(useShallow((state) => state.roster));
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);

  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const smartInsights = useDashboardStore(selectors.smartInsights);
  const smartInsightsStatus = useDashboardStore(selectors.smartInsightsStatus);
  const smartInsightsError = useDashboardStore(selectors.smartInsightsError);

  const normalizedTag = useMemo(() => normalizeTag(clanTag) || clanTag, [clanTag]);
  const historyEntry = useDashboardStore((state) =>
    normalizedTag ? state.historyByClan[normalizedTag] : undefined
  );

  const memberCount = roster?.members?.length ?? 0;
  const insightsGeneratedAt = smartInsights?.metadata?.generatedAt
    ? safeLocaleString(smartInsights.metadata.generatedAt, {
        fallback: smartInsights.metadata.generatedAt,
        context: 'InsightsDashboard smartInsights.metadata.generatedAt',
      })
    : 'Unknown';

  const freshnessLabel = useMemo(() => {
    if (dataAgeHours == null) return 'Unknown';
    if (dataAgeHours <= 24) return 'Fresh (≤24h)';
    if (dataAgeHours <= 48) return 'Stale (24–48h)';
    return 'Outdated (>48h)';
  }, [dataAgeHours]);

  const hasPayload = Boolean(smartInsights);
  const highlightCount = smartInsights?.briefing?.highlights?.length ?? 0;

  const insightStatusLabel = useMemo(() => {
    if (smartInsightsStatus === 'loading') return 'Refreshing';
    if (smartInsightsStatus === 'error') return 'Error';
    if (!hasPayload) return 'No insights yet';
    return highlightCount > 0 ? 'Fresh' : 'No insights yet';
  }, [smartInsightsStatus, hasPayload, highlightCount]);

  const recentChanges: ChangeSummary[] = useMemo(() => {
    if (!historyEntry?.items?.length) return [];
    return historyEntry.items.slice(0, 5);
  }, [historyEntry?.items]);

  const coachingHighlights = useMemo(() => {
    return smartInsights?.coaching?.slice(0, 3) ?? [];
  }, [smartInsights?.coaching]);

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionTitle icon="🧭" title="Snapshot & Data Health" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-200">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Clan</p>
            <p className="font-semibold text-slate-100">{clanTag || 'No clan selected'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Members tracked</p>
            <p className="font-semibold text-slate-100">{memberCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Snapshot date</p>
            <p className="font-semibold text-slate-100">
              {snapshotMetadata?.snapshotDate
                ? safeLocaleDateString(snapshotMetadata.snapshotDate, {
                    fallback: snapshotMetadata.snapshotDate,
                    context: 'InsightsDashboard snapshotMetadata.snapshotDate',
                  })
                : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Freshness</p>
            <p className="font-semibold text-slate-100">{freshnessLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Insight status</p>
            <p className="font-semibold text-slate-100">{insightStatusLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Insights generated</p>
            <p className="font-semibold text-slate-100">{insightsGeneratedAt}</p>
          </div>
          <div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 md:mt-0"
              onClick={navigateTo('changes', setActiveTab)}
            >
              Open History Overview
            </Button>
          </div>
          <div>
            <Button
              size="sm"
              className="mt-2 md:mt-0"
              onClick={navigateTo('roster', setActiveTab)}
            >
              View Roster Detail
            </Button>
          </div>
        </div>
        {smartInsightsError && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            {smartInsightsError}
          </div>
        )}
      </GlassCard>

      <GlassCard className="space-y-4">
        <SectionTitle icon="💡" title="Today&apos;s Briefing" subtitle="Key insights from the latest snapshot" />
        <TodaysBriefing />
      </GlassCard>

      <GlassCard className="space-y-4">
        <SectionTitle icon="📜" title="Latest Change Summary" subtitle="Most recent roster updates" />
        {recentChanges.length > 0 ? (
          <ul className="space-y-3 text-sm text-slate-200">
            {recentChanges.map((entry) => (
              <li key={`${entry.clanTag}-${entry.createdAt}`} className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">
                    {safeLocaleDateString(entry.date, {
                      fallback: entry.date,
                      context: 'InsightsDashboard changeSummary.date',
                    })}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-blue-300 hover:text-blue-200"
                    onClick={navigateTo('changes', setActiveTab)}
                  >
                    View full history
                  </Button>
                </div>
                <p className="mt-2 text-slate-200">{entry.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300">
            No recorded roster changes yet. Load a clan snapshot or refresh data to populate this section.
          </p>
        )}
      </GlassCard>

      <LeadershipGuard requiredPermission="canViewLeadershipFeatures" fallback={null}>
        <GlassCard className="space-y-4">
          <SectionTitle icon="🎯" title="Leadership Callouts" subtitle="Top action items for clan leaders" />
          {coachingHighlights.length > 0 ? (
            <ul className="space-y-3 text-sm text-slate-200">
              {coachingHighlights.map((tip, index) => (
                <li key={`${tip.title}-${index}`} className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle/70 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{tip.title}</p>
                    <span className="rounded-full border border-brand-border/50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                      {tip.priority}
                    </span>
                  </div>
                  {tip.description && <p className="mt-2 text-slate-200">{tip.description}</p>}
                  {tip.chatMessage && (
                    <p className="mt-2 text-xs text-slate-400">
                      Suggested share: <span className="text-slate-200">{tip.chatMessage}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-300">
              Leadership insights will appear here once the next Smart Insights run completes.
            </p>
          )}
        </GlassCard>
      </LeadershipGuard>
    </div>
  );
};

export default InsightsDashboard;
