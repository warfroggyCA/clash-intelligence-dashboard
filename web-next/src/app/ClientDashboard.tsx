"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';
import { AuthGate } from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { RosterTable } from '@/components/roster/RosterTable';
import dynamic from 'next/dynamic';
const RosterSummary = dynamic(() => import('@/components/roster/RosterSummary').then(m => m.RosterSummary), { ssr: false });
import { InsightsDashboard } from '@/components/insights/InsightsDashboard';
import CommandCenter from '@/components/CommandCenter';
import ApplicantsPanel from '@/components/ApplicantsPanel';
import PlayerDatabase from '@/components/PlayerDatabase';
import ReturningPlayerReview from '@/components/returning/ReturningPlayerReview';
import { selectors } from '@/lib/stores/dashboard-store';

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
  const {
    activeTab,
    homeClan,
    clanTag,
    setClanTag,
    setHomeClan,
    setRoster,
    loadRoster,
    roster,
    status,
    refreshData,
  } = useDashboardStore();
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const hasInitialized = useRef(false);

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

  // Date-aware soft refresh policy (debug gateable)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_SOFT_REFRESH === 'true') {
      if (process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true') {
        // eslint-disable-next-line no-console
        console.log('[ClientDashboard] soft refresh disabled by flag');
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
  }, [roster, dataAgeHours, clanTag, homeClan, initialClanTag, refreshData]);

  const renderTabContent = () => {
    const disableRosterSummary = process.env.NEXT_PUBLIC_DISABLE_ROSTER_SUMMARY === 'true';
    const disableRosterTable = process.env.NEXT_PUBLIC_DISABLE_ROSTER_TABLE === 'true';
    switch (activeTab) {
      case 'roster':
        return (
          <div className="space-y-6">
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
        return <PlayerDatabase currentClanMembers={roster?.members?.map(m => m.tag) || []} />;
      
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
