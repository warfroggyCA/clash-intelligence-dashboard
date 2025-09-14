/**
 * TabNavigation Component
 * 
 * Handles the tab navigation system for the dashboard.
 * Provides consistent tab switching with proper state management and accessibility.
 * 
 * Features:
 * - Responsive tab design
 * - Active tab highlighting
 * - Leadership indicators for restricted tabs
 * - Keyboard navigation support
 * - Mobile-optimized layout
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { TabType } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface TabNavigationProps {
  className?: string;
}

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  shortLabel: string;
  requiresLeadership?: boolean;
  description: string;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    id: 'roster',
    label: 'Roster',
    icon: '🛡️',
    shortLabel: 'Roster',
    description: 'View clan member roster and statistics'
  },
  {
    id: 'changes',
    label: 'Activity',
    icon: '📈',
    shortLabel: 'Activity',
    description: 'Track member activity and changes'
  },
  {
    id: 'database',
    label: 'Player DB',
    icon: '🗄️',
    shortLabel: 'Player DB',
    description: 'Player database and notes'
  },
  {
    id: 'coaching',
    label: 'Coaching',
    icon: '🤖',
    shortLabel: 'AI Coaching',
    requiresLeadership: true,
    description: 'AI-powered coaching advice'
  },
  {
    id: 'events',
    label: 'Events',
    icon: '📊',
    shortLabel: 'Events',
    description: 'Significant player events and milestones'
  },
  {
    id: 'applicants',
    label: 'Applicants',
    icon: '🎯',
    shortLabel: 'Applicants',
    description: 'Evaluate potential clan members'
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: '🔍',
    shortLabel: 'Intelligence',
    description: 'Advanced analytics and insights'
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: '📢',
    shortLabel: 'Discord',
    requiresLeadership: true,
    description: 'Publish reports to Discord'
  }
];

// =============================================================================
// TAB COMPONENT
// =============================================================================

interface TabButtonProps {
  config: TabConfig;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ config, isActive, onClick }) => {
  const hasLeadershipAccess = selectors.hasLeadershipAccess(useDashboardStore.getState());
  const canAccess = !config.requiresLeadership || hasLeadershipAccess;
  
  const baseStyles = "relative px-3 sm:px-6 py-1 sm:py-2 font-semibold text-sm sm:text-base transition-all duration-300 rounded-lg flex-1 sm:flex-none";
  
  const activeStyles = "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transform scale-105 border-2 border-blue-400";
  const inactiveStyles = canAccess 
    ? "bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 hover:shadow-md hover:scale-102 border-2 border-gray-200 hover:border-blue-200"
    : "!bg-gray-100 !text-gray-400 !cursor-not-allowed !border-2 !border-gray-200";
  
  const buttonStyles = `${baseStyles} ${isActive ? activeStyles : inactiveStyles}`;
  
  return (
    <button
      onClick={canAccess ? onClick : undefined}
      className={buttonStyles}
      disabled={!canAccess}
      title={canAccess ? config.description : 'Leadership access required'}
      aria-label={config.description}
    >
      <span className="flex items-center gap-1 sm:gap-2 justify-center sm:justify-start">
        <span className="text-base sm:text-lg">
          {config.icon}
          {config.requiresLeadership && hasLeadershipAccess && (
            <span className="ml-1 text-xs">👑</span>
          )}
        </span>
        <span className="hidden sm:inline">
          {config.label}
          {config.requiresLeadership && !hasLeadershipAccess && (
            <span className="ml-1 text-xs">🔒</span>
          )}
        </span>
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
      )}
    </button>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TabNavigation: React.FC<TabNavigationProps> = ({ className = '' }) => {
  const { activeTab, setActiveTab } = useDashboardStore();
  const hasLeadershipAccess = selectors.hasLeadershipAccess(useDashboardStore.getState());
  
  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
  };
  
  // Hide tabs the user cannot access (cleaner UX than locking)
  const visibleTabs = TAB_CONFIGS.filter(cfg => !cfg.requiresLeadership || hasLeadershipAccess);

  return (
    <nav className={`flex flex-wrap gap-1 p-2 sm:flex-nowrap ${className}`}>
      {visibleTabs.map((config) => (
        <TabButton
          key={config.id}
          config={config}
          isActive={activeTab === config.id}
          onClick={() => handleTabChange(config.id)}
        />
      ))}
    </nav>
  );
};

export default TabNavigation;
