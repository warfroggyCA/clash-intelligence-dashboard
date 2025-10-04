'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Home, TrendingUp, BarChart3, Activity, RefreshCw } from 'lucide-react';
import type { PlayerProfileData } from '@/lib/player-profile';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import type { Member } from '@/types';
import PlayerSummaryHeader from './PlayerSummaryHeader';
import PlayerHeroProgress from './PlayerHeroProgress';
import PlayerPerformanceOverview from './PlayerPerformanceOverview';
import PlayerEngagementInsights from './PlayerEngagementInsights';
import PlayerNotesPanel from './PlayerNotesPanel';
import SectionCard from '@/components/ui/SectionCard';
import PerformanceTimelineChart from './charts/PerformanceTimelineChart';
import PlayerComparisonDashboard from './PlayerComparisonDashboard';
import PlayerActivityAnalytics from './PlayerActivityAnalytics';

interface PlayerProfilePageProps {
  data: PlayerProfileData;
}

const EMPTY_MEMBERS: Member[] = [];

export const PlayerProfilePage: React.FC<PlayerProfilePageProps> = ({ data }) => {
  const router = useRouter();
  const rosterMembers = useDashboardStore((state) => state.roster?.members ?? EMPTY_MEMBERS);
  
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'comparison' | 'activity'>('overview');
  const [daysFilter, setDaysFilter] = useState(30);

  const normalizedTag = useMemo(() => normalizeTag(data.summary.tag).replace('#', ''), [data.summary.tag]);

  const navigation = useMemo(() => {
    if (!rosterMembers.length) {
      return null;
    }
    const normalizedList = rosterMembers.map((member) => normalizeTag(member.tag).replace('#', ''));
    const currentIndex = normalizedList.indexOf(normalizedTag);
    if (currentIndex === -1) {
      return null;
    }

    const prevIndex = currentIndex === 0 ? normalizedList.length - 1 : currentIndex - 1;
    const nextIndex = currentIndex === normalizedList.length - 1 ? 0 : currentIndex + 1;

    return {
      prevTag: normalizedList.length > 1 ? normalizedList[prevIndex] : null,
      nextTag: normalizedList.length > 1 ? normalizedList[nextIndex] : null,
      hasMultiple: normalizedList.length > 1,
    };
  }, [normalizedTag, rosterMembers]);

  const navigateTo = useCallback((tag: string | null) => {
    if (!tag) return;
    router.push(`/player/${tag}`);
  }, [router]);

  // Fetch historical data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch historical data
        const historyResponse = await fetch(`/api/player/${normalizedTag}/history?days=${daysFilter}`);
        if (historyResponse.ok) {
          const historyResult = await historyResponse.json();
          setHistoricalData(historyResult.data || []);
        }

        // Fetch comparison data
        const comparisonResponse = await fetch(`/api/player/${normalizedTag}/comparison`);
        if (comparisonResponse.ok) {
          const comparisonResult = await comparisonResponse.json();
          setComparisonData(comparisonResult.data);
        }
      } catch (error) {
        console.error('Error fetching player analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [normalizedTag, daysFilter]);

  useEffect(() => {
    if (!navigation?.hasMultiple) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateTo(navigation.prevTag);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateTo(navigation.nextTag);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigation, navigateTo]);

  const navContent = navigation?.hasMultiple ? (
    <div className="flex w-full items-center justify-between gap-3 text-sm text-muted-contrast">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
        onClick={() => navigateTo(navigation.prevTag)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
        onClick={() => router.push('/')}
      >
        <Home className="h-4 w-4" aria-hidden /> Home
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
        onClick={() => navigateTo(navigation.nextTag)}
      >
        Next <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  ) : (
    <div className="flex w-full justify-end text-sm text-muted-contrast">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
        onClick={() => router.push('/')}
      >
        <Home className="h-4 w-4" aria-hidden /> Home
      </button>
    </div>
  );

  return (
    <div className="player-profile space-y-6">
      <div className="sticky top-0 z-50">
        <div className="bg-brand-surfaceRaised/85 px-4 pb-3 pt-4 shadow-[0_16px_32px_-22px_rgba(8,15,31,0.9)] backdrop-blur">
          <div className="mx-auto w-full rounded-full border border-brand-border/50 bg-brand-surfaceRaised/95 px-4 py-2 shadow-[0_12px_24px_-18px_rgba(8,15,31,0.9)]">
            {navContent}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-8">
        <PlayerSummaryHeader summary={data.summary} />

        <SectionCard title="Hero Readiness" subtitle="Progress vs. Town Hall caps" className="section-card--sub">
          <PlayerHeroProgress heroes={data.heroProgress} clanHeroBenchmarks={data.heroBenchmarks} />
        </SectionCard>

        <PlayerPerformanceOverview data={data.performance} />

        <PlayerEngagementInsights
          insights={data.engagementInsights}
          notes={data.leadershipNotes}
          actions={data.upcomingActions}
        />

        <PlayerNotesPanel notes={data.leadershipNotes} />
      </div>
    </div>
  );
};

export default PlayerProfilePage;
