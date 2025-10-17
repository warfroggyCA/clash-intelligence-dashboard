"use client";

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useDashboardStore, selectors, useShallow } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';

// Lazy-load all heavy/child components to avoid module-time side effects
const AuthGate = dynamic(() => import('@/components/layout/AuthGuard').then(m => m.AuthGate), { ssr: false });
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });
// Default export component
const RosterTable = dynamic(() => import('@/components/roster/RosterTable'), { ssr: false });
// Conditionally load RosterSummary only when not disabled
const RosterSummary = process.env.NEXT_PUBLIC_DISABLE_ROSTER_SUMMARY === 'true'
  ? () => null
  : dynamic(() => import('@/components/roster/RosterSummary'), { ssr: false });
const TournamentCard = dynamic(() => import('@/components/roster/TournamentCard'), { ssr: false });
const InsightsDashboard = dynamic(() => import('@/components/insights/InsightsDashboard').then(m => m.InsightsDashboard), { ssr: false });
const CommandCenter = dynamic(() => import('@/components/CommandCenter'), { ssr: false });
const ApplicantsPanel = dynamic(() => import('@/components/ApplicantsPanel'), { ssr: false });
const PlayerDatabase = dynamic(() => import('@/components/PlayerDatabase'), { ssr: false });
const ReturningPlayerReview = dynamic(() => import('@/components/returning/ReturningPlayerReview'), { ssr: false });

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// Split into shell + inner to avoid store reads before mount
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const debug = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true';
  const [mounted, setMounted] = useState(false);
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ClientDashboardShell] render', { mounted });
  }
  useEffect(() => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[ClientDashboardShell] effect mount');
    }
    setMounted(true);
  }, [debug]);
  if (!mounted) return <div data-dashboard-shell suppressHydrationWarning />;
  return <ClientDashboardInner initialRoster={initialRoster} initialClanTag={initialClanTag} />;
}

