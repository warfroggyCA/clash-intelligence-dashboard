"use client";

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Crown, Megaphone, RefreshCcw, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';

interface TodaysBriefingProps {
  className?: string;
}

const sentimentStyles: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
  neutral: 'bg-slate-500/15 text-slate-200 border border-slate-400/20',
  warning: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
};

const priorityAccent: Record<'high' | 'medium' | 'low', string> = {
  high: 'border-emerald-400/60 bg-emerald-500/10',
  medium: 'border-blue-400/50 bg-blue-500/10',
  low: 'border-slate-500/40 bg-slate-500/10',
};

const emphasisBadge: Record<'celebrate' | 'watch' | 'warn', string> = {
  celebrate: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
  watch: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  warn: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
};

export default function TodaysBriefing({ className = '' }: TodaysBriefingProps) {
  const status = useDashboardStore(selectors.smartInsightsStatus);
  const error = useDashboardStore(selectors.smartInsightsError);
  const diagnostics = useDashboardStore((state) => state.smartInsights?.diagnostics);
  const metadata = useDashboardStore((state) => state.smartInsights?.metadata);
  const briefing = useDashboardStore((state) => state.smartInsights?.briefing);
  const recognition = useDashboardStore((state) => state.smartInsights?.recognition);
  const playerOfTheDayFromPayload = useDashboardStore((state) => state.smartInsights?.playerOfTheDay ?? null);
  const playerOfTheDay = recognition?.playerOfTheDay ?? playerOfTheDayFromPayload;
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const setShowIngestionMonitor = useDashboardStore((state) => state.setShowIngestionMonitor);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const generatedAtLabel = useMemo(() => {
    if (!metadata?.generatedAt) return null;
    try {
      return formatDistanceToNow(new Date(metadata.generatedAt), { addSuffix: true });
    } catch (err) {
      console.error('[TodayBriefing] Failed to format generatedAt timestamp:', err);
      return null;
    }
  }, [metadata?.generatedAt]);

  const sentiment = briefing?.sentiment ?? 'neutral';
  const sentimentClass = sentimentStyles[sentiment] ?? sentimentStyles.neutral;
  const sentimentLabel = sentiment === 'positive' ? 'Momentum Up' : sentiment === 'warning' ? 'Needs Attention' : 'Status Update';

  const highlights = briefing?.highlights ?? [];
  const spotlights = recognition?.spotlights ?? [];
  const watchlist = recognition?.watchlist ?? [];
  const callouts = recognition?.callouts ?? [];

  const handleRefresh = async () => {
    if (!clanTag || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadSmartInsights(clanTag, { force: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (status === 'loading' && !briefing) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCcw className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium tracking-wide">Loading daily briefing…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-2xl border border-amber-200/25 bg-amber-200/10 p-4 ${className}`}>
        <div className="flex items-start gap-3 text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div className="flex-1 space-y-2">
            <div>
              <p className="font-semibold">Unable to load today&apos;s briefing</p>
              <p className="text-sm text-amber-100/80">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="px-0 text-amber-100/90 hover:text-amber-50"
                onClick={() => setShowIngestionMonitor(true)}
              >
                Open ingestion monitor
              </Button>
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    const message = diagnostics?.openAIConfigured === false
      ? 'Smart insights are disabled. Add an OpenAI key to enable automated briefings.'
      : 'No automated briefing yet. Run an ingestion job to generate today’s update.';
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl bg-brand-surfaceSubtle/70 px-6 py-6 text-center ${className}`}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-surfaceRaised/70 text-brand-primary">
          <Shield className="h-5 w-5" />
        </div>
        <p className="mb-4 text-sm text-slate-300">{message}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowIngestionMonitor(true)}>
            Open Ingestion Monitor
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${sentimentClass}`}>
              {sentiment === 'positive' ? <Sparkles className="h-3.5 w-3.5" /> : sentiment === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
              {sentimentLabel}
            </span>
            {generatedAtLabel ? (
              <span className="text-xs text-slate-400">Updated {generatedAtLabel}</span>
            ) : null}
          </div>
          <p className="text-sm text-slate-200">{briefing.summary}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {highlights.length ? (
          highlights.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${priorityAccent[item.priority]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{item.headline}</p>
                  {item.detail ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 whitespace-pre-line">{item.detail}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                  {item.priority}
                </span>
              </div>
              {item.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-black/30 px-2 py-[2px] text-[10px] uppercase tracking-wide text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-slate-500/40 bg-slate-500/10 px-4 py-6 text-center text-sm text-slate-300">
            No automated highlights yet. Refresh insights to generate today&apos;s briefing.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <span className="font-semibold text-slate-100">Leadership Recognition</span>
        </div>
        {playerOfTheDay ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-4 text-sm text-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-emerald-200">
                <Crown className="h-5 w-5" />
                <p className="font-semibold">Player of the day</p>
              </div>
              <span className="rounded-full bg-black/30 px-2 py-[1px] text-[11px] uppercase tracking-wide text-emerald-200">
                Score {playerOfTheDay.score.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 text-base font-semibold text-slate-100">{playerOfTheDay.playerName}</p>
            {playerOfTheDay.highlights?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-emerald-100">
                {playerOfTheDay.highlights.slice(0, 4).map((highlight, idx) => (
                  <li key={`${playerOfTheDay.playerTag}-highlight-${idx}`}>{highlight}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {renderRecognitionColumn('Spotlights', spotlights.slice(0, 3), 'celebrate', Sparkles)}
          {renderRecognitionColumn('Watchlist', watchlist.slice(0, 3), 'watch', AlertTriangle)}
          {renderRecognitionColumn('Callouts', callouts.slice(0, 3), 'warn', Megaphone)}
        </div>
      </div>
    </div>
  );
}

function renderRecognitionColumn(
  title: string,
  items: Array<{ id: string; playerName: string; reason: string; emphasis: 'celebrate' | 'watch' | 'warn'; metricValue?: string | null; tags?: string[]; headline: string; }>,
  defaultEmphasis: 'celebrate' | 'watch' | 'warn',
  IconComponent: typeof Sparkles | typeof AlertTriangle | typeof Megaphone = Sparkles
) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-500/40 bg-slate-500/10 px-4 py-4 text-xs text-slate-300">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <IconComponent className="h-4 w-4" />
          {title}
        </div>
        No entries yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-500/40 bg-slate-500/10 px-4 py-4 text-xs text-slate-200">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <IconComponent className="h-4 w-4" />
        {title}
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const emphasis = emphasisBadge[item.emphasis ?? defaultEmphasis] ?? emphasisBadge[defaultEmphasis];
          return (
            <li key={item.id} className="space-y-1 rounded-xl border border-slate-400/20 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-100">{item.playerName}</p>
                <span className={`rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide ${emphasis}`}>
                  {item.headline}
                </span>
              </div>
              <p className="text-xs text-slate-300">{item.reason}</p>
              {item.metricValue ? (
                <p className="text-[11px] text-slate-400">Metric: {item.metricValue}</p>
              ) : null}
              {item.tags?.length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.tags.map((tag) => (
                    <span key={`${item.id}-${tag}`} className="rounded-full bg-black/30 px-2 py-[1px] text-[10px] uppercase tracking-wide text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
