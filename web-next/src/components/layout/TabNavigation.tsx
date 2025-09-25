"use client";

import React from "react";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { TabType } from "@/types";

interface TabNavigationProps {
  className?: string;
}

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
}

const TAB_CONFIGS: TabConfig[] = [
  { id: "roster", label: "Dashboard", icon: "🛡️", description: "Daily overview and roster" },
  { id: "changes", label: "History", icon: "📜", description: "Track roster changes and departures" },
  { id: "coaching", label: "Insights", icon: "💡", description: "Recommendations, spotlights, and coaching" },
  { id: "database", label: "Player DB", icon: "🗄️", description: "Player notes and archives" },
  { id: "applicants", label: "Applicants", icon: "🎯", description: "Evaluate potential clan members" },
  { id: "discord", label: "Discord", icon: "📢", description: "Publish reports to Discord" },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ className = "" }) => {
  const activeTab = useDashboardStore((state) => state.activeTab);
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);

  return (
    <nav className={`tab-navigation -mx-2 overflow-x-auto px-2 pb-1 ${className}`} aria-label="Main navigation tabs">
      <div className="flex min-w-max gap-2">
        {TAB_CONFIGS.map((tab) => {
        const isActive = activeTab === tab.id;
        const baseStyles =
          "relative flex-shrink-0 px-3.5 py-2 text-sm font-semibold transition-all duration-200 rounded-b-xl rounded-t-none border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60";
        const activeStyles =
          "border-brand-border/80 border-t-transparent bg-brand-surfaceRaised text-white shadow-[0_12px_24px_-16px_rgba(8,15,31,0.6)]";
        const inactiveStyles =
          "border-transparent border-t-brand-border/40 text-slate-400 hover:border-brand-border/60 hover:bg-brand-surfaceSubtle/60 hover:text-slate-100";

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