function ClientDashboardInner({ initialRoster, initialClanTag }: Props) {
  // Use selective subscriptions instead of destructuring to prevent unnecessary re-renders
  const activeTab = useDashboardStore((state) => state.activeTab);
  const homeClan = useDashboardStore((state) => state.homeClan);
  const clanTag = useDashboardStore((state) => state.clanTag);
  const roster = useDashboardStore(useShallow((state) => state.roster));
  const status = useDashboardStore((state) => state.status);
  
  // Actions don't change, so they're safe to destructure
  const { setClanTag, setHomeClan, setRoster, loadRoster, refreshData } = useDashboardStore();
  
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const hasInitialized = useRef(false);
  const [showSimpleBanner, setShowSimpleBanner] = useState(true);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Client-side error caught:', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;
    
    // Force set initial data regardless of current store state
    if (initialClanTag) {
      setClanTag(initialClanTag);
    }
    if (initialRoster) {
      setRoster(initialRoster);
    }
  }, [initialClanTag, initialRoster, setClanTag, setRoster]);

  // Auto-load data if we don't have initial data from server
  useEffect(() => {
    if (!hasInitialized.current) return;
    // If we have initial data from server, we're done
    if (initialRoster && initialClanTag) {
      return;
    }

    // If no initial data, try to load from store or auto-load
    const currentClanTag = clanTag || homeClan || initialClanTag;
    if (currentClanTag && !roster && status === 'idle') {
      void loadRoster(currentClanTag);
    }
  }, [initialRoster, initialClanTag, clanTag, homeClan, roster, status, loadRoster]);

  // Date-aware soft refresh policy (explicit opt-in)
  useEffect(() => {
    const softRefreshEnabled = process.env.NEXT_PUBLIC_ENABLE_SOFT_REFRESH === 'true';
    if (!softRefreshEnabled) {
      if (process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true') {
        // eslint-disable-next-line no-console
        console.log('[ClientDashboard] soft refresh disabled (enable flag not set)');
      }
      return;
    }
    if (!roster) return;
    if (typeof window === 'undefined') return;
    const key = `soft-refresh:${(clanTag || homeClan || initialClanTag || '').toUpperCase()}`;
    const maybeSoftRefresh = () => {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(key) || '0');
      const minIntervalMs = 30 * 60 * 1000; // 30 minutes
      if (typeof dataAgeHours === 'number' && dataAgeHours > 12) {
        if (!last || (now - last) > minIntervalMs) {
          void refreshData();
          sessionStorage.setItem(key, String(now));
        }
      }
    };
    // Trigger on mount (when roster available)
    maybeSoftRefresh();
    // Trigger when tab regains focus
    const onVis = () => {
      if (document.visibilityState === 'visible') maybeSoftRefresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, dataAgeHours, clanTag, homeClan, initialClanTag]); // refreshData removed to prevent infinite loop

  const renderTabContent = () => {
    const disableRosterSummary = process.env.NEXT_PUBLIC_DISABLE_ROSTER_SUMMARY === 'true';
    const disableRosterTable = process.env.NEXT_PUBLIC_DISABLE_ROSTER_TABLE === 'true';
    
    // SIMPLE VERSION BANNER
    if (showSimpleBanner && activeTab === 'roster') {
      return (
        <div>
          <div className="mb-6 bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border-2 border-emerald-500/50 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-emerald-300 mb-2">
                  ✨ New Simple Version Available
                </h3>
                <p className="text-emerald-100 mb-4">
                  Try the clean, fast, crash-free version of the roster and player pages. 
                  No complex state management. No infinite loops. Just works.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/"
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    🚀 Try Simple Roster
                  </Link>
                  <button
                    onClick={() => setShowSimpleBanner(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Original content below */}
          <div>
            {!disableRosterSummary && <RosterSummary />}
            {!disableRosterTable && <RosterTable />}
            <div className="mt-8">
              <TournamentCard />
            </div>
          </div>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'roster':
        return (
          <div className="space-y-6">
            <TournamentCard />
            {disableRosterSummary ? (
              <div className="rounded-2xl border border-brand-border/70 bg-brand-surfaceSubtle/70 p-4 text-slate-200">
                Roster Summary disabled by NEXT_PUBLIC_DISABLE_ROSTER_SUMMARY.
              </div>
            ) : (
              <RosterSummary />
            )}
            {disableRosterTable ? (
              <div className="rounded-2xl border border-brand-border/70 bg-brand-surfaceSubtle/70 p-4 text-slate-200">
                Roster Table disabled by NEXT_PUBLIC_DISABLE_ROSTER_TABLE.
              </div>
            ) : (
              <RosterTable />
            )}
          </div>
        );
      
      case 'changes':
        return <div>Changes Dashboard Component</div>;
      
      case 'database':
        return <PlayerDatabase />;
      
      case 'coaching':
        return <CommandCenter clanData={roster} clanTag={clanTag || homeClan || initialClanTag} />;
      
      case 'events':
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Events Dashboard</h3>
            <p className="text-gray-600">Event tracking and analytics coming soon...</p>
          </div>
        );
      
      case 'applicants':
        return <ApplicantsPanel defaultClanTag={clanTag || homeClan || initialClanTag} />;
      
      case 'intelligence':
        return <div>Player DNA Dashboard Component</div>;
      
      case 'discord':
        return <div>Discord Publisher Component</div>;
      
      default:
        return <div>Roster Table Component</div>;
    }
  };

  const disableAuthGuard = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD === 'true';
  const disableDashboardLayout = process.env.NEXT_PUBLIC_DISABLE_DASHBOARD_LAYOUT === 'true';

  const content = (
    <>
        {/* Returning player review modal hooks into roster + departures notifications */}
        {process.env.NEXT_PUBLIC_DISABLE_RETURNING_REVIEW === 'true' ? null : <ReturningPlayerReview />}
        {renderTabContent()}
    </>
  );

  if (disableAuthGuard && disableDashboardLayout) {
    return content;
  }
  if (disableAuthGuard && !disableDashboardLayout) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }
  if (!disableAuthGuard && disableDashboardLayout) {
    return <AuthGate>{content}</AuthGate>;
  }
  return (
    <AuthGate>
      <DashboardLayout>{content}</DashboardLayout>
    </AuthGate>
  );
}
