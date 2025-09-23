"use client";

import React, { useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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
import { ThemeToggle, GlassCard } from '@/components/ui';

const LoadingCard = () => (
  <GlassCard className="min-h-[18rem] animate-pulse">
    <div className="grid grid-cols-2 gap-3 text-base">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-2xl bg-white/15" />
      ))}
    </div>
  </GlassCard>
);

const RosterStatsPanel = dynamic(
  () => import('@/components/roster/RosterStatsPanel'),
  { ssr: false, loading: LoadingCard }
);

const RosterHighlightsPanel = dynamic(
  () => import('@/components/roster/RosterHighlightsPanel'),
  { ssr: false, loading: LoadingCard }
);

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
    setShowIngestionMonitor,
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
  }, [homeClan, setHomeClan]); // Runs when homeClan context changes

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
              <Image
                src={logoSrc}
                alt="Clan Logo"
                fill
                sizes="(max-width: 640px) 3.5rem, 4rem"
                className="rounded-xl object-cover ring-2 ring-white/30 bg-white/10 shadow-lg"
                priority
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

        {/* Right: Clean, organized controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 col-[3] row-[1] row-span-2">
          {/* Access Level Badge */}
          <span className="hidden md:inline-flex items-center px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-md">
            {accessLevelLabel}
          </span>

          {/* Primary Actions Group */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <QuickActionsMenu variant="inline" />
            </div>
            <div className="sm:hidden">
              <QuickActionsMenu variant="inline" trigger="icon" />
            </div>
            <ThemeToggle size="sm" className="hidden sm:block" />
          </div>

          <ThemeToggle size="sm" className="sm:hidden" />

          {/* Secondary Actions Dropdown */}
          <div className="relative group">
            <button 
              className="h-8 w-8 flex items-center justify-center hover:bg-white/20 rounded-md transition-colors"
              title="More options"
            >
              ⋯
            </button>
            <div 
              className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
              style={{ 
                backgroundColor: '#1e293b', 
                border: '1px solid #475569',
                color: '#e2e8f0'
              }}
            >
              <div className="py-2">
                {/* Access Management */}
                <LeadershipGuard requiredPermission="canManageAccess" fallback={null}>
                  <button
                    onClick={() => setShowAccessManager(true)}
                    className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                    style={{ color: '#e2e8f0' }}
                    onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                  >
                    👥 Manage Access
                  </button>
                </LeadershipGuard>

                {/* Settings */}
                <button 
                  onClick={() => setShowSettings(true)}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#e2e8f0' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  ⚙️ Settings
                </button>

                {/* Manage Clans */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#e2e8f0' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  🏰 Manage Clans
                </button>

                {/* FAQ */}
                <a 
                  href="/faq" 
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#e2e8f0' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  ❓ FAQ
                </a>

                {/* Refresh */}
                <button 
                  onClick={handleRefresh}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#e2e8f0' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  🔄 Refresh
                </button>

                {/* Ingestion Monitor */}
                <button
                  onClick={() => {
                    setShowIngestionMonitor(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#e2e8f0' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  🧭 Ingestion Monitor
                </button>

                {/* Font Size Control */}
                <div className="px-4 py-2">
                  <div className="scale-90 origin-left">
                    <FontSizeControl />
                  </div>
                </div>

                {/* Departure Notifications */}
                <LeadershipGuard requiredPermission="canManageChangeDashboard" fallback={null}>
                  {departureNotifications > 0 && (
                    <button
                      onClick={() => setShowDepartureManager(true)}
                      className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 relative transition-colors duration-150"
                      style={{ color: '#e2e8f0' }}
                      onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#334155'}
                      onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                    >
                      🔔 Departures
                      <span 
                        className="ml-auto text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center"
                        style={{ backgroundColor: '#ef4444' }}
                      >
                        {departureNotifications}
                      </span>
                    </button>
                  )}
                </LeadershipGuard>
              </div>
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

  return (
    <div className={`min-h-screen w-full ${className}`}>
      {/* Header */}
      <DashboardHeader />
      
      {/* Tab Navigation (sticky under header) */}
      <div className="w-full px-0 sticky top-[var(--header-height,80px)] z-40">
        <div className="relative overflow-hidden rounded-b-xl border border-t-0 border-slate-800 bg-slate-900/95 backdrop-blur">
          {/* Thin gradient seam to visually glue to header */}
          <div className="absolute -top-2 left-0 right-0 h-2 bg-header-gradient" />
          <TabNavigation />
        </div>
      </div>
      
      {/* Main Content */}
      <main className="dashboard-main min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-high-contrast rounded-b-3xl border border-t-0 border-clash-gold/20 px-3 pb-6 pt-4 sm:px-4 flex flex-col gap-6 shadow-[0_24px_55px_-30px_rgba(0,0,0,0.3)]">
        {/* <ToastHub /> */}
        {/* Dev Status */}
        {/* <DevStatusBadge /> */}
        {activeTab === 'roster' && (
          <div className="grid items-stretch gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr),minmax(0,1fr),minmax(0,1fr)]">
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
        )}

        {/* Page Content */}
        {children}
      </main>
      
      {/* Footer */}
      <footer className="w-full bg-gray-800 border-t border-gray-600 mt-12">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-gradient-to-r from-clash-gold to-clash-orange rounded-full"></div>
                <span className="font-semibold !text-white" style={{ color: '#ffffff' }}>Clash Intelligence Dashboard</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="font-mono bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs font-semibold border border-gray-600">
                v{process.env.NEXT_PUBLIC_APP_VERSION || '0.21.0'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">A warfroggy project</span>
            </div>
            <div className="text-xs text-gray-400 font-medium">Built with Next.js • Clash of Clans API</div>
          </div>
        </div>
      </footer>
      
      {/* Modals Container */}
      <ModalsContainer />
    </div>
  );
};

export default DashboardLayout;
