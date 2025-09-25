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
        <div className="flex h-full items-center justify-center py-10">
          <div className="flex items-center gap-3 text-slate-400">
            <RefreshCcw className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium tracking-wide">Loading fresh highlights…</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-amber-200/25 bg-amber-200/10 p-4">
          <div className="flex items-start gap-3 text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div className="flex-1 space-y-2">
              <div>
                <p className="font-semibold">Unable to load daily highlights</p>
                <p className="text-sm text-amber-100/80">{error}</p>
              </div>
              <Button
                variant="ghost"
                className="px-0 text-amber-100/90 hover:text-amber-50"
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
        <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-brand-surfaceSubtle/70 px-6 py-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-surfaceRaised/70 text-brand-primary">
            <Shield className="h-5 w-5" />
          </div>
          <p className="mb-4 text-sm text-slate-300">{message}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" className="bg-brand-primary text-white hover:bg-brand-secondary" onClick={() => setShowIngestionMonitor(true)}>
              Open Ingestion Monitor
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-border text-slate-200 hover:bg-brand-surfaceSubtle/70"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Refresh
            </Button>
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
    const priorityColors: Record<'high' | 'medium' | 'low', string> = {
      high: 'text-amber-200',
      medium: 'text-brand-primary',
      low: 'text-slate-400'
    };

    return (
      <div className="flex h-full flex-col">
        <div className="space-y-4 overflow-y-auto pr-1">
          {priorityOrder.map((priority) => {
            const items = groupedBulletins[priority];
            if (!items || items.length === 0) return null;

            return (
              <div key={priority} className="space-y-3">
                <h4 className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${priorityColors[priority as keyof typeof priorityColors]}`}>
                  {priorityLabels[priority as keyof typeof priorityLabels]} ({items.length})
                </h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.key} className="group rounded-2xl bg-brand-surfaceSubtle/60 px-3 py-2">
                      <div className="flex items-start gap-3">
                        <Shield className={`mt-0.5 h-4 w-4 ${priorityColors[priority as keyof typeof priorityColors]}`} />
                        <p className="flex-1 text-sm font-medium leading-snug text-slate-100">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <GlassCard className={`flex h-full flex-col ${className}`}>
      <div className="flex h-full min-h-0 flex-col space-y-2">
        {renderHeader()}
        <div className="flex-1 min-h-0">
          {renderBody()}
        </div>
      </div>
    </GlassCard>
  );
}
