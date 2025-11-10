"use client";

import { useMemo, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import useSWR from 'swr';
import { insightsFetcher } from '@/lib/api/swr-fetcher';
import { cfg } from '@/lib/config';
import type { SmartInsightsPayload } from '@/lib/smart-insights';

interface NewsFeedProps {
  clanTag?: string | null;
}

export interface NewsFeedRef {
  refresh: () => Promise<void>;
}

const NewsFeed = forwardRef<NewsFeedRef, NewsFeedProps>(({ clanTag: propClanTag }, ref) => {
  // Simple Architecture: Fetch insights directly from API using SWR
  const clanTag = propClanTag || cfg.homeClanTag || '#2PR8R8V8P'; // Fallback to default
  const swrKey = clanTag ? `/api/insights?clanTag=${encodeURIComponent(clanTag)}` : null;
  const { data: smartInsights, error: insightsError, isLoading: isLoadingInsights, mutate } = useSWR<SmartInsightsPayload | null>(
    swrKey,
    insightsFetcher,
    {
      revalidateOnFocus: true, // Check for new data when user returns to the page
      revalidateOnReconnect: true, // Check for new data when network reconnects
      refreshInterval: 5 * 60 * 1000, // Check every 5 minutes for new insights
      dedupingInterval: 60 * 1000, // Dedupe requests within 1 minute
    }
  );

  // Track if we're manually refreshing
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      if (!clanTag) return;
      setIsRefreshing(true);
      try {
        // Force a fresh fetch by calling mutate with revalidate: true
        // This will re-fetch using the same SWR key, bypassing cache
        console.log('[NewsFeed] Refreshing insights for clanTag:', clanTag);
        
        // Use mutate with revalidate to force a fresh fetch
        // SWR will use the same key but bypass cache and fetch fresh data
        await mutate(undefined, { revalidate: true });
        
        setLastRefreshedAt(Date.now());
        console.log('[NewsFeed] Refresh completed');
      } catch (error) {
        console.error('[NewsFeed] Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    },
  }), [mutate, clanTag]);

  const [latestAISummary, setLatestAISummary] = useState<string | null>(null);

  // Fetch latest AI summary from database as fallback
  useEffect(() => {
    if (!clanTag) return;

    const fetchLatestSummary = async () => {
      try {
        const response = await fetch(`/api/ai-summaries?clanTag=${encodeURIComponent(clanTag)}&limit=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            const summary = data.data[0].summary;
            if (summary && typeof summary === 'string' && summary.trim().length > 30) {
              setLatestAISummary(summary.trim());
            }
          }
        }
      } catch (error) {
        console.error('[NewsFeed] Failed to fetch latest AI summary:', error);
      }
    };

    void fetchLatestSummary();
  }, [clanTag]);

  const headlineParagraph = useMemo(() => {
    if (!smartInsights) {
      // If no smart insights, use latest AI summary from database
      return latestAISummary;
    }

    // Prioritize AI-generated content (these are full narratives from OpenAI)
    // Change Summary content is AI-generated based on all recent changes
    const changeContent = smartInsights.context?.changeSummary?.content;
    if (changeContent && typeof changeContent === 'string' && changeContent.trim().length > 30) {
      console.log('[NewsFeed] Using changeSummary.content for headline paragraph', changeContent.substring(0, 100));
      return changeContent.trim();
    }

    // Performance Analysis content is AI-generated based on clan performance data
    const perfContent = smartInsights.context?.performanceAnalysis?.content;
    if (perfContent && typeof perfContent === 'string' && perfContent.trim().length > 30) {
      console.log('[NewsFeed] Using performanceAnalysis.content for headline paragraph', perfContent.substring(0, 100));
      return perfContent.trim();
    }

    // Fallback to briefing summary (this is just concatenated headlines, not AI-generated)
    // Also check briefing highlights for content
    const briefingSummary = smartInsights.briefing?.summary;
    if (briefingSummary && typeof briefingSummary === 'string' && briefingSummary.trim().length > 30) {
      console.log('[NewsFeed] Using briefing.summary for headline paragraph (fallback)', briefingSummary.substring(0, 100));
      return briefingSummary.trim();
    }
    
    // If briefing summary is too short, try to build one from highlights
    const briefingHighlights = smartInsights.briefing?.highlights;
    if (briefingHighlights && briefingHighlights.length > 0) {
      const highlightTexts = briefingHighlights
        .map(h => h.detail ? `${h.headline}: ${h.detail}` : h.headline)
        .filter(Boolean);
      if (highlightTexts.length > 0) {
        const combinedText = highlightTexts.join('. ') + '.';
        if (combinedText.trim().length > 30) {
          console.log('[NewsFeed] Using briefing highlights for headline paragraph', combinedText.substring(0, 100));
          return combinedText.trim();
        }
      }
    }

    // Final fallback: use latest AI summary from database
    if (latestAISummary) {
      console.log('[NewsFeed] Using latest AI summary from database');
      return latestAISummary;
    }

    console.log('[NewsFeed] No suitable headline paragraph found');
    return null;
  }, [smartInsights, latestAISummary]);

  const newsItems = useMemo(() => {
    const items: Array<{ id: string; text: string; priority: 'high' | 'medium' | 'low'; category: string }> = [];

    if (!smartInsights) return items;

    // AI-generated Briefing Highlights
    if (smartInsights.briefing?.highlights?.length) {
      smartInsights.briefing.highlights.forEach((highlight) => {
        const text = highlight.detail 
          ? `${highlight.headline}: ${highlight.detail}` 
          : highlight.headline;
        items.push({
          id: `highlight-${highlight.id}`,
          text,
          priority: highlight.priority,
          category: highlight.category,
        });
      });
    }

    // AI-generated Change Summary - parse insights and recommendations (skip main content since it's in headline)
    if (smartInsights.context?.changeSummary) {
      const changeSummary = smartInsights.context.changeSummary;
      
      // Add insights as bullet points
      if (changeSummary.insights?.length) {
        changeSummary.insights.forEach((insight, index) => {
          items.push({
            id: `changeinsight-${index}`,
            text: insight,
            priority: changeSummary.priority,
            category: 'changes',
          });
        });
      }

      // Add recommendations
      if (changeSummary.recommendations?.length) {
        changeSummary.recommendations.forEach((rec, index) => {
          items.push({
            id: `changerec-${index}`,
            text: rec,
            priority: changeSummary.priority === 'high' ? 'medium' : changeSummary.priority,
            category: 'coaching',
          });
        });
      }
    }

    // AI-generated Performance Analysis - parse insights and recommendations (skip main content since it's in headline)
    if (smartInsights.context?.performanceAnalysis) {
      const perfAnalysis = smartInsights.context.performanceAnalysis;

      // Add insights
      if (perfAnalysis.insights?.length) {
        perfAnalysis.insights.forEach((insight, index) => {
          items.push({
            id: `perfinsight-${index}`,
            text: insight,
            priority: perfAnalysis.priority,
            category: 'performance',
          });
        });
      }

      // Add recommendations
      if (perfAnalysis.recommendations?.length) {
        perfAnalysis.recommendations.forEach((rec, index) => {
          items.push({
            id: `perfrec-${index}`,
            text: rec,
            priority: perfAnalysis.priority === 'high' ? 'medium' : perfAnalysis.priority,
            category: 'coaching',
          });
        });
      }
    }

    // AI-generated Headlines
    if (smartInsights.headlines?.length) {
      smartInsights.headlines.forEach((headline) => {
        const text = headline.detail 
          ? `${headline.title}: ${headline.detail}` 
          : headline.title;
        items.push({
          id: headline.id,
          text,
          priority: headline.priority,
          category: headline.category,
        });
      });
    }

    // AI-generated Coaching Recommendations
    if (smartInsights.coaching?.length) {
      smartInsights.coaching.forEach((tip) => {
        // Use description or title as the bullet point
        const text = tip.description || tip.title;
        items.push({
          id: `coaching-${tip.id}`,
          text,
          priority: tip.priority,
          category: 'coaching',
        });
      });
    }

    // Sort by priority (high first), then by category
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.category.localeCompare(b.category);
    });
  }, [smartInsights]);

  // Calculate data freshness - MUST be before any conditional returns (Rules of Hooks)
  const dataDate = smartInsights?.metadata?.snapshotDate;
  const generatedAt = smartInsights?.metadata?.generatedAt;
  const isStale = useMemo(() => {
    if (!dataDate) return false;
    const dataDateObj = new Date(dataDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - dataDateObj.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > 1; // Stale if more than 1 day old
  }, [dataDate]);

  if (isLoadingInsights || isRefreshing) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">
          {isRefreshing ? 'Refreshing insights...' : 'Loading AI-generated insights...'}
        </p>
      </div>
    );
  }

  if (insightsError) {
    return (
      <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-6 text-center">
        <p className="text-sm text-amber-400">
          {insightsError.status === 404 
            ? 'No insights available yet. Run an ingestion to generate them.'
            : 'Unable to load AI-generated insights. Run an ingestion to generate them.'}
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!headlineParagraph && newsItems.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">No AI-generated insights available yet. Run an ingestion to generate a news feed.</p>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'changes':
        return 'text-blue-400';
      case 'recognition':
      case 'spotlight':
        return 'text-emerald-400';
      case 'coaching':
        return 'text-amber-400';
      case 'performance':
        return 'text-purple-400';
      case 'briefing':
        return 'text-cyan-400';
      case 'war':
        return 'text-red-400';
      case 'donation':
        return 'text-green-400';
      default:
        return 'text-slate-300';
    }
  };

  const getPriorityIndicator = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return '●';
      case 'medium':
        return '○';
      case 'low':
        return '▪';
      default:
        return '•';
    }
  };

  return (
    <div className="space-y-4">
      {/* Data freshness indicator */}
      {(dataDate || generatedAt || lastRefreshedAt) && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${
          isStale 
            ? 'border-amber-700/50 bg-amber-900/20 text-amber-300' 
            : 'border-slate-700/50 bg-slate-800/30 text-slate-400'
        }`}>
          <div className="flex items-center justify-between">
            <span>
              {dataDate && `Data from ${formatDate(dataDate)}`}
              {generatedAt && dataDate && ' • '}
              {generatedAt && `Generated ${formatDate(generatedAt)}`}
              {lastRefreshedAt && (
                <span className="ml-2 text-emerald-400">
                  • Refreshed {new Date(lastRefreshedAt).toLocaleTimeString()}
                </span>
              )}
            </span>
            {isStale && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                Stale
              </span>
            )}
          </div>
        </div>
      )}

      {/* Headline Paragraph - State of the Union */}
      {headlineParagraph && (
        <div className="rounded-lg border border-cyan-700/50 bg-cyan-900/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Today's Overview</span>
          </div>
          <p className="text-sm leading-relaxed text-cyan-100 whitespace-pre-wrap">{headlineParagraph}</p>
        </div>
      )}

      {/* Bullet Points */}
      {newsItems.length > 0 && (
        <div className="space-y-2">
          {newsItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm transition-colors hover:bg-slate-800/50`}
            >
              <span className={`text-lg leading-none ${getCategoryColor(item.category)}`}>
                {getPriorityIndicator(item.priority)}
              </span>
              <p className={`flex-1 ${getCategoryColor(item.category)}`}>{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

NewsFeed.displayName = 'NewsFeed';

export default NewsFeed;

