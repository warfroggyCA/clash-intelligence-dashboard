"use client";

import React, { useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { ComponentWithChildren } from '@/types';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import LeadershipGuard from '@/components/LeadershipGuard';
import FontSizeControl from '@/components/FontSizeControl';
import { TabNavigation } from './TabNavigation';
// SmartInsightsHeadlines will be dynamically imported
import { ModalsContainer } from './ModalsContainer';
import ToastHub from './ToastHub';
import DevStatusBadge from './DevStatusBadge';
import { getAccessLevelDisplayName, type AccessLevel } from '@/lib/access-management';
import { safeTagForFilename } from '@/lib/tags';
import { QuickActionsMenu } from './QuickActionsMenu';
import { Button, ThemeToggle, GlassCard } from '@/components/ui';

const LoadingCard = () => (
  <GlassCard className="min-h-[18rem] animate-pulse">
    <div className="grid grid-cols-2 gap-3 text-base">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-2xl bg-white/15" />
      ))}
    </div>
  </GlassCard>
);

// Temporarily use direct imports to test CSS loading
import { RosterStatsPanel } from '@/components/roster/RosterStatsPanel';
import { RosterHighlightsPanel } from '@/components/roster/RosterHighlightsPanel';

// const RosterStatsPanel = dynamic(
//   () => import('@/components/roster/RosterStatsPanel'),
//   { ssr: false, loading: LoadingCard }
// );

// const RosterHighlightsPanel = dynamic(
//   () => import('@/components/roster/RosterHighlightsPanel'),
//   { ssr: false, loading: LoadingCard }
// );

