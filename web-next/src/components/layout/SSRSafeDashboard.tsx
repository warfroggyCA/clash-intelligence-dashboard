"use client";

import { useState, useEffect } from 'react';

interface SSRSafeDashboardProps {
  className?: string;
}

export const SSRSafeDashboard: React.FC<SSRSafeDashboardProps> = ({ className = '' }) => {
  const [mounted, setMounted] = useState(false);
  const [components, setComponents] = useState<{
    SmartInsightsHeadlines?: React.ComponentType<any>;
    RosterStatsPanel?: React.ComponentType<any>;
    RosterHighlightsPanel?: React.ComponentType<any>;
  }>({});

  useEffect(() => {
    // Only load components after mount
    const loadComponents = async () => {
      try {
        const [
          { default: SmartInsightsHeadlines },
          { RosterStatsPanel },
          { RosterHighlightsPanel }
        ] = await Promise.all([
          import('@/components/SmartInsightsHeadlines'),
          import('@/components/roster/RosterStatsPanel'),
          import('@/components/roster/RosterHighlightsPanel')
        ]);

        setComponents({
          SmartInsightsHeadlines,
          RosterStatsPanel,
          RosterHighlightsPanel
        });
        setMounted(true);
      } catch (error) {
        console.error('Failed to load dashboard components:', error);
        setMounted(true); // Still set mounted to show error state
      }
    };

    loadComponents();
  }, []);

  const LoadingCard = () => (
    <div className="min-h-[18rem] animate-pulse bg-slate-800 rounded-lg">
      <div className="grid grid-cols-2 gap-3 text-base p-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-2xl bg-slate-700" />
        ))}
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div className={`grid items-stretch gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr),minmax(0,1fr),minmax(0,1fr)] ${className}`}>
        <div className="flex h-full flex-col gap-4 lg:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2 mt-6">
            <div className="h-1 w-8 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
            <h3 className="text-lg font-semibold text-high-contrast">Today&apos;s Headlines</h3>
          </div>
          <LoadingCard />
        </div>
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-2 mt-6">
            <div className="h-1 w-8 bg-gradient-to-r from-clash-blue to-clash-purple rounded-full"></div>
            <h3 className="text-lg font-semibold text-high-contrast">Roster Snapshot</h3>
          </div>
          <LoadingCard />
        </div>
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-2 mt-6">
            <div className="h-1 w-8 bg-gradient-to-r from-clash-purple to-clash-red rounded-full"></div>
            <h3 className="text-lg font-semibold text-high-contrast">Clan Highlights</h3>
          </div>
          <LoadingCard />
        </div>
      </div>
    );
  }

  const { SmartInsightsHeadlines, RosterStatsPanel, RosterHighlightsPanel } = components;

  return (
    <div className={`grid items-stretch gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr),minmax(0,1fr),minmax(0,1fr)] ${className}`}>
      <div className="flex h-full flex-col gap-4 lg:col-span-2 xl:col-span-1">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Today&apos;s Headlines</h3>
        </div>
        {SmartInsightsHeadlines ? (
          <SmartInsightsHeadlines className="flex-1" />
        ) : (
          <LoadingCard />
        )}
      </div>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-blue to-clash-purple rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Roster Snapshot</h3>
        </div>
        {RosterStatsPanel ? (
          <RosterStatsPanel className="flex-1" />
        ) : (
          <LoadingCard />
        )}
      </div>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-purple to-clash-red rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Clan Highlights</h3>
        </div>
        {RosterHighlightsPanel ? (
          <RosterHighlightsPanel className="flex-1" />
        ) : (
          <LoadingCard />
        )}
      </div>
    </div>
  );
};

export default SSRSafeDashboard;
