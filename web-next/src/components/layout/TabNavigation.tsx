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
          "relative flex-shrink-0 px-3 py-1.5 text-sm font-semibold transition-all duration-300 rounded-xl shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
        const activeStyles =
          "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-300 scale-[1.02]";
        const inactiveStyles =
          "bg-white/10 text-white/70 hover:text-white hover:bg-white/20 border border-white/15";

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
              <div className="absolute -bottom-1 left-1/2 h-1 w-8 -translate-x-1/2 transform rounded-full bg-white" />
            )}
          </button>
        );
      })}
      </div>
    </nav>
  );
};

export default TabNavigation;
