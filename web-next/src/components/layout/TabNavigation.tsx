"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useLeadership } from "@/hooks/useLeadership";
import { getVisibleTabs } from "@/lib/tab-config";

interface TabNavigationProps {
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ className = "" }) => {
  const router = useRouter();
  const activeTab = useDashboardStore((state) => state.activeTab);
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);
  const { permissions, check } = useLeadership();

  const visibleTabs = useMemo(
    () => getVisibleTabs({ permissions, check }),
    [permissions, check]
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_TAB_AUTO_CORRECT === 'true') {
      if (typeof window !== 'undefined' && (window as any).__TAB_DEBUG__) {
        // eslint-disable-next-line no-console
        console.log('[TabNavigation] auto-correct disabled');
      }
      return;
    }
    if (!visibleTabs.length) return;
    const isActiveVisible = visibleTabs.some((tab) => tab.id === activeTab);
    if (!isActiveVisible) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab, setActiveTab]);

  return (
    <nav className={`tab-navigation -mx-2 overflow-x-auto px-2 pb-1 ${className}`} aria-label="Main navigation tabs">
      <div className="flex min-w-max gap-2">
        {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const baseStyles =
          "relative flex-shrink-0 px-3.5 py-2 text-sm font-semibold transition-all duration-200 rounded-b-xl rounded-t-none border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60";
        const activeStyles =
          "border-brand-border/80 border-t-transparent bg-brand-surfaceRaised text-white shadow-[0_12px_24px_-16px_rgba(8,15,31,0.6)]";
        const inactiveStyles =
          "border-transparent border-t-brand-border/40 text-slate-400 hover:border-brand-border/60 hover:bg-brand-surfaceSubtle/60 hover:text-slate-100";

        const handleTabClick = () => {
          setActiveTab(tab.id);
          // Navigate to the appropriate page based on tab
          if (tab.id === 'roster') {
            router.push('/');
          } else if (tab.id === 'changes') {
            router.push('/changes');
          } else if (tab.id === 'coaching') {
            router.push('/coaching');
          } else if (tab.id === 'database') {
            router.push('/database');
          } else if (tab.id === 'applicants') {
            router.push('/applicants');
          }
        };

        return (
          <button
            key={tab.id}
            onClick={handleTabClick}
            className={`${baseStyles} ${isActive ? activeStyles : inactiveStyles} ${isActive ? 'active' : ''}`}
            title={tab.description}
            aria-label={tab.description}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{tab.icon}</span>
              <span className="text-sm sm:text-base">{tab.label}</span>
            </span>
            {isActive && (
              <div className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-brand-primary" />
            )}
          </button>
        );
      })}
      </div>
    </nav>
  );
};

export default TabNavigation;
