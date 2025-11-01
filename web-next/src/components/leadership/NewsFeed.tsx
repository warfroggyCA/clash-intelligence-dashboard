"use client";

import { useMemo, useEffect, useState } from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';

export default function NewsFeed() {
  const smartInsights = useDashboardStore(selectors.smartInsights);
  const smartInsightsStatus = useDashboardStore(selectors.smartInsightsStatus);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan);
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
    const briefingSummary = smartInsights.briefing?.summary;
    if (briefingSummary && typeof briefingSummary === 'string' && briefingSummary.trim().length > 30) {
      console.log('[NewsFeed] Using briefing.summary for headline paragraph (fallback)', briefingSummary.substring(0, 100));
      return briefingSummary.trim();
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

  if (smartInsightsStatus === 'loading') {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">Loading AI-generated insights...</p>
      </div>
    );
  }

  if (smartInsightsStatus === 'error') {
    return (
      <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-6 text-center">
        <p className="text-sm text-amber-400">Unable to load AI-generated insights. Run an ingestion to generate them.</p>
      </div>
    );
  }

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
}

