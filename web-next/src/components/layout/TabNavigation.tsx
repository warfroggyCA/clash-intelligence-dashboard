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
    <nav className={`flex flex-wrap gap-1 p-2 sm:flex-nowrap ${className}`}>
      {TAB_CONFIGS.map((tab) => {
        const isActive = activeTab === tab.id;
        const baseStyles =
          "relative px-3 sm:px-6 py-1.5 sm:py-2 font-semibold text-base sm:text-lg transition-all duration-300 rounded-lg flex-1 sm:flex-none";
        const activeStyles =
          "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transform scale-105 border-2 border-blue-400 [data-theme='light']:bg-gradient-to-br [data-theme='light']:from-blue-600 [data-theme='light']:to-blue-700 [data-theme='light']:text-white [data-theme='dark']:text-white";
        const inactiveStyles =
          "bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 hover:shadow-md hover:scale-102 border-2 border-gray-200 hover:border-blue-200";

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${baseStyles} ${isActive ? activeStyles : inactiveStyles}`}
            title={tab.description}
            aria-label={tab.description}
          >
            <span className="flex items-center gap-1.5 sm:gap-3 justify-center sm:justify-start">
              <span className="text-lg sm:text-xl">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
            {isActive && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default TabNavigation;
