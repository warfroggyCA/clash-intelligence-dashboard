"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, RefreshCcw } from 'lucide-react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import type { SmartInsightsHeadline } from '@/lib/smart-insights';
import { Button, GlassCard } from '@/components/ui';

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

const HEX_CLIP_PATH = 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)';

type AccentStyle = {
  background: string;
  border: string;
  glow: string;
  title: string;
  badgeGradient: string;
  badgeBorder: string;
  badgeShadow: string;
  badgeText: string;
  bullet: string;
  divider: string;
  accentText: string;
  greeting: string;
};

const ACCENT_STYLES: Record<string, AccentStyle> = {
  default: {
    background: 'linear-gradient(135deg, rgba(112, 84, 170, 0.62), rgba(70, 82, 160, 0.58), rgba(46, 60, 120, 0.56))',
    border: 'rgba(223, 208, 255, 0.45)',
    glow: '0 30px 68px -30px rgba(148, 125, 224, 0.5)',
    title: 'rgba(255, 250, 255, 0.98)',
    badgeGradient: 'linear-gradient(135deg, rgba(210, 185, 255, 0.95), rgba(168, 136, 255, 0.92))',
    badgeBorder: 'rgba(238, 222, 255, 0.58)',
    badgeShadow: '0 18px 36px -18px rgba(184, 152, 255, 0.58)',
    badgeText: 'rgba(253, 246, 255, 0.98)',
    bullet: 'rgba(216, 199, 255, 0.9)',
    divider: 'rgba(224, 210, 255, 0.35)',
    accentText: 'rgba(244, 238, 255, 0.9)',
    greeting: 'rgba(240, 230, 255, 0.94)',
  },
  'Performance Pulse': {
    background: 'linear-gradient(145deg, rgba(28, 42, 92, 0.95), rgba(18, 30, 70, 0.92), rgba(10, 18, 44, 0.9))',
    border: 'rgba(142, 178, 255, 0.38)',
    glow: '0 32px 78px -32px rgba(72, 112, 255, 0.5)',
    title: 'rgba(234, 242, 255, 0.99)',
    badgeGradient: 'linear-gradient(135deg, rgba(170, 198, 255, 0.96), rgba(122, 156, 255, 0.9))',
    badgeBorder: 'rgba(196, 218, 255, 0.52)',
    badgeShadow: '0 18px 36px -18px rgba(112, 150, 255, 0.52)',
    badgeText: 'rgba(246, 249, 255, 0.98)',
    bullet: 'rgba(160, 194, 255, 0.9)',
    divider: 'rgba(164, 194, 255, 0.32)',
    accentText: 'rgba(220, 232, 255, 0.9)',
    greeting: 'rgba(204, 220, 255, 0.94)',
  },
  'War Front': {
    background: 'linear-gradient(135deg, rgba(255, 150, 170, 0.74), rgba(226, 98, 120, 0.74), rgba(177, 58, 80, 0.72))',
    border: 'rgba(255, 196, 196, 0.5)',
    glow: '0 32px 70px -28px rgba(255, 120, 120, 0.55)',
    title: 'rgba(255, 243, 243, 0.98)',
    badgeGradient: 'linear-gradient(135deg, rgba(255, 194, 194, 0.95), rgba(255, 142, 142, 0.92))',
    badgeBorder: 'rgba(255, 210, 210, 0.58)',
    badgeShadow: '0 18px 36px -18px rgba(255, 144, 144, 0.58)',
    badgeText: 'rgba(255, 249, 249, 0.98)',
    bullet: 'rgba(255, 210, 210, 0.92)',
    divider: 'rgba(255, 201, 201, 0.35)',
    accentText: 'rgba(255, 236, 236, 0.94)',
    greeting: 'rgba(255, 224, 224, 0.96)',
  },
  'Donation Watch': {
    background: 'linear-gradient(135deg, rgba(255, 202, 150, 0.78), rgba(229, 150, 84, 0.76), rgba(182, 102, 42, 0.74))',
    border: 'rgba(255, 220, 180, 0.5)',
    glow: '0 32px 70px -28px rgba(255, 188, 110, 0.55)',
    title: 'rgba(255, 248, 236, 0.98)',
    badgeGradient: 'linear-gradient(135deg, rgba(255, 220, 174, 0.96), rgba(255, 180, 102, 0.93))',
    badgeBorder: 'rgba(255, 228, 190, 0.6)',
    badgeShadow: '0 18px 36px -18px rgba(255, 188, 112, 0.6)',
    badgeText: 'rgba(255, 250, 240, 0.98)',
    bullet: 'rgba(255, 220, 180, 0.92)',
    divider: 'rgba(255, 214, 176, 0.35)',
    accentText: 'rgba(255, 236, 214, 0.94)',
    greeting: 'rgba(255, 230, 204, 0.96)',
  },
  'Player Spotlight': {
    background: 'linear-gradient(135deg, rgba(166, 238, 214, 0.78), rgba(116, 210, 183, 0.76), rgba(70, 158, 140, 0.74))',
    border: 'rgba(194, 246, 226, 0.48)',
    glow: '0 32px 70px -28px rgba(112, 224, 190, 0.55)',
    title: 'rgba(236, 255, 248, 0.98)',
    badgeGradient: 'linear-gradient(135deg, rgba(186, 244, 214, 0.95), rgba(126, 226, 184, 0.92))',
    badgeBorder: 'rgba(206, 248, 228, 0.55)',
    badgeShadow: '0 18px 36px -18px rgba(118, 228, 190, 0.58)',
    badgeText: 'rgba(240, 255, 250, 0.98)',
    bullet: 'rgba(182, 240, 214, 0.92)',
    divider: 'rgba(190, 242, 220, 0.35)',
    accentText: 'rgba(214, 246, 232, 0.94)',
    greeting: 'rgba(198, 240, 220, 0.96)',
  },
  'Roster Shift': {
    background: 'linear-gradient(135deg, rgba(176, 140, 230, 0.72), rgba(132, 106, 210, 0.7), rgba(94, 74, 168, 0.68))',
    border: 'rgba(226, 198, 255, 0.5)',
    glow: '0 32px 70px -28px rgba(186, 152, 255, 0.55)',
    title: 'rgba(245, 235, 255, 0.99)',
    badgeGradient: 'linear-gradient(135deg, rgba(216, 176, 255, 0.95), rgba(172, 122, 255, 0.92))',
    badgeBorder: 'rgba(234, 204, 255, 0.58)',
    badgeShadow: '0 18px 36px -18px rgba(194, 148, 255, 0.58)',
    badgeText: 'rgba(252, 242, 255, 0.98)',
    bullet: 'rgba(226, 198, 255, 0.92)',
    divider: 'rgba(224, 206, 255, 0.35)',
    accentText: 'rgba(236, 222, 255, 0.94)',
    greeting: 'rgba(228, 210, 255, 0.96)',
  },
};

