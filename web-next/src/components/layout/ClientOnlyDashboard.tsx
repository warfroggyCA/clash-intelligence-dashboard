"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const LoadingCard = () => (
  <div className="min-h-[18rem] animate-pulse bg-slate-800 rounded-lg">
    <div className="grid grid-cols-2 gap-3 text-base p-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-2xl bg-slate-700" />
      ))}
    </div>
  </div>
);

// Dynamic imports with aggressive SSR bypass
const RosterStatsPanel = dynamic(
  () => import('@/components/roster/RosterStatsPanel'),
  { 
    ssr: false, 
    loading: () => <LoadingCard />
  }
);

const RosterHighlightsPanel = dynamic(
  () => import('@/components/roster/RosterHighlightsPanel'),
  { 
    ssr: false, 
    loading: () => <LoadingCard />
  }
);

const SmartInsightsHeadlines = dynamic(
  () => import('@/components/SmartInsightsHeadlines'),
  { 
    ssr: false, 
    loading: () => <LoadingCard />
  }
);

interface ClientOnlyDashboardProps {
  className?: string;
}

export const ClientOnlyDashboard: React.FC<ClientOnlyDashboardProps> = ({ className = '' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className={`grid items-stretch gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr),minmax(0,1fr),minmax(0,1fr)] ${className}`}>
      <div className="flex h-full flex-col gap-4 lg:col-span-2 xl:col-span-1">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Today&apos;s Headlines</h3>
        </div>
        <SmartInsightsHeadlines className="flex-1" />
      </div>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-blue to-clash-purple rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Roster Snapshot</h3>
        </div>
        <RosterStatsPanel className="flex-1" />
      </div>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 mt-6">
          <div className="h-1 w-8 bg-gradient-to-r from-clash-purple to-clash-red rounded-full"></div>
          <h3 className="text-lg font-semibold text-high-contrast">Clan Highlights</h3>
        </div>
        <RosterHighlightsPanel className="flex-1" />
      </div>
    </div>
  );
};

export default ClientOnlyDashboard;
