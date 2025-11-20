"use client";

import React, { useEffect, useCallback, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ComponentWithChildren } from '@/types';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import LeadershipGuard from '@/components/LeadershipGuard';
import FontSizeControl from '@/components/FontSizeControl';
import { TabNavigation } from './TabNavigation';
import { QuickActions } from './QuickActions';
import { ModalsContainer } from './ModalsContainer';
import ToastHub from './ToastHub';
import NewSnapshotIndicator from './NewSnapshotIndicator';
import { ClanSwitcher } from './ClanSwitcher';
import { getAccessLevelDisplayName, type AccessLevel } from '@/lib/access-management';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { GlassCard } from '@/components/ui';
import { AuthGate } from './AuthGuard';
import { clanRoleFromName, getRoleDisplayName } from '@/lib/leadership';
import type { ClanRoleName } from '@/lib/auth/roles';
import { supabase } from '@/lib/supabase';
import { AppShell } from './AppShell';

const VIEW_ROLE_STORAGE_KEY = 'ci:view-role:v1';


// =============================================================================
// TYPES
// =============================================================================

export interface DashboardLayoutProps extends ComponentWithChildren {
  className?: string;
  hideNavigation?: boolean;
  clanName?: string;
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface DashboardHeaderProps {
  fallbackClanName?: string;
  explicitClanName?: string;
  showClanSwitcher?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ fallbackClanName, explicitClanName, showClanSwitcher = true }) => {
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
    joinerNotifications,
    setShowJoinerManager,
    setShowAccessManager,
    setShowIngestionMonitor,
    currentAccessMember,
    accessPermissions,
  } = useDashboardStore();

  const clanName = useDashboardStore(selectors.clanName);
  const userRoles = useDashboardStore((state) => state.userRoles);
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const setImpersonatedRole = useDashboardStore((state) => state.setImpersonatedRole);
  const currentUser = useDashboardStore((state) => state.currentUser);
  const setCurrentUser = useDashboardStore((state) => state.setCurrentUser);
  const setUserRoles = useDashboardStore((state) => state.setUserRoles);
  const normalizedClanTagValue = normalizeTag(clanTag || homeClan || cfg.homeClanTag || '');
  const matchedRole = userRoles.find((entry) => entry.clan_tag === normalizedClanTagValue);
  const actualRoleName: ClanRoleName = matchedRole?.role || 'viewer';
  const viewingRoleName: ClanRoleName = impersonatedRole || actualRoleName;
  const hasLeadershipRole = userRoles.some(
    (entry) => entry.clan_tag === normalizedClanTagValue && (entry.role === 'leader' || entry.role === 'coleader')
  );
  const canShowRoleMenu = hasLeadershipRole;
  const router = useRouter();
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
  const showAccessLevelBadge = accessLevelLabel !== actualRoleLabel;
  const userDisplayName = currentUser?.name || currentUser?.email || 'Leadership';
  const userSecondary = currentUser?.email && currentUser?.name ? currentUser.email : null;
  const userInitials = (currentUser?.name || currentUser?.email || '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();


  // Shrink-on-scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  const SCROLL_ACTIVATE_THRESHOLD = 64;
  const SCROLL_DEACTIVATE_THRESHOLD = 24;
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const restoredViewRoleClanRef = useRef<string | null>(null);

  const updateHeaderMetrics = useCallback((height: number) => {
    if (typeof document === 'undefined') return;
    const roundedHeight = Math.ceil(height);
    document.documentElement.style.setProperty('--header-height', `${roundedHeight}px`);
    document.documentElement.style.setProperty('--toolbar-offset', `calc(${roundedHeight}px - 1px)`);
    document.documentElement.style.setProperty('--command-rail-top', `calc(${roundedHeight}px + 320px)`);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      setIsScrolled((prev) => {
        const currentY = window.scrollY;
        if (prev) {
          return currentY > SCROLL_DEACTIVATE_THRESHOLD;
        }
        return currentY >= SCROLL_ACTIVATE_THRESHOLD;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = headerRef.current;
    if (!node) return;

    const measure = () => updateHeaderMetrics(node.offsetHeight);
    measure();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateHeaderMetrics(entry.contentRect.height);
    });

    observer.observe(node);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [updateHeaderMetrics]);

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

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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

  // Expert Coder Fix: REMOVED these two useEffect hooks that were causing infinite loops
  // The corrupted clan tag cleanup and home clan normalization are now handled in initialization
  // instead of on every render to prevent React Error #185

  // Auto-load home clan if no clan is currently loaded and home clan exists (debug gateable)
  const hasAttemptedHomeLoad = useRef(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTO_LOAD_HOME === 'true') {
      if (process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true') {
        // eslint-disable-next-line no-console
        console.log('[DashboardLayout] auto-load home disabled');
      }
      return;
    }
    if (typeof window === 'undefined') return;

    if (clanTag) {
      hasAttemptedHomeLoad.current = true;
      return;
    }

    if (!hasAttemptedHomeLoad.current && homeClan) {
      hasAttemptedHomeLoad.current = true;
      handleLoadHome();
    }
  }, [clanTag, homeClan, handleLoadHome]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const logoutResponse = await fetch('/api/logout', {
        method: 'POST',
        cache: 'no-store',
      });

      if (!logoutResponse.ok) {
        const message = await logoutResponse.text().catch(() => '');
        throw new Error(message || 'Failed to terminate session');
      }

      if (supabase) {
        await supabase.auth.signOut().catch(() => {
          // Ignore local errors; server session already cleared
        });
      }
    } catch (error) {
      console.error('[DashboardLayout] Failed to sign out', error);
      setMessage('Failed to sign out. Please try again.');
      setIsSigningOut(false);
      return;
    }

    setCurrentUser(null);
    setUserRoles([]);
    setImpersonatedRole(null);
    setUserMenuOpen(false);
    setIsSigningOut(false);
    router.push('/login');
  }, [isSigningOut, router, setCurrentUser, setUserRoles, setImpersonatedRole, setMessage]);

  const handleRefresh = async () => {
    console.log('[DashboardLayout] Refresh button clicked');
    // Try the global refresh function first (for SimpleRoster)
    if ((window as any).refreshRosterData) {
      console.log('[DashboardLayout] Calling global refreshRosterData');
      (window as any).refreshRosterData();
    } else if (clanTag) {
      console.log('[DashboardLayout] Falling back to Zustand refreshData');
      await refreshData();
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalizedClanTag = normalizedClanTagValue;
    if (!normalizedClanTag) return;

    if (impersonatedRole) {
      restoredViewRoleClanRef.current = normalizedClanTag;
      return;
    }

    if (restoredViewRoleClanRef.current === normalizedClanTag) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(VIEW_ROLE_STORAGE_KEY);
      if (!raw) {
        restoredViewRoleClanRef.current = normalizedClanTag;
        return;
      }
      const stored = JSON.parse(raw) as Record<string, ClanRoleName | null>;
      const savedRole = stored?.[normalizedClanTag];
      if (savedRole) {
        setImpersonatedRole(savedRole);
      }
      restoredViewRoleClanRef.current = normalizedClanTag;
    } catch (error) {
      console.warn('[DashboardLayout] Failed to restore view-as role', error);
      restoredViewRoleClanRef.current = normalizedClanTag;
    }
  }, [impersonatedRole, normalizedClanTagValue, setImpersonatedRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalizedClanTag = normalizedClanTagValue;
    if (!normalizedClanTag) return;

    try {
      const raw = window.localStorage.getItem(VIEW_ROLE_STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as Record<string, ClanRoleName | null>) : {};
      if (impersonatedRole) {
        if (stored[normalizedClanTag] === impersonatedRole) {
          return;
        }
        stored[normalizedClanTag] = impersonatedRole;
      } else if (stored[normalizedClanTag]) {
        delete stored[normalizedClanTag];
      } else {
        return;
      }
      window.localStorage.setItem(VIEW_ROLE_STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.warn('[DashboardLayout] Failed to persist view-as role', error);
    }
  }, [impersonatedRole, normalizedClanTagValue]);

  // Simplified logo loading - use the known working logo
  const logoSrc = '/clans/2pr8r8v8p.png';
  const headerTitle =
    (explicitClanName && explicitClanName.trim().length > 0 ? explicitClanName.trim() : '') ||
    (clanName && clanName.trim().length > 0 ? clanName.trim() : '') ||
    (fallbackClanName && fallbackClanName.trim().length > 0 ? fallbackClanName.trim() : '') ||
    'Clash Intelligence';

  return (
    <header
      ref={headerRef}
      className="w-full sticky top-0 z-50 header-hero text-white shadow-lg/70 supports-[backdrop-filter]:backdrop-blur"
    >
      <div className={`relative z-10 w-full px-4 lg:px-6 ${isScrolled ? 'py-3' : 'py-6'}`}>
        <div className="grid gap-4 sm:grid-cols-[auto,1fr,auto] sm:items-center">
          <div className="flex flex-col gap-1 text-left">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Clash Intelligence</p>
            <span className="text-sm font-semibold text-slate-200">Dashboard</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center justify-center gap-3">
              <Link href="/app" className="relative flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14 hover:opacity-80 transition-opacity cursor-pointer" title="Go to Roster">
                <Image
                  src={logoSrc}
                  alt="Clan Logo"
                  fill
                  sizes="(max-width: 640px) 3rem, 3rem"
                  className="rounded-3xl object-cover"
                  priority
                />
              </Link>
              <Link
                href="/app"
                className={`font-semibold leading-tight text-slate-100 transition-all duration-200 hover:text-white hover:scale-105 cursor-pointer ${isScrolled ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
                style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }}
                title="Go to Roster"
              >
                {headerTitle}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
            {showAccessLevelBadge && (
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                <span className="h-2 w-2 rounded-full bg-brand-primary" />
                Access: {accessLevelLabel}
              </span>
            )}

            <div className={`inline-flex items-center gap-2 rounded-full border border-brand-border/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${actualRoleName === 'leader'
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

            {canShowRoleMenu && (
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
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${viewingRoleName === (option.value ?? actualRoleName)
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

            {/* Clan Switcher */}
            {showClanSwitcher && <ClanSwitcher />}

            {/* New snapshot indicator (manual refresh) */}
            <NewSnapshotIndicator />

            {currentUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-3 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-brand-surfaceRaised"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surfaceSubtle text-sm font-semibold text-white">
                    {userInitials}
                  </span>
                  <span className="hidden sm:flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Signed in</span>
                    <span className="text-xs font-semibold text-slate-100">{userDisplayName}</span>
                    {userSecondary && <span className="text-[11px] text-slate-400">{userSecondary}</span>}
                  </span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/95 p-3 text-sm shadow-[0_18px_32px_-24px_rgba(8,15,31,0.65)]">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Account</div>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex w-full items-center justify-between rounded-xl bg-red-500/10 px-3 py-2 text-left text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Sign out
                      <span className="text-xs">{isSigningOut ? '…' : '→'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="relative group">
              <button
                className="h-8 w-8 flex items-center justify-center rounded-md border border-brand-border/70 bg-brand-surfaceRaised/80 text-slate-200 transition-colors hover:bg-brand-surfaceRaised"
                title="More options"
              >
                ⋯
              </button>
              <div
                className="actions-menu-panel absolute right-0 top-full mt-1 w-52 rounded-2xl border border-brand-border/70 p-2 text-sm shadow-[0_18px_32px_-24px_rgba(8,15,31,0.65)] opacity-0 invisible transition-all duration-200 group-hover:visible group-hover:opacity-100"
              >
                <div className="space-y-1">
                  <LeadershipGuard requiredPermission="canManageAccess" fallback={null}>
                    <button
                      onClick={() => setShowAccessManager(true)}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                    >
                      👥 Manage Access
                    </button>
                  </LeadershipGuard>
                  <button
                    onClick={() => router.push('/settings')}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => router.push('/settings#clan-management')}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    🏰 Manage Clans
                  </button>
                  <LeadershipGuard requiredPermission="canViewLeadershipFeatures" fallback={null}>
                    <button
                      onClick={() => router.push('/player-database')}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                    >
                      🗄️ Player Database
                    </button>
                  </LeadershipGuard>
                  <Link
                    href="/faq"
                    className="block rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                  >
                    ❓ FAQ
                  </Link>
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
                    {joinerNotifications > 0 && (
                      <button
                        onClick={() => setShowJoinerManager(true)}
                        className="relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-brand-surfaceSubtle"
                      >
                        🎯 New Joiners
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                          {joinerNotifications}
                        </span>
                      </button>
                    )}
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
  hideNavigation = false,
  clanName: propClanName,
}) => {
  const fallbackClanTag = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag || '');
  const fallbackClanName = propClanName && propClanName.trim().length > 0 ? propClanName.trim() : '';
  const roster = useDashboardStore((state) => state.roster);

  const disableTabNavigation = process.env.NEXT_PUBLIC_DISABLE_TAB_NAV === 'true';
  const enableAppShell = process.env.NEXT_PUBLIC_ENABLE_APP_SHELL === 'true';

  const toolbarContent = hideNavigation
    ? null
    : (
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <QuickActions className="w-full" />
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/70 bg-slate-900/90">
          {disableTabNavigation ? (
            <div className="px-2 text-xs text-slate-400">Tabs disabled</div>
          ) : (
            <TabNavigation className="px-1.5 sm:px-2" />
          )}
        </div>
      </div>
    );

  const footerContent = (
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
            <span className="text-gray-400">a warfroggy project</span>
          </div>
        </div>
      </div>
    </footer>
  );

  const mainContent = (
    <div className="space-y-6">
      {children}
    </div>
  );
  const sidebarClanSnapshot = roster?.snapshotMetadata;
  const sidebarClanName = roster?.clanName || fallbackClanName || 'Your Clan';
  const sidebarClanTag = roster?.clanTag || fallbackClanTag || '';
  const sidebarMemberCount =
    roster?.members?.length ??
    roster?.meta?.memberCount ??
    sidebarClanSnapshot?.memberCount ??
    undefined;
  const sidebarHeaderContent = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-clash-gold to-clash-orange text-slate-950 font-semibold flex items-center justify-center">
          {sidebarClanName
            .split(/\s+/)
            .map((word) => word.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">{sidebarClanName}</span>
          <span className="text-xs font-mono text-slate-300">{sidebarClanTag}</span>
        </div>
      </div>
      {typeof sidebarMemberCount === 'number' && sidebarMemberCount > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Members</span>
          <span className="font-mono text-white">{sidebarMemberCount}</span>
        </div>
      )}
      <ClanSwitcher />
    </div>
  );

  if (enableAppShell) {
    return (
      <AuthGate>
        <AppShell
          headerContent={<DashboardHeader fallbackClanName={fallbackClanName} explicitClanName={propClanName} showClanSwitcher={false} />}
          toolbarContent={toolbarContent}
          sidebarHeader={sidebarHeaderContent}
        >
          <>
            {mainContent}
            {footerContent}
          </>
        </AppShell>
        <ModalsContainer />
        <ToastHub />
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className={`min-h-screen w-full ${className}`} style={{ overflowX: 'hidden' }}>
        {/* Skip to main content link */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-xl focus:font-semibold"
        >
          Skip to main content
        </a>

        {/* Header */}
        <DashboardHeader fallbackClanName={fallbackClanName} explicitClanName={propClanName} />

        {/* Quick Actions & Tabs Toolbar */}
        {toolbarContent && (
          <div className="sticky top-[var(--toolbar-offset,var(--header-height,96px))] z-40 w-full bg-slate-950/98 backdrop-blur px-2 pb-1.5 pt-1.5 sm:px-4 sm:pb-2 sm:pt-2">
            {toolbarContent}
          </div>
        )}

        {/* Main Content */}
        <main id="main-content" role="main" tabIndex={-1} className="dashboard-main w-full rounded-b-3xl border border-t-0 border-clash-gold/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-3 pb-6 pt-6 text-high-contrast sm:px-4 flex flex-col shadow-[0_24px_55px_-30px_rgba(0,0,0,0.3)]">
          {mainContent}
        </main>

        {/* Footer */}
        {footerContent}

        {/* Modals Container */}
        <ModalsContainer />
        <ToastHub />
      </div>
    </AuthGate>
  );
};

export default DashboardLayout;
