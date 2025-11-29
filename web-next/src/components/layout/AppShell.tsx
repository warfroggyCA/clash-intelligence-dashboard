
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
    <>
      <div className={cn(
        "flex items-center py-4 transition-all",
        isMobile ? "justify-between px-4" : (collapsed ? "justify-center px-0" : "justify-between px-4")
      )}>
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

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 p-1 text-xs text-white/70 transition hover:bg-white/10"
            aria-label="Close navigation"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {sidebarHeader && (
        <div className={cn('px-3 transition-opacity', !isMobile && collapsed && 'opacity-0 pointer-events-none')}>
          {sidebarHeader}
        </div>
      )}

      <div className="mt-4 flex-1 px-2">
        <SidebarNavigation items={navItems} onNavigate={isMobile ? handleMobileLinkClick : undefined} collapsed={!isMobile && collapsed} />
      </div>

      {sidebarFooter && (
        <div className={cn('px-3 py-4', !isMobile && collapsed && 'hidden')} aria-label="Sidebar footer">
          {sidebarFooter}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex relative">
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-blue-600 focus:px-6 focus:py-3 focus:font-semibold focus:text-white"
      >
        {skipLinkLabel}
      </a>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex h-screen flex-col border-r border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/90 shadow-[8px_0_32px_rgba(2,6,23,0.8)] transition-all duration-300 sticky top-0 relative',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />

        {/* Desktop Toggle Button - Absolute Positioned */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow-md transition-colors hover:bg-slate-800 hover:text-white"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950 shadow-2xl transition-transform">
            <SidebarContent isMobile={true} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col w-full">
        {headerContent && (
          <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/85 backdrop-blur">
            <div className="flex items-center w-full">
              {/* Mobile Menu Trigger */}
              <div className="md:hidden pl-4 py-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
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
          <div className="border-b border-white/5 bg-slate-950/90 px-4 py-3 sm:px-6">{toolbarContent}</div>
        )}

        <main
          id={mainId}
          className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-3 py-6 sm:px-6"
          tabIndex={-1}
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
