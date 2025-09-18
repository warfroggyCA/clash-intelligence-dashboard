"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, RefreshCcw } from 'lucide-react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import type { SmartInsightsHeadline } from '@/lib/smart-insights';

interface SmartInsightsHeadlinesProps {
  className?: string;
}

const priorityRank: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type ParsedHeadline = {
  greeting: string | null;
  bullets: string[];
};

const MARKDOWN_DECORATION = /\*\*|__|`|~~/g;
const CLAN_CODE = /#[A-Za-z0-9]+/g;

const stripNoise = (value: string) =>
  value
    .replace(MARKDOWN_DECORATION, '')
    .replace(CLAN_CODE, '')
    .replace(/[\s]+/g, ' ')
    .trim();

const normalizeForComparison = (value: string) =>
  stripNoise(value)
    .replace(/[.!?:;,]+$/g, '')
    .toLowerCase();

function normalizeGreeting(content: string): [string | null, string] {
  const trimmed = stripNoise(content);
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('hello clan') || lower.startsWith('hi clan') || lower.startsWith('greetings clan')) {
    const afterGreeting = trimmed.replace(/^[^.!?]*[.!?]?\s*/, '');
    return ['Hello clan', afterGreeting.trim()];
  }
  return [null, trimmed];
}

function parseHeadlineContent(content?: string | null): ParsedHeadline {
  if (!content) {
    return { greeting: null, bullets: [] };
  }
  const [greeting, withoutGreeting] = normalizeGreeting(content);
  const homogenized = withoutGreeting
    .replace(/\s+/g, ' ')
    .replace(/ - /g, '\n- ')
    .replace(/•/g, '\n- ');
  const rawLines = homogenized
    .split(/\n-\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (rawLines.length > 1) {
    return { greeting, bullets: rawLines };
  }
  const sentences = withoutGreeting
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return {
    greeting,
    bullets: sentences,
  };
}

function formatCategoryLabel(category: SmartInsightsHeadline['category']) {
  switch (category) {
    case 'performance':
      return 'Performance Pulse';
    case 'war':
      return 'War Front';
    case 'donation':
      return 'Donation Watch';
    case 'spotlight':
      return 'Player Spotlight';
    default:
      return 'Roster Shift';
  }
}

function priorityLabel(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    default:
      return 'Low';
  }
}

export default function SmartInsightsHeadlines({ className = '' }: SmartInsightsHeadlinesProps) {
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);
  const smartInsights = useDashboardStore((state) => state.smartInsights);
  const smartInsightsStatus = useDashboardStore((state) => state.smartInsightsStatus);
  const smartInsightsError = useDashboardStore((state) => state.smartInsightsError);
  const headlines = useDashboardStore(selectors.smartInsightsHeadlines);
  const isStale = useDashboardStore(selectors.smartInsightsIsStale);

  const displayedHeadlines = useMemo(() => {
    return headlines
      .slice()
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
      .slice(0, 3);
  }, [headlines]);
  const [isCollapsed] = useState(false);

  const metadata = smartInsights?.metadata;
  const diagnostics = smartInsights?.diagnostics;

  const handleRefresh = async () => {
    if (!clanTag) return;
    try {
      await loadSmartInsights(clanTag, { force: true });
    } catch (error) {
      console.error('[SmartInsightsHeadlines] Failed to refresh insights:', error);
    }
  };

  const renderStatusBadge = () => {
    if (!metadata) return null;
    const badges: JSX.Element[] = [];

    if (isStale) {
      badges.push(
        <span key="stale" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          Stale
        </span>
      );
    }

    if (diagnostics?.hasError) {
      badges.push(
        <span key="error" className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3 w-3" />
          Warning
        </span>
      );
    }

    if (!badges.length) {
      badges.push(
        <span key="fresh" className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Fresh
        </span>
      );
    }

    return badges;
  };

  const renderContent = () => {
    if (smartInsightsStatus === 'loading' && !smartInsights) {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-indigo-100 bg-white/80 p-4 shadow-sm">
              <div className="mb-2 h-3 w-16 animate-pulse rounded-full bg-indigo-200" />
              <div className="mb-1 h-4 w-3/4 animate-pulse rounded bg-indigo-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-indigo-50" />
            </div>
          ))}
        </div>
      );
    }

    if ((smartInsightsStatus === 'error' && !smartInsights) || smartInsightsError) {
      return (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {smartInsightsError || 'Unable to load insights right now.'}
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <RefreshCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      );
    }

    if (!displayedHeadlines.length) {
      return (
        <div className="rounded-xl border border-indigo-100 bg-white/80 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-6 w-6 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-indigo-900">Insights are getting ready</p>
              <p className="text-sm text-indigo-600">
                Refresh the data or run a manual coaching request to see the freshest highlights.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const sections = displayedHeadlines
      .map((headline) => {
        const parsed = parseHeadlineContent(headline.detail || headline.title);
        const normalizedTitle = normalizeForComparison(headline.title || '');
        const greetingText = parsed.greeting ? stripNoise(parsed.greeting) : null;
        const normalizedGreeting = greetingText ? normalizeForComparison(greetingText) : '';
        const dedupedBullets: string[] = [];
        const seen = new Set<string>();

        parsed.bullets.forEach((item) => {
          const cleanedBullet = stripNoise(item.replace(/^[-•]+\s*/, ''));
          if (!cleanedBullet) return;
          const normalized = normalizeForComparison(cleanedBullet);
          if (normalizedTitle && normalized) {
            if (
              normalized === normalizedTitle ||
              normalized.startsWith(normalizedTitle) ||
              normalizedTitle.startsWith(normalized)
            ) {
              return;
            }
          }
          if (normalizedGreeting && normalized) {
            if (
              normalized === normalizedGreeting ||
              normalized.startsWith(normalizedGreeting) ||
              normalizedGreeting.startsWith(normalized)
            ) {
              return;
            }
          }
          if (seen.has(normalized)) return;
          seen.add(normalized);
          dedupedBullets.push(cleanedBullet);
        });

        const detailText = stripNoise(headline.detail || '');
        const normalizedDetail = normalizeForComparison(detailText);
        const showDetailFallback = !dedupedBullets.length
          && detailText
          && normalizedDetail !== normalizedTitle
          && (!normalizedGreeting || normalizedDetail !== normalizedGreeting);
        const displayTitle = normalizedTitle.startsWith('hello clan') || normalizedTitle.startsWith('greetings clan')
          ? 'Hello clan'
          : stripNoise(headline.title || '');
        const showGreeting = greetingText
          && normalizedGreeting
          && normalizedGreeting !== normalizedTitle;

        const hasContent = dedupedBullets.length > 0 || showGreeting || showDetailFallback;
        if (!hasContent) {
          return null;
        }

        return {
          id: headline.id,
          category: formatCategoryLabel(headline.category),
          priority: priorityLabel(headline.priority),
          priorityColor:
            headline.priority === 'high'
              ? 'text-rose-500'
              : headline.priority === 'medium'
                ? 'text-amber-500'
                : 'text-emerald-500',
          title: displayTitle,
          greeting: showGreeting ? greetingText : null,
          bullets: dedupedBullets,
          detail: showDetailFallback ? detailText : null,
        };
      })
      .filter((section): section is NonNullable<typeof section> => Boolean(section));

    if (!sections.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No headlines available yet. Refresh data to pull the latest highlights.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="max-h-64 overflow-y-auto pr-2 space-y-4">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className={index > 0 ? 'border-t border-slate-200 pt-4' : ''}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase text-indigo-500">
                <span>{section.category}</span>
                <span className={section.priorityColor}>{section.priority}</span>
              </div>
              <h3 className="mb-1 text-base font-semibold text-indigo-900">{section.title}</h3>
              {section.greeting && (
                <p className="text-sm font-medium text-indigo-700">{section.greeting}</p>
              )}
              {section.bullets.length > 0 && (
                <ul className="space-y-1 text-sm text-indigo-700">
                  {section.bullets.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!section.bullets.length && section.detail && (
                <p className="text-sm text-indigo-700">{section.detail}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className={`rounded-xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Lightbulb className="h-5 w-5 text-indigo-500" />
            Today’s Headlines
            {renderStatusBadge()}
          </div>
          {metadata && (
            <p className="text-xs text-slate-500">
              Snapshot {safeLocaleDateString(metadata.snapshotDate, { fallback: metadata.snapshotDate, context: 'SmartInsightsHeadlines snapshotDate' })}
              {metadata.generatedAt && (
                <> • Generated {safeLocaleString(metadata.generatedAt, { fallback: metadata.generatedAt, context: 'SmartInsightsHeadlines generatedAt' })}</>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${smartInsightsStatus === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      {renderContent()}
      {metadata && diagnostics && (
        <div className="mt-3 text-xs text-indigo-500">
          <span className="font-medium">Source:</span> {metadata.source.replace('_', ' ')}
        </div>
      )}
    </section>
  );
}
