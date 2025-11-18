/**
 * Tab Component
 * 
 * Accessible tab navigation component for organizing content within pages.
 * Supports URL-based tab state and keyboard navigation.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
  useUrlState?: boolean;
  urlParamName?: string;
  onTabChange?: (tabId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  className = '',
  tabClassName = '',
  contentClassName = '',
  useUrlState = true,
  urlParamName = 'tab',
  onTabChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = useUrlState ? searchParams.get(urlParamName) : null;

  // Determine active tab
  const getActiveTab = useCallback(() => {
    if (urlTab && tabs.some((tab) => tab.id === urlTab && !tab.disabled)) {
      return urlTab;
    }
    if (defaultTab && tabs.some((tab) => tab.id === defaultTab && !tab.disabled)) {
      return defaultTab;
    }
    // Find first non-disabled tab
    const firstEnabled = tabs.find((tab) => !tab.disabled);
    return firstEnabled?.id || tabs[0]?.id || '';
  }, [urlTab, defaultTab, tabs]);

  const [activeTab, setActiveTab] = useState<string>(getActiveTab());

  // Sync with URL changes
  useEffect(() => {
    const newActiveTab = getActiveTab();
    if (newActiveTab !== activeTab) {
      setActiveTab(newActiveTab);
    }
  }, [urlTab, getActiveTab, activeTab]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || tab.disabled) return;

      setActiveTab(tabId);
      onTabChange?.(tabId);

      if (useUrlState) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(urlParamName, tabId);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    },
    [tabs, useUrlState, urlParamName, pathname, router, searchParams, onTabChange],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, tabId: string) => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      let targetIndex = currentIndex;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          targetIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          event.preventDefault();
          targetIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home':
          event.preventDefault();
          targetIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          targetIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      // Find next enabled tab
      let attempts = 0;
      while (tabs[targetIndex]?.disabled && attempts < tabs.length) {
        if (event.key === 'ArrowLeft' || event.key === 'Home') {
          targetIndex = targetIndex > 0 ? targetIndex - 1 : tabs.length - 1;
        } else {
          targetIndex = targetIndex < tabs.length - 1 ? targetIndex + 1 : 0;
        }
        attempts++;
      }

      if (tabs[targetIndex] && !tabs[targetIndex].disabled) {
        handleTabChange(tabs[targetIndex].id);
      }
    },
    [tabs, activeTab, handleTabChange],
  );

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Tab List */}
      <div
        role="tablist"
        className="flex flex-wrap gap-2 border-b border-brand-border/60 mb-6"
        aria-label="Tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={isDisabled}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              disabled={isDisabled}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                'border-b-2 border-transparent',
                'hover:text-slate-200',
                isActive
                  ? 'text-brand-primary border-brand-primary'
                  : 'text-slate-400',
                isDisabled && 'opacity-50 cursor-not-allowed',
                !isDisabled && 'cursor-pointer',
                tabClassName,
              )}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                    isActive
                      ? 'bg-brand-primary/20 text-brand-primary'
                      : 'bg-slate-700 text-slate-400',
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className={cn('w-full', contentClassName)}
      >
        {activeTabContent}
      </div>
    </div>
  );
};

export default Tabs;

