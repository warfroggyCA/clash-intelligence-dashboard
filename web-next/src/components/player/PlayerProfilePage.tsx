'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerProfileData, normalizePlayerTag } from '@/lib/player-profile';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import PlayerSummaryHeader from './PlayerSummaryHeader';
import PlayerHeroProgress from './PlayerHeroProgress';
import PlayerPerformanceOverview from './PlayerPerformanceOverview';
import PlayerEngagementInsights from './PlayerEngagementInsights';
import PlayerNotesPanel from './PlayerNotesPanel';
import SectionCard from '@/components/ui/SectionCard';

interface PlayerProfilePageProps {
  data: PlayerProfileData;
}

export const PlayerProfilePage: React.FC<PlayerProfilePageProps> = ({ data }) => {
  const router = useRouter();
  const rosterMembers = useDashboardStore((state) => state.roster?.members ?? []);

  const normalizedTag = useMemo(() => normalizePlayerTag(data.summary.tag), [data.summary.tag]);

  const navigation = useMemo(() => {
    if (!rosterMembers.length) {
      return null;
    }
    const normalizedList = rosterMembers.map((member) => normalizePlayerTag(member.tag));
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

  return (
    <div className="player-profile space-y-6">
      <div className="space-y-4">
        {navigation?.hasMultiple ? (
          <div className="flex items-center justify-between text-sm text-muted-contrast">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
              onClick={() => navigateTo(navigation.prevTag)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-brand-surfaceRaised"
              onClick={() => navigateTo(navigation.nextTag)}
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <PlayerSummaryHeader summary={data.summary} />
      </div>

      <SectionCard title="Hero Readiness" subtitle="Progress vs. Town Hall caps" className="section-card--sub">
        <PlayerHeroProgress heroes={data.heroProgress} />
      </SectionCard>

      <PlayerPerformanceOverview data={data.performance} />

      <PlayerEngagementInsights
        insights={data.engagementInsights}
        notes={data.leadershipNotes}
        actions={data.upcomingActions}
      />

      <PlayerNotesPanel notes={data.leadershipNotes} />
    </div>
  );
};

export default PlayerProfilePage;