const SmartInsightsHeadlines = dynamic(
  () => import('@/components/SmartInsightsHeadlines'),
  { ssr: false, loading: LoadingCard }
);

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardLayoutProps extends ComponentWithChildren {
  className?: string;
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

const DashboardHeader: React.FC = () => {
  const {
    clanTag,
    homeClan,
    setClanTag,
    setHomeClan,
    setMessage,
    loadRoster,
    refreshData,
    departureNotifications,
    setShowDepartureManager,
    setShowAccessManager,
    setShowSettings,
    currentAccessMember,
    accessPermissions,
  } = useDashboardStore();

  const clanName = useDashboardStore(selectors.clanName);
  const hasLeadershipAccess = useDashboardStore(selectors.hasLeadershipAccess);
  const inferredAccessLevel: AccessLevel = currentAccessMember?.accessLevel
    || (accessPermissions.canManageAccess
      ? 'leader'
      : accessPermissions.canAccessDiscordPublisher
        ? 'coleader'
        : 'member');
  const accessLevelLabel = getAccessLevelDisplayName(inferredAccessLevel);


  // Shrink-on-scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Define handleLoadHome first before using it in useEffect
  const handleLoadHome = useCallback(async () => {
    if (!homeClan) {
      setMessage('No home clan set. Use "Set Home" to save a clan.');
      return;
    }
    
    try {
      setClanTag(homeClan);
      await loadRoster(homeClan);
      setMessage(`Loaded home clan: ${homeClan}`);
    } catch (error) {
      console.error('[DashboardLayout] Failed to load home clan:', error);
      setMessage('Failed to load home clan. Please try again.');
    }
  }, [homeClan, setClanTag, loadRoster, setMessage]);

  // Clean up corrupted clan tag data on mount and auto-load home clan
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return;
    
    if (clanTag && (clanTag.includes('232') || clanTag.length > 15)) {
      console.log('[DashboardHeader] Detected corrupted clan tag, clearing:', clanTag);
      setClanTag('');
    }
  }, [clanTag, setClanTag]);

  // Separate effect for home clan initialization (runs only once)
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return;
    
    // Set default home clan if none is set
    if (!homeClan) {
    setHomeClan('#2PR8R8V8P');
    }
  }, []); // Empty dependency array - runs only once on mount

  // Separate effect for auto-loading home clan
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return;
    
    // Auto-load home clan if no clan is currently loaded and home clan exists
    if (!clanTag && homeClan) {
      handleLoadHome();
    }
  }, [clanTag, homeClan, handleLoadHome]);

  const handleRefresh = async () => {
    if (clanTag) {
      await refreshData();
    }
  };

  // Simplified logo loading - use the known working logo
  const logoSrc = '/clans/2pr8r8v8p.png';

  return (
    <header className="w-full sticky top-0 z-50 header-hero text-white shadow-lg/70 supports-[backdrop-filter]:backdrop-blur">
      {/* Unified 2-row grid: left/right controls; name centered across rows */}
      <div className="relative z-10 w-full px-4 py-2 grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] grid-rows-[auto,auto] items-center gap-x-4 gap-y-1">
        {/* Left badge */}
        <div className="hidden sm:flex flex-col justify-center col-[1] row-[1] row-span-2">
          <span className="text-xl font-semibold tracking-wide text-white/80 uppercase">Clan Dashboard</span>
        </div>

        {/* Logo + clan name */}
        <div className="col-[1] sm:col-[2] row-[1] row-span-2 flex justify-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16">
              <img
                src={logoSrc}
                alt="Clan Logo"
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover ring-2 ring-white/30 bg-white/10 shadow-lg"
              />
            </div>
            <div className="text-center sm:text-left">
              {clanName ? (
                <div className={`font-heading font-extrabold tracking-tight drop-shadow-lg leading-none transition-all duration-200 ${isScrolled ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}>
                  {clanName}
                </div>
              ) : (
                <div className="font-heading font-extrabold text-3xl sm:text-4xl drop-shadow-lg leading-none">Clash Intelligence</div>
              )}
            </div>
          </div>
        </div>

        {/* Right (row 1): Access level + tiny controls */}
        <div className="flex items-center justify-end gap-2 col-[3] row-[1]">
          <span className="hidden md:inline-flex items-center px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-md">
            {accessLevelLabel}
          </span>

          {/* Access Management */}
          <LeadershipGuard requiredPermission="canManageAccess" fallback={null}>
            <button
              onClick={() => setShowAccessManager(true)}
              className="h-8 px-2 hover:bg-indigo-600 rounded-md text-sm"
              title="Manage clan access"
            >
              👥
            </button>
          </LeadershipGuard>

          {/* Font Size Control */}
          <div className="hidden md:block scale-90 origin-right"><FontSizeControl /></div>

          {/* FAQ */}
          <a href="/faq" className="h-8 px-2 hover:bg-indigo-600 rounded-md text-sm inline-flex items-center" title="FAQ">❓</a>

          {/* Refresh */}
          <button onClick={handleRefresh} className="h-8 px-2 hover:bg-indigo-600 rounded-md text-sm" title="Refresh">🔄</button>

          {/* Quick Actions */}
          <div className="hidden xl:block">
            <QuickActionsMenu variant="inline" />
          </div>

          {/* Theme Toggle */}
          <ThemeToggle size="sm" />

          {/* Settings */}
          <button 
            onClick={() => {
          setShowSettings(true);
            }} 
            className="h-8 px-2 hover:bg-indigo-600 rounded-md text-sm" 
            title="Settings"
            type="button"
          >
            ⚙️
          </button>

          {/* Departure Notifications */}
          <LeadershipGuard requiredPermission="canManageChangeDashboard" fallback={null}>
            {departureNotifications > 0 && (
              <button
                onClick={() => setShowDepartureManager(true)}
                className="relative h-8 px-2 hover:bg-indigo-600 rounded-md text-sm"
                title="Member departure notifications"
              >
                🔔
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center">
                  {departureNotifications}
                </span>
              </button>
            )}
          </LeadershipGuard>
        </div>
        {/* Row 2 (right column): Clan context chips */}
        <div className="col-[3] row-[2]">
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 text-xs">
            <button
              onClick={() => setShowSettings(true)}
              className="h-8 px-3 bg-white/15 hover:bg-white/25 text-white rounded-md transition-all border border-white/30"
              title="Manage clan settings"
              type="button"
            >
              Manage Clans
            </button>
            <div className="w-full sm:w-auto xl:hidden">
              <QuickActionsMenu variant="inline" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// =============================================================================
// MAIN LAYOUT COMPONENT
// =============================================================================

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className = '',
}) => {
  const activeTab = useDashboardStore((state) => state.activeTab);
  const [debugKey, setDebugKey] = useState('primary');
  const [ready, setReady] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  
  useEffect(() => {
    console.log('🎯 DashboardLayout: Setting ready to true');
    setReady(true);
    // Force a re-render after hydration
    setTimeout(() => {
      console.log('🎯 DashboardLayout: Force re-render after hydration');
      setForceRender(prev => prev + 1);
    }, 100);
  }, []);

  return (
    <div className={`min-h-screen w-full ${className}`}>
      {/* Header */}
      <DashboardHeader />
      
      {/* Tab Navigation (sticky under header) */}
      <div className="w-full px-0 sticky top-[var(--header-height,80px)] z-40">
        <div className="relative bg-white/90 backdrop-blur-sm rounded-b-xl border border-t-0 border-gray-200">
          {/* Thin gradient seam to visually glue to header */}
          <div className="absolute -top-2 left-0 right-0 h-2 bg-header-gradient" />
          <TabNavigation />
        </div>
      </div>
      
      {/* Main Content */}
      <main className="dashboard-main min-h-screen px-4 pb-6 pt-4 flex flex-col gap-6 w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-high-contrast rounded-b-3xl shadow-[0_24px_55px_-30px_rgba(0,0,0,0.3)] border border-t-0 border-clash-gold/20">
        <ToastHub />
        {/* Dev Status */}
        <DevStatusBadge />
        {activeTab === 'roster' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => setDebugKey(prev => prev === 'primary' ? 'alt' : 'primary')}
                  size="sm"
                  variant="outline"
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10 font-medium shadow-sm focus-ring"
                >
                  🔄 Debug Rerender
                </Button>
              </div>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr),minmax(0,1fr),minmax(0,1fr)] items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
                  <h3 className="text-lg font-semibold text-high-contrast">Today's Headlines</h3>
                </div>
                <SmartInsightsHeadlines className="min-h-[18rem]" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-clash-blue to-clash-purple rounded-full"></div>
                  <h3 className="text-lg font-semibold text-high-contrast">Roster Snapshot</h3>
                </div>
                  <RosterStatsPanel key={`${debugKey}-${forceRender}`} className="min-h-[18rem]" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-clash-purple to-clash-red rounded-full"></div>
                  <h3 className="text-lg font-semibold text-high-contrast">Clan Highlights</h3>
                </div>
                  <RosterHighlightsPanel key={`${debugKey}-${forceRender}`} className="min-h-[18rem]" />
              </div>
            </div>
          </>
        )}

        {/* Page Content */}
        {children}
      </main>
      
      {/* Footer */}
      <footer className="w-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-t border-clash-gold/20 mt-12">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between text-sm text-medium-contrast">
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
                <span className="font-semibold text-high-contrast">Clash Intelligence Dashboard</span>
              </div>
              <span className="text-muted-contrast">•</span>
              <span className="font-mono bg-gradient-to-r from-clash-gold/20 to-clash-orange/20 text-clash-gold px-3 py-1 rounded-full text-xs font-semibold border border-clash-gold/30">
                v{process.env.NEXT_PUBLIC_APP_VERSION || '0.21.0'}
              </span>
              <span className="text-muted-contrast">•</span>
              <span className="text-muted-contrast">A warfroggy project</span>
            </div>
            <div className="text-xs text-muted-contrast font-medium">Built with Next.js • Clash of Clans API</div>
          </div>
        </div>
      </footer>
      
      {/* Modals Container */}
      <ModalsContainer />
    </div>
  );
};

export default DashboardLayout;
