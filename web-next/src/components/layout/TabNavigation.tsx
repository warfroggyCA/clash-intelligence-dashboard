"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useLeadership } from "@/hooks/useLeadership";
import { getVisibleTabs } from "@/lib/tab-config";
import { Menu, X } from "lucide-react";
import type { TabType } from "@/types";

interface TabNavigationProps {
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ className = "" }) => {
  const router = useRouter();
  const activeTab = useDashboardStore((state) => state.activeTab);
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);
  const { permissions, check } = useLeadership();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as TabType);
    setMobileMenuOpen(false);
    // Navigate to the appropriate page based on tab
    if (tabId === 'roster') {
      router.push('/');
    } else if (tabId === 'changes') {
      router.push('/changes');
    } else if (tabId === 'coaching') {
      router.push('/coaching');
    } else if (tabId === 'database') {
      router.push('/player-database');
    } else if (tabId === 'warplanning') {
      router.push('/war');
    } else if (tabId === 'discord') {
      router.push('/discord');
    } else if (tabId === 'leadership') {
      router.push('/leadership');
    } else if (tabId === 'applicants') {
      router.push('/applicants');
    }
  };

  const activeTabData = visibleTabs.find(tab => tab.id === activeTab);

  return (
    <>
      {/* Mobile Hamburger Menu */}
      <div className="md:hidden relative" ref={menuRef}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-brand-border bg-brand-surface-secondary hover:bg-brand-surface-hover transition-colors min-h-[44px]"
          aria-label="Toggle navigation menu"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            {activeTabData && (
              <>
                <span className="text-base">{activeTabData.icon}</span>
                <span>{activeTabData.label}</span>
              </>
            )}
          </span>
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-slate-400" />
          ) : (
            <Menu className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-brand-border bg-brand-surface-primary shadow-xl z-50 overflow-hidden">
            <div className="py-1">
              {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-surfaceRaised text-white border-l-2 border-brand-primary'
                        : 'text-slate-300 hover:bg-brand-surface-hover hover:text-white'
                    }`}
                    title={tab.description}
                    aria-label={tab.description}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="ml-auto text-brand-primary">●</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Tab Navigation */}
      <nav className={`hidden md:block tab-navigation -mx-2 overflow-x-auto px-2 pb-1 ${className}`} aria-label="Main navigation tabs">
        <div className="flex min-w-max gap-2">
          {visibleTabs.map((tab) => {
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
                onClick={() => handleTabClick(tab.id)}
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
    </>
  );
};

export default TabNavigation;