const PRIMARY_CARD_OVERLAY =
  'radial-gradient(120% 95% at 100% 0%, rgba(155, 188, 255, 0.35), transparent 68%), radial-gradient(120% 95% at 0% 10%, rgba(96, 128, 210, 0.26), transparent 64%)';

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
        <span key="stale" className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          <AlertTriangle className="h-3 w-3" />
          Stale
        </span>
      );
    }

    if (diagnostics?.hasError) {
      badges.push(
        <span key="error" className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 px-2 py-0.5 text-[11px] font-medium text-rose-200">
          <AlertTriangle className="h-3 w-3" />
          Warning
        </span>
      );
    }

    if (!badges.length) {
      badges.push(
        <span key="fresh" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
          Fresh
        </span>
      );
    }

    if (!badges.length) return null;
    return (
      <div className="flex items-center gap-1">
        {badges}
      </div>
    );
  };

  const renderContent = () => {
    if (smartInsightsStatus === 'loading' && !smartInsights) {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-indigo-100/70 bg-indigo-50/60 p-4">
              <div className="mb-2 h-3 w-16 animate-pulse rounded-full bg-indigo-200/70" />
              <div className="mb-1 h-4 w-3/4 animate-pulse rounded bg-indigo-200/50" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-indigo-200/50" />
            </div>
          ))}
        </div>
      );
    }

    if ((smartInsightsStatus === 'error' && !smartInsights) || smartInsightsError) {
      return (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {smartInsightsError || 'Unable to load insights right now.'}
          </div>
          <Button
            onClick={handleRefresh}
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${smartInsightsStatus === 'loading' ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      );
    }

    if (!displayedHeadlines.length) {
      return (
        <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
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

        const priorityTone =
          headline.priority === 'high'
            ? {
                text: 'rgba(255, 201, 207, 0.96)',
                border: 'rgba(255, 122, 140, 0.45)',
                background: 'rgba(255, 82, 110, 0.16)',
              }
            : headline.priority === 'medium'
              ? {
                  text: 'rgba(255, 233, 199, 0.95)',
                  border: 'rgba(255, 173, 68, 0.45)',
                  background: 'rgba(255, 173, 68, 0.16)',
                }
              : {
                  text: 'rgba(198, 246, 219, 0.95)',
                  border: 'rgba(95, 211, 158, 0.42)',
                  background: 'rgba(77, 190, 135, 0.16)',
                };

        return {
          id: headline.id,
          category: formatCategoryLabel(headline.category),
          priority: priorityLabel(headline.priority),
          priorityTone,
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

    const primaryAccent = ACCENT_STYLES['Performance Pulse'];
    const storyCountLabel = sections.length === 1 ? '1 active story' : `${sections.length} active stories`;

    return (
      <div
        className="relative flex min-h-[18rem] flex-col overflow-hidden rounded-[32px] border px-7 py-6 shadow-2xl"
        style={{
          background: primaryAccent.background,
          borderColor: primaryAccent.border,
          boxShadow: primaryAccent.glow,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-75"
          style={{ background: PRIMARY_CARD_OVERLAY }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-28 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgba(147, 176, 255, 0.32)' }}
        />
        <div className="relative flex flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
              style={{
                color: primaryAccent.accentText,
                borderColor: primaryAccent.divider,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            >
              Live Highlights Feed
            </span>
            <span
              className="text-[11px] font-medium uppercase tracking-[0.24em]"
              style={{ color: 'rgba(240, 245, 255, 0.72)' }}
            >
              {storyCountLabel}
            </span>
          </div>

          <div className="relative flex-1 min-h-0 overflow-hidden">
            <ul className="flex max-h-[20rem] flex-col overflow-y-auto pr-2 [scrollbar-color:rgba(255,255,255,0.45)_transparent]">
              {sections.map((section) => {
                const accent = ACCENT_STYLES[section.category] ?? ACCENT_STYLES.default;

                return (
                  <li
                    key={section.id}
                    className="flex flex-col gap-4 border-t border-white/20 py-6 first:border-t-0 first:pt-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span
                        className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                        style={{ color: accent.accentText }}
                      >
                        <span
                          className="flex h-9 w-9 items-center justify-center text-[10px]"
                          style={{
                            clipPath: HEX_CLIP_PATH,
                            background: accent.badgeGradient,
                            boxShadow: accent.badgeShadow,
                            border: `1px solid ${accent.badgeBorder}`,
                            color: accent.badgeText,
                            letterSpacing: '0.18em',
                          }}
                        >
                          {section.category.split(' ')[0].charAt(0)}
                        </span>
                        <span className="tracking-[0.18em]">{section.category}</span>
                      </span>
                      <span
                        className="relative flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                        style={{
                          color: section.priorityTone.text,
                          border: `1px solid ${section.priorityTone.border}`,
                          backgroundColor: section.priorityTone.background,
                        }}
                      >
                        {section.priority}
                      </span>
                    </div>

                    <h3
                      className="text-lg font-semibold leading-snug"
                      style={{ color: accent.title }}
                    >
                      {section.title}
                    </h3>

                    {section.greeting && (
                      <p
                        className="text-sm font-semibold"
                        style={{ color: accent.greeting }}
                      >
                        {section.greeting}
                      </p>
                    )}

                    <div className="flex flex-col gap-3">
                      {section.bullets.length > 0 ? (
                        <ul
                          className="flex flex-col gap-3 text-base leading-relaxed"
                          style={{ color: accent.accentText }}
                        >
                          {section.bullets.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3"
                            >
                              <span
                                className="mt-2 h-2 w-2 flex-shrink-0 rounded-sm"
                                style={{
                                  backgroundColor: accent.bullet,
                                  boxShadow: `0 0 12px -2px ${accent.bullet}`,
                                }}
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        section.detail && (
                          <p className="text-base leading-relaxed" style={{ color: accent.accentText }}>
                            {section.detail}
                          </p>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const statusBadge = renderStatusBadge();

  const subtitle = metadata
    ? `Snapshot ${safeLocaleDateString(metadata.snapshotDate, {
        fallback: metadata.snapshotDate,
        context: 'SmartInsightsHeadlines snapshotDate',
      })}${
        metadata.generatedAt
          ? ` • Generated ${safeLocaleString(metadata.generatedAt, {
              fallback: metadata.generatedAt,
              context: 'SmartInsightsHeadlines generatedAt',
            })}`
          : ''
      }`
    : 'AI-powered daily highlights';

  return (
    <GlassCard
      className={className}
      icon={<Lightbulb className="h-5 w-5" />}
      title="Today’s Headlines"
      subtitle={subtitle}
      actions={
        <div className="flex items-center gap-2">
          {statusBadge}
          <Button
            onClick={handleRefresh}
            size="sm"
            variant="outline"
            className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${smartInsightsStatus === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      {renderContent()}
      {metadata && diagnostics && (
        <div className="mt-4 border-t border-slate-200/70 pt-3 text-xs text-indigo-500">
          <span className="font-medium">Source:</span> {metadata.source.replace('_', ' ')}
        </div>
      )}
    </GlassCard>
  );
}
