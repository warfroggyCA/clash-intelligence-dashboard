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
    const generatedAt = metadata?.generatedAt ? new Date(metadata.generatedAt) : null;
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-white">
        <div className="flex items-center gap-2 text-xs text-white/70">
          {metadata?.snapshotDate && (
            <span>
              Snapshot {safeLocaleDateString(metadata.snapshotDate, {
                fallback: metadata.snapshotDate,
                context: 'SmartInsightsHeadlines snapshotDate',
              })}
            </span>
          )}
          {generatedAt && (
            <span>
              Generated {formatDistanceToNow(generatedAt, { addSuffix: true })}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white/70 hover:text-white"
            onClick={handleRefresh}
            disabled={isRefreshing || status === 'loading'}
            title="Refresh insights"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing || status === 'loading' ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (status === 'loading' && !bulletins.length) {
      return <p className="text-sm text-white/70">Loading fresh highlights…</p>;
    }

    if (error) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Unable to load daily highlights.</p>
            <p className="text-xs text-amber-200/90">{error}</p>
            <Button
              variant="ghost"
              className="px-0 text-amber-200 hover:text-amber-100"
              onClick={() => setShowIngestionMonitor(true)}
            >
              Open ingestion monitor
            </Button>
          </div>
        </div>
      );
    }

    if (!bulletins.length) {
      const message = diagnostics?.openAIConfigured === false
        ? 'Smart insights are disabled. Add an OpenAI key to enable automated headlines.'
        : 'No automated highlights yet. Run an ingestion job to generate today’s summary.';
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-white/80">
          <span>{message}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowIngestionMonitor(true)}>
              Open Ingestion Monitor
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Refresh
            </Button>
          </div>
        </div>
      );
    }

    return (
      <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {bulletins.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/30 p-3 text-sm text-white/90 shadow-sm"
          >
            <Shield
              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                item.priority === 'high'
                  ? 'text-amber-300'
                  : item.priority === 'medium'
                  ? 'text-sky-300'
                  : 'text-slate-400'
              }`}
            />
            <span className="leading-relaxed">{item.text}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <GlassCard className={className}>
      <div className="space-y-4">
        {renderHeader()}
        {renderBody()}
      </div>
    </GlassCard>
  );
}
