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

import React, { useEffect, useCallback } from 'react';
import { ComponentWithChildren } from '@/types';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import LeadershipGuard from '@/components/LeadershipGuard';
import UserRoleSelector from '@/components/UserRoleSelector';
import FontSizeControl from '@/components/FontSizeControl';
import { TabNavigation } from './TabNavigation';
import { QuickActions } from './QuickActions';
import { ModalsContainer } from './ModalsContainer';
import DevStatusBadge from './DevStatusBadge';
import { sanitizeInputTag, normalizeTag, isValidTag } from '@/lib/tags';

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
    checkDepartureNotifications,
  } = useDashboardStore();

  const clanName = selectors.clanName(useDashboardStore.getState());
  const hasLeadershipAccess = selectors.hasLeadershipAccess(useDashboardStore.getState());

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

  return (
    <header className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex items-center overflow-hidden">
          <img 
            src="https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoic3VwZXJjZWxsXC9maWxlXC91OGFIS25ZUkpQaXlvVHh5a1Q0OC5wbmcifQ:supercell:8_pSWOLovwldaAWJu_t2Q6C91k6oc7p_mY0m9yar7G0?width=1218&format=webp&quality=100"
            alt="Clash of Clans Logo"
            className="h-32 w-auto object-contain -ml-4 -mt-2"
            onError={(e) => {
              // Fallback to emoji if image fails to load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <span className="text-4xl hidden">⚔️</span>
        </div>
        
        {/* Center - Clan Name & Input */}
        <div className="text-center flex-1 max-w-2xl">
          {clanName ? (
            <div className="font-bold text-4xl text-white drop-shadow-lg mb-2">
              {clanName}
            </div>
          ) : (
            <div className="text-center">
              <div className="font-bold text-4xl text-white drop-shadow-lg mb-2">
                Clash Intelligence Dashboard
              </div>
              <div className="text-lg text-white/80 drop-shadow-md">
                Enter a clan tag below to get started
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
            <input
              type="text"
              value={clanTag}
              onChange={handleClanTagChange}
              placeholder="Enter clan tag (e.g., #2PR8R8V8P)..."
              className="border border-white/30 bg-white/10 text-white placeholder-white/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all backdrop-blur-sm"
              title="Enter a clan tag to load their roster data"
              onKeyDown={(e) => e.key === 'Enter' && handleLoadClan()}
            />
            <button
              onClick={handleLoadClan}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/30"
              title="Load clan data and switch to this clan"
            >
              🔄 Switch Clan
            </button>
            <button
              onClick={handleSetHome}
              className="px-3 py-2 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg text-sm transition-all duration-200 hover:scale-105"
              title="Set as home clan"
            >
              🏠 Set Home
            </button>
            {homeClan && (
              <button
                onClick={handleLoadHome}
                className="px-3 py-2 bg-green-500/80 hover:bg-green-500 text-white rounded-lg text-sm transition-all duration-200 hover:scale-105"
                title={`Load home clan: ${homeClan}`}
              >
                🏡 Load Home
              </button>
            )}
          </div>
        </div>
        
        {/* Right side - App Title & Controls */}
        <div className="flex flex-col items-end space-y-2">
          <div className="text-right">
            <div className="font-bold text-xl">Clash Intelligence Dashboard</div>
            <div className="text-sm text-blue-100">Advanced Clan Analytics</div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Role Selector */}
            <UserRoleSelector
              currentRole={useDashboardStore.getState().userRole}
              onRoleChange={useDashboardStore.getState().setUserRole}
              className="hidden sm:block"
            />
            
            {/* Access Management */}
            <LeadershipGuard
              requiredPermission="canManageAccess"
              fallback={null}
            >
              <button
                onClick={() => setShowAccessManager(true)}
                className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-200 hover:scale-110"
                title="Manage clan access"
              >
                👥
              </button>
            </LeadershipGuard>
            
            {/* Font Size Control */}
            <FontSizeControl />
            
            {/* FAQ Link */}
            <a
              href="/faq"
              className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-200 hover:scale-110"
              title="View FAQ and Help Guide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-200 hover:scale-110"
              title="Refresh data from API"
            >
              🔄
            </button>
            
            {/* Departure Notifications */}
            <LeadershipGuard 
              requiredPermission="canManageChangeDashboard" 
              fallback={null}
            >
              {departureNotifications > 0 && (
                <button
                  onClick={() => setShowDepartureManager(true)}
                  className="relative p-2 hover:bg-indigo-600 rounded-lg transition-colors"
                  title="Member departure notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {departureNotifications}
                  </span>
                </button>
              )}
            </LeadershipGuard>
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
      
      {/* Tab Navigation */}
      <div className="w-full px-6 pt-6">
        <div className="relative">
          <div className="bg-white/90 backdrop-blur-sm rounded-t-xl border border-b-0 border-gray-200 shadow-xl">
            <TabNavigation />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="min-h-screen p-6 flex flex-col gap-6 w-full bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-sm rounded-b-2xl shadow-xl border border-t-0 border-white/20">
        {/* Dev Status */}
        <DevStatusBadge />
        {/* Quick Actions */}
        <QuickActions />
        
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
              <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">v0.16.3</span>
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
