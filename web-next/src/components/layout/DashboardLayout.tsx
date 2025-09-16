"use client";

/**
 * DashboardLayout Component
 * 
 * The main layout wrapper for the Clash Intelligence Dashboard.
 * Handles the overall structure, header, navigation, and responsive design.
 * 
 * Features:
 * - Responsive header with logo, clan input, and controls
 * - Tab navigation system
 * - Mobile-first responsive design
 * - Accessibility features
 * - Consistent spacing and styling
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useEffect, useCallback, useState } from 'react';
import { ComponentWithChildren } from '@/types';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import LeadershipGuard from '@/components/LeadershipGuard';
import FontSizeControl from '@/components/FontSizeControl';
import { TabNavigation } from './TabNavigation';
import { QuickActions } from './QuickActions';
import { ModalsContainer } from './ModalsContainer';
import ToastHub from './ToastHub';
import DevStatusBadge from './DevStatusBadge';
import { getAccessLevelDisplayName, type AccessLevel } from '@/lib/access-management';
import { sanitizeInputTag, normalizeTag, isValidTag, safeTagForFilename } from '@/lib/tags';

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
    selectedSnapshot,
    setSelectedSnapshot,
    departureNotifications,
    setShowDepartureManager,
    setShowAccessManager,
    checkDepartureNotifications,
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
      console.log('[DashboardLayout] Loading home clan:', homeClan);
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
      console.log('[DashboardHeader] No home clan set, setting default:', '#2PR8R8V8P');
      setHomeClan('#2PR8R8V8P');
    }
  }, []); // Empty dependency array - runs only once on mount

  // Separate effect for auto-loading home clan
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return;
    
    // Auto-load home clan if no clan is currently loaded and home clan exists
    if (!clanTag && homeClan) {
      console.log('[DashboardHeader] Auto-loading home clan on initialization:', homeClan);
      handleLoadHome();
    }
  }, [clanTag, homeClan, handleLoadHome]);

  const handleClanTagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = sanitizeInputTag(event.target.value);
    setClanTag(value);
  };

  const handleLoadClan = async () => {
    let cleanTag = normalizeTag(clanTag);

    if (!cleanTag) {
      setMessage('Please enter a clan tag');
      return;
    }
    
    if (!isValidTag(cleanTag)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }
    
    // Update the state with the clean tag
    setClanTag(cleanTag);
    
    // Add some debugging
    console.log('[DashboardLayout] Loading clan with tag:', cleanTag);
    
    try {
      await loadRoster(cleanTag);
    } catch (error) {
      console.error('[DashboardLayout] Failed to load roster:', error);
      setMessage('Failed to load clan data. Please try again.');
    }
  };

  const handleSetHome = () => {
    const cleanTag = normalizeTag(clanTag);

    if (!cleanTag) {
      setHomeClan(null);
      setMessage('Home clan cleared.');
      return;
    }
    
    try {
      if (!isValidTag(cleanTag)) {
        setMessage('Please enter a valid clan tag');
        return;
      }
      
      setHomeClan(cleanTag);
      setMessage(`Home clan set to ${cleanTag}`);
    } catch (error) {
      setMessage('Failed to set home clan');
    }
  };

  const handleRefresh = async () => {
    if (clanTag) {
      await refreshData();
    }
  };

  // Logo source candidates: try several common paths/extensions before fallback
  const activeTag = (clanTag || homeClan || '').toString();
  const logoSafe = activeTag ? safeTagForFilename(activeTag) : '';
  const logoUpper = activeTag.replace('#', '');
  const logoLower = logoUpper.toLowerCase();
  const logoCandidates = [
    logoSafe ? `/clans/${logoSafe}.png` : '',
    logoSafe ? `/clans/${logoSafe}.jpg` : '',
    logoSafe ? `/clans/${logoSafe}.jpeg` : '',
    logoSafe ? `/clans/${logoSafe}.webp` : '',
    logoLower ? `/${logoLower}.png` : '',
    logoLower ? `/${logoLower}.jpg` : '',
    logoLower ? `/${logoLower}.jpeg` : '',
    logoLower ? `/${logoLower}.webp` : '',
    logoUpper ? `/${logoUpper}.PNG` : '',
  ].filter(Boolean);
  const [logoIdx, setLogoIdx] = useState(0);
  useEffect(() => { setLogoIdx(0); }, [logoSafe, logoLower, logoUpper]);
  const logoSrc = logoCandidates[logoIdx] || '/clan-logo.png';

  return (
    <header className="w-full sticky top-0 z-50 bg-header-gradient text-white shadow-lg/70 backdrop-blur supports-[backdrop-filter]:bg-white/10">
      {/* Unified 2-row grid: left/right controls; name centered across rows */}
      <div className="w-full px-4 py-2 grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] grid-rows-[auto,auto] items-center gap-x-4 gap-y-1">
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
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover ring-2 ring-white/30 bg-white/10 absolute inset-0 shadow-lg"
                onError={(e) => {
                  setLogoIdx((i) => {
                    const next = i + 1;
                    if (next < logoCandidates.length) return next;
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    return i;
                  });
                }}
              />
              <div
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl ring-2 ring-white/30 bg-white/10 flex items-center justify-center text-white/80 select-none"
                title={logoSafe
                  ? `Add clan logo at /public/clans/${logoSafe}.png or /public/${logoLower}.png`
                  : 'Add clan logo at /public/clan-logo.png'}
              >
                🛡️
              </div>
            </div>
            <div className="text-center sm:text-left">
              {clanName ? (
                <div className={`font-extrabold tracking-tight drop-shadow-lg leading-none transition-all duration-200 ${isScrolled ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}>
                  {clanName}
                </div>
              ) : (
                <div className="font-extrabold text-3xl sm:text-4xl drop-shadow-lg leading-none">Clash Intelligence</div>
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
        {/* Row 2 (right column): Tag input + actions (right-aligned, compact) */}
        <div className="col-[3] row-[2]">
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
          <select
            value={selectedSnapshot}
            onChange={(e) => { setSelectedSnapshot(e.target.value); if (clanTag) refreshData(); }}
            className="h-8 px-2 rounded-md border border-white/30 bg-white/10 text-white text-xs backdrop-blur-sm"
            title="Data source: live or latest snapshot"
          >
            <option className="text-black" value="live">Latest</option>
            <option className="text-black" value="latest">Snapshot</option>
          </select>
          <input
            type="text"
            value={clanTag}
            onChange={handleClanTagChange}
            placeholder="Enter clan tag (e.g., #2PR8R8V8P)"
            className="h-8 min-w-[260px] border border-white/30 bg-white/10 text-white placeholder-white/70 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20 transition-all backdrop-blur-sm"
            title="Enter a clan tag to load their roster data"
            onKeyDown={(e) => e.key === 'Enter' && handleLoadClan()}
          />
          <button
            onClick={handleLoadClan}
            className="h-8 px-3 bg-white/20 hover:bg-white/30 text-white rounded-md text-xs font-medium transition-all border border-white/30"
            title="Load clan data and switch to this clan"
          >
            Switch
          </button>
          <button
            onClick={handleSetHome}
            className="h-8 px-2 bg-blue-500/80 hover:bg-blue-500 text-white rounded-md text-xs transition-all"
            title="Set as home clan"
          >
            Set Home
          </button>
          {homeClan && (
            <button
              onClick={handleLoadHome}
              className="h-8 px-2 bg-green-500/80 hover:bg-green-500 text-white rounded-md text-xs transition-all"
              title={`Load home clan: ${homeClan}`}
            >
              Load Home
            </button>
          )}
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
  return (
    <div className={`min-h-screen w-full ${className}`}>
      {/* Header */}
      <DashboardHeader />
      
      {/* Tab Navigation (glued under header) */}
      <div className="w-full px-0 -mt-2">
        <div className="relative bg-white/90 backdrop-blur-sm rounded-b-xl border border-t-0 border-gray-200">
          {/* Thin gradient seam to visually glue to header */}
          <div className="absolute -top-2 left-0 right-0 h-2 bg-header-gradient" />
          <TabNavigation />
        </div>
      </div>
      
      {/* Main Content */}
      <main className="min-h-screen px-4 pb-6 pt-4 flex flex-col gap-6 w-full bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-sm rounded-b-2xl shadow-xl border border-t-0 border-white/20">
        <ToastHub />
        {/* Dev Status */}
        <DevStatusBadge />
        {/* Quick Actions (hide on Roster; rendered inside roster alongside filters) */}
        {useDashboardStore.getState().activeTab !== 'roster' && (
          <QuickActions />
        )}
        
        {/* Page Content */}
        {children}
      </main>
      
      {/* Footer */}
      <footer className="w-full bg-gradient-to-r from-gray-100 to-gray-200 border-t border-gray-300 mt-8">
        <div className="w-full px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Clash Intelligence Dashboard</span>
              <span className="text-gray-400">•</span>
              <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">v{process.env.NEXT_PUBLIC_APP_VERSION || '0.16.3'}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">A warfroggy project</span>
            </div>
            <div className="text-xs text-gray-500">Built with Next.js • Clash of Clans API</div>
          </div>
        </div>
      </footer>
      
      {/* Modals Container */}
      <ModalsContainer />
    </div>
  );
};

export default DashboardLayout;
