
"use client";

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarNavigation } from './SidebarNavigation';
import { navConfig, type NavItem } from '@/lib/nav-config';

interface AppShellProps {
  children: ReactNode;
  headerContent?: ReactNode;
  toolbarContent?: ReactNode;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  navItems?: NavItem[];
  skipLinkLabel?: string;
  mainId?: string;
}

export function AppShell({
  children,
  headerContent,
  toolbarContent,
  sidebarHeader,
  sidebarFooter,
  navItems = navConfig,
  skipLinkLabel = 'Skip to main content',
  mainId = 'main-content',
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on path change
  const handleMobileLinkClick = () => {
    setMobileOpen(false);
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className={cn("flex h-full flex-col", isMobile && "overflow-hidden")}> 
      <div
        className={cn(
          "flex items-center py-4 transition-all",
          isMobile
            ? "app-shell-mobile-drawer-header justify-between px-4 shrink-0"
            : (collapsed ? "justify-center px-0" : "justify-between px-4")
        )}
      >
        <Link
          href="/app"
          className={cn(
            'font-display text-lg font-semibold uppercase text-clash-gold transition-all',
            !isMobile && collapsed ? 'tracking-widest text-xl' : 'tracking-[0.4em]'
          )}
          aria-label="Clash Intelligence home"
          onClick={isMobile ? handleMobileLinkClick : undefined}
        >
          CI
        </Link>

        {/* Mobile close button is absolutely positioned in the drawer so it never scrolls away */}
      </div>

      {sidebarHeader && (
        <div className={cn('px-3 transition-opacity', !isMobile && collapsed && 'opacity-0 pointer-events-none')}>
          {sidebarHeader}
        </div>
      )}

      <div
        className={cn(
          "mt-4 flex-1 min-h-0 px-2 overflow-y-auto overscroll-contain touch-pan-y sidebar-scrollbar",
          // On mobile we also prevent the outer drawer from scrolling; the nav itself should scroll.
          isMobile && "overflow-y-auto"
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <SidebarNavigation
          items={navItems}
          onNavigate={isMobile ? handleMobileLinkClick : undefined}
          collapsed={!isMobile && collapsed}
        />
      </div>

      {sidebarFooter && (
        <div className={cn('px-3 py-4', !isMobile && collapsed && 'hidden')} aria-label="Sidebar footer">
          {sidebarFooter}
        </div>
      )}
    </div>
  );

  return (
    <div className={cn(
      "app-shell h-dvh w-full flex relative overflow-hidden",
      mobileOpen && "overflow-hidden"
    )} data-testid="app-shell-root">
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-blue-600 focus:px-6 focus:py-3 focus:font-semibold focus:text-white"
      >
        {skipLinkLabel}
      </a>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'app-shell-sidebar hidden md:flex h-dvh flex-col transition-all duration-300 sticky top-0 relative overflow-hidden',
          collapsed ? 'w-16' : 'w-64'
        )}
        data-testid="app-shell-sidebar"
      >
        <SidebarContent />

        {/* Desktop Toggle Button (fixed so it never scrolls away; centered vertically) */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="app-shell-control fixed z-50 flex h-7 w-7 items-center justify-center rounded-full shadow-md"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            left: collapsed ? 52 : 244, // align to the sidebar's right edge (w-16 / w-64) minus half the button
          }}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="app-shell-mobile-backdrop fixed inset-0 transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="app-shell-sidebar relative h-full w-64 shadow-2xl transition-transform overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="app-shell-control absolute right-3 top-3 z-20 rounded-full p-1 text-xs transition"
              aria-label="Close navigation"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <SidebarContent isMobile={true} />
          </aside>
        </div>
      )}

      <div className="flex h-dvh min-h-0 flex-1 flex-col w-full overflow-hidden">
        {headerContent && (
          <header className="app-shell-header sticky top-0 z-30" data-testid="app-shell-header">
            <div className="flex items-center w-full">
              {/* Mobile Menu Trigger */}
              <div className="md:hidden pl-4 py-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="app-shell-control p-2 rounded-md"
                  aria-label="Open menu"
                >
                  <LayoutDashboard className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                {headerContent}
              </div>
            </div>
          </header>
        )}

        {toolbarContent && (
          <div className="app-shell-toolbar border-b px-4 py-3 sm:px-6">{toolbarContent}</div>
        )}

        <main
          id={mainId}
          className="app-shell-main flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-6 sm:px-6"
          tabIndex={-1}
          role="main"
          data-testid="app-shell-main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
