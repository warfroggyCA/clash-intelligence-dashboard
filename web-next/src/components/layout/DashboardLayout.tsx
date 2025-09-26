"use client";

import React, { useEffect, useCallback, useState, useRef } from 'react';
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
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { ThemeToggle, GlassCard } from '@/components/ui';
import { AuthGate } from './AuthGuard';
import { clanRoleFromName, getRoleDisplayName } from '@/lib/leadership';
import type { ClanRoleName } from '@/lib/auth/roles';
import CommandRail from './CommandRail';

const LoadingCard = () => (
  <GlassCard className="min-h-[18rem] animate-pulse">
    <div className="grid grid-cols-2 gap-3 text-base">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-2xl bg-white/15" />
      ))}
    </div>
  </GlassCard>
);

// TEMPORARY: Disable problematic components to fix SSR issues
const RosterStatsPanel = (props: any) => <LoadingCard {...props} />;
const RosterHighlightsPanel = dynamic(
  () => import('@/components/roster/RosterHighlightsPanel'),
  { ssr: false, loading: LoadingCard }
);
const SmartInsightsHeadlines = (props: any) => <LoadingCard {...props} />;

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardLayoutProps extends ComponentWithChildren {
  className?: string;
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface DashboardHeaderProps {
  onToggleCommandRail: () => void;
  isCommandRailOpen: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onToggleCommandRail, isCommandRailOpen }) => {
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
  const userRoles = useDashboardStore((state) => state.userRoles);
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const setImpersonatedRole = useDashboardStore((state) => state.setImpersonatedRole);
  const normalizedClanTagValue = normalizeTag(clanTag || homeClan || cfg.homeClanTag || '');
  const matchedRole = userRoles.find((entry) => entry.clan_tag === normalizedClanTagValue);
  const actualRoleName: ClanRoleName = matchedRole?.role || 'viewer';
  const viewingRoleName: ClanRoleName = impersonatedRole || actualRoleName;
  const hasLeadershipRole = userRoles.some(
    (entry) => entry.clan_tag === normalizedClanTagValue && (entry.role === 'leader' || entry.role === 'coleader')
  );
  const actualRoleLabel = getRoleDisplayName(clanRoleFromName(actualRoleName));
  const viewingRoleLabel = getRoleDisplayName(clanRoleFromName(viewingRoleName));
  const isImpersonating = Boolean(impersonatedRole);
  const inferredAccessLevel: AccessLevel = currentAccessMember?.accessLevel
    || (accessPermissions.canManageAccess
      ? 'leader'
      : accessPermissions.canAccessDiscordPublisher
        ? 'coleader'
        : 'member');
  const accessLevelLabel = getAccessLevelDisplayName(inferredAccessLevel);


  // Shrink-on-scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const targetHeight = isScrolled ? 88 : 112;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--header-height', `${targetHeight}px`);
    }
  }, [isScrolled]);

  useEffect(() => {
    if (!roleMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [roleMenuOpen]);

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
      <div className={`relative z-10 w-full px-4 lg:px-6 ${isScrolled ? 'py-3' : 'py-6'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`relative hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/80 text-brand-primary ${isScrolled ? 'shadow-none' : 'shadow-[0_16px_32px_-20px_rgba(8,15,31,0.7)]'}`}>
              <Image
                src={logoSrc}
                alt="Clan Logo"
                fill
                sizes="(max-width: 640px) 3rem, 3rem"
                className="rounded-2xl object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Clan dashboard</p>
              <div
                className={`font-semibold leading-tight text-slate-100 transition-all duration-200 ${isScrolled ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
                style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }}
              >
                {clanName || 'Clash Intelligence'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              <span className="h-2 w-2 rounded-full bg-brand-primary" />
              {accessLevelLabel}
            </span>

            <div className={`inline-flex items-center gap-2 rounded-full border border-brand-border/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
              actualRoleName === 'leader'
                ? 'text-amber-200'
                : actualRoleName === 'coleader'
                  ? 'text-indigo-200'
                  : actualRoleName === 'elder'
                    ? 'text-emerald-200'
                    : 'text-slate-200'
            }`}>
              <span className="h-2 w-2 rounded-full bg-current" />
              <span>{actualRoleLabel}</span>
            </div>

            {hasLeadershipRole && (
              <div className="relative" ref={roleMenuRef}>
                <button
                  onClick={() => setRoleMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-100 transition-colors hover:bg-brand-surfaceRaised"
                >
                  View as: {viewingRoleLabel}
                  {isImpersonating && <span className="text-[10px] uppercase text-amber-300">Impersonating</span>}
                </button>
                {roleMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/95 p-2 text-xs shadow-[0_18px_32px_-24px_rgba(8,15,31,0.65)]"
                  >
                    {[
                      { label: 'Actual role', value: null },
                      { label: 'Leader', value: 'leader' },
                      { label: 'Co-Leader', value: 'coleader' },
                      { label: 'Elder', value: 'elder' },
                      { label: 'Member', value: 'member' },
                      { label: 'Viewer', value: 'viewer' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        onClick={() => {
                          setImpersonatedRole(option.value as ClanRoleName | null);
                          setRoleMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                          viewingRoleName === (option.value ?? actualRoleName)
                            ? 'bg-brand-surfaceSubtle text-white'
                            : 'text-slate-300 hover:bg-brand-surfaceSubtle/70 hover:text-white'
                        }`}
                      >
                        <span>{option.label}</span>
                        {viewingRoleName === (option.value ?? actualRoleName) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ThemeToggle size="sm" />

            <button
              onClick={onToggleCommandRail}
              className="hidden lg:inline-flex h-9 items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:bg-brand-surfaceRaised"
            >
              {isCommandRailOpen ? 'Hide Command Rail' : 'Show Command Rail'}
              <span className={`h-2 w-2 rounded-full ${isCommandRailOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </button>

            <div className="relative group">
              <button 
                className="h-8 w-8 flex items-center justify-center rounded-md border border-brand-border/70 bg-brand-surfaceRaised/80 text-slate-200 transition-colors hover:bg-brand-surfaceRaised"
                title="More options"
              >
                ⋯
              </button>
              <div 
                className="absolute right-0 top-full mt-1 w-52 rounded-2xl border border-brand-border/70 bg-brand-surfaceRaised/95 p-2 text-sm shadow-[0_18px_32px_-24px_rgba(8,15,31,0.65)] opacity-0 invisible transition-all duration-200 group-hover:visible group-hover:opacity-100"
              >
                <div className="space-y-1">
                  <button
                    onClick={onToggleCommandRail}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    🧰 {isCommandRailOpen ? 'Hide Command Rail' : 'Show Command Rail'}
                  </button>
                  <LeadershipGuard requiredPermission="canManageAccess" fallback={null}>
                    <button
                      onClick={() => setShowAccessManager(true)}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                    >
                      👥 Manage Access
                    </button>
                  </LeadershipGuard>
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    🏰 Manage Clans
                  </button>
                  <a 
                    href="/faq" 
                    className="block rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    ❓ FAQ
                  </a>
                  <button 
                    onClick={handleRefresh}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => {
                      setShowIngestionMonitor(true);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    🧭 Ingestion Monitor
                  </button>
                  <div className="rounded-xl bg-brand-surfaceSubtle/80 px-3 py-2">
                    <FontSizeControl />
                  </div>
                  <LeadershipGuard requiredPermission="canManageChangeDashboard" fallback={null}>
                    {departureNotifications > 0 && (
                      <button
                        onClick={() => setShowDepartureManager(true)}
                        className="relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                      >
                        🔔 Departures
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
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
  const [isCommandRailOpen, setIsCommandRailOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsCommandRailOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`min-h-screen w-full ${className}`}>
      {/* Header */}
      <DashboardHeader
        onToggleCommandRail={() => setIsCommandRailOpen((prev) => !prev)}
        isCommandRailOpen={isCommandRailOpen}
      />
      
      {/* Tab Navigation (sticky under header) */}
      <div className="w-full px-0 sticky top-[calc(var(--header-height,80px)-12px)] z-40">
        <div className="border border-t-0 border-slate-800 bg-slate-900 backdrop-blur">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-900" />
            <TabNavigation />
          </div>
          <div className="h-8 border-t border-slate-800 bg-slate-900" />
        </div>
      </div>
      
      {/* Main Content */}
      <main className="dashboard-main min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-high-contrast rounded-b-3xl border border-t-0 border-clash-gold/20 px-3 pb-6 pt-4 sm:px-4 flex flex-col shadow-[0_24px_55px_-30px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="flex-1 space-y-6">
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
          </div>

          <CommandRail
            isOpen={isCommandRailOpen}
            onToggle={() => setIsCommandRailOpen((prev) => !prev)}
          />
        </div>
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
