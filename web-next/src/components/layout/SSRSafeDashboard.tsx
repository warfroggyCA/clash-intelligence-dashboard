"use client";

import { useEffect, useState } from 'react';

interface SSRSafeDashboardProps {
  className?: string;
}

const LoadingCard = () => (
  <div className="min-h-[16rem] rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle/70 px-4 py-6">
    <div className="space-y-3">
      <div className="h-3 w-28 rounded-full bg-slate-700/60" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-8 rounded-xl bg-slate-800/70" />
        ))}
      </div>
    </div>
  </div>
);

export const SSRSafeDashboard: React.FC<SSRSafeDashboardProps> = ({ className = '' }) => {
  const [mounted, setMounted] = useState(false);
  const [SmartInsightsHeadlines, setInsightsComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const loadComponent = async () => {
      try {
        const { default: component } = await import('@/components/SmartInsightsHeadlines');
        setInsightsComponent(() => component);
      } catch (error) {
        console.error('Failed to load SmartInsightsHeadlines:', error);
      } finally {
        setMounted(true);
      }
    };

    loadComponent();
  }, []);

  return (
    <div className={`mt-6 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-clash-gold to-clash-orange" />
        <h3 className="text-lg font-semibold text-high-contrast">Today&apos;s Highlights</h3>
      </div>
      <div className="mt-4">
        {mounted && SmartInsightsHeadlines ? (
          <SmartInsightsHeadlines />
        ) : (
          <LoadingCard />
        )}
      </div>
    </div>
  );
};

export default SSRSafeDashboard;
