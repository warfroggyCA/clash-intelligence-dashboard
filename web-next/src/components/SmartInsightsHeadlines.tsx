"use client";

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, RefreshCcw, Shield } from 'lucide-react';
import { Button, GlassCard } from '@/components/ui';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString } from '@/lib/date';

interface SmartInsightsHeadlinesProps {
  className?: string;
  maxItems?: number;
}

const MAX_ITEMS_DEFAULT = Number.POSITIVE_INFINITY;

const CLEANUP_REGEX = /\s+/g;

const NOISE_PATTERNS: RegExp[] = [
  /^greetings\s+/i,
  /^hello\b/i,
  /^hi\b/i,
  /^(here'?s|this is)\s+(a\s+)?(quick\s+)?summary/i,
  /^welcome\b/i,
];

function compactText(value: string): string {
  return value.replace(/\*{2,}/g, '').replace(CLEANUP_REGEX, ' ').trim();
}

function normalizeForComparison(value: string): string {
  return compactText(value)
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(CLEANUP_REGEX, ' ')
    .trim()
    .toLowerCase();
}

function isNoiseLine(value: string): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed || NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export default function SmartInsightsHeadlines({
  className = '',
  maxItems = MAX_ITEMS_DEFAULT,
}: SmartInsightsHeadlinesProps) {
  const headlines = useDashboardStore(selectors.smartInsightsHeadlines);
  const status = useDashboardStore(selectors.smartInsightsStatus);
  const error = useDashboardStore(selectors.smartInsightsError);
  const diagnostics = useDashboardStore((state) => state.smartInsights?.diagnostics);
  const metadata = useDashboardStore((state) => state.smartInsights?.metadata);
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const setShowIngestionMonitor = useDashboardStore((state) => state.setShowIngestionMonitor);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const bulletins = useMemo(() => {
    if (!headlines?.length) {
      return [];
    }

    const priorityOrder: Record<'high' | 'medium' | 'low', number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const seen = new Set<string>();
    let sequence = 0;

    const entries = headlines.flatMap((headline, headlineIndex) => {
      const priority = priorityOrder[headline.priority] !== undefined ? headline.priority : 'medium';

      const normalizedTitle = normalizeForComparison(headline.title);
      const detailLines = headline.detail ? headline.detail.split(/\n+/) : [];

      const cleanedDetails = detailLines
        .map((line) => compactText(line.replace(/^\s*[-•]\s*/, '')))
        .filter((text) => {
          if (isNoiseLine(text)) return false;
          const normalized = normalizeForComparison(text);
          if (!normalized) return false;
          if (normalized === normalizedTitle) return false;
          if (seen.has(normalized)) return false;
          return true;
        });

      let linesToUse = cleanedDetails;

      if (!linesToUse.length) {
        if (!isNoiseLine(headline.title) && normalizedTitle && !seen.has(normalizedTitle)) {
          linesToUse = [compactText(headline.title)];
        } else {
          return [];
        }
      }

      return linesToUse.map((text, lineIndex) => {
        const normalized = normalizeForComparison(text);
        seen.add(normalized);
        sequence += 1;

        return {
          key: `${headline.id || headlineIndex}-${lineIndex}`,
          text,
          priority,
          order: sequence,
        };
      });
    });

    const ranked = entries.sort((a, b) => {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
      return a.order - b.order;
    });

    return ranked.slice(0, maxItems);
  }, [headlines, maxItems]);

  const handleRefresh = async () => {
    if (!clanTag || isRefreshing) return;
    try {
      setIsRefreshing(true);
      await loadSmartInsights(clanTag, { force: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderHeader = () => {
    return null;
  };

  const renderBody = () => {
    if (status === 'loading' && !bulletins.length) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <RefreshCcw className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading fresh highlights…</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Unable to load daily highlights</p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{error}</p>
              <Button
                variant="ghost"
                className="mt-2 px-0 text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                onClick={() => setShowIngestionMonitor(true)}
              >
                Open ingestion monitor
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!bulletins.length) {
      const message = diagnostics?.openAIConfigured === false
        ? 'Smart insights are disabled. Add an OpenAI key to enable automated headlines.'
        : 'No automated highlights yet. Run an ingestion job to generate today\'s summary.';
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Shield className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{message}</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => setShowIngestionMonitor(true)}>
                Open Ingestion Monitor
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Group bulletins by priority
    const groupedBulletins = bulletins.reduce((acc, item) => {
      if (!acc[item.priority]) {
        acc[item.priority] = [];
      }
      acc[item.priority].push(item);
      return acc;
    }, {} as Record<string, typeof bulletins>);

    const priorityOrder = ['high', 'medium', 'low'];
    const priorityLabels = {
      high: 'High Priority',
      medium: 'Medium Priority', 
      low: 'Low Priority'
    };
    const priorityColors = {
      high: 'text-amber-600 dark:text-amber-400',
      medium: 'text-blue-600 dark:text-blue-400',
      low: 'text-slate-500 dark:text-slate-400'
    };

    return (
      <div className="space-y-4 xl:max-h-72 xl:overflow-y-auto xl:pr-2">
        {priorityOrder.map((priority) => {
          const items = groupedBulletins[priority];
          if (!items || items.length === 0) return null;

          return (
            <div key={priority} className="space-y-2">
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${priorityColors[priority as keyof typeof priorityColors]}`}>
                {priorityLabels[priority as keyof typeof priorityLabels]} ({items.length})
              </h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.key} className="group py-1">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 pt-0.5">
                        <Shield className={`h-4 w-4 ${priorityColors[priority as keyof typeof priorityColors]}`} />
                      </div>
                      <div className="flex-1">
                        <p 
                          className="text-sm leading-relaxed text-slate-800 dark:!text-white"
                          style={{
                            color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <GlassCard className={className}>
      <div className="space-y-2">
        {renderHeader()}
        {renderBody()}
      </div>
    </GlassCard>
  );
}
