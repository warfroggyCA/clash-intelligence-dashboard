"use client";

import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';
import { AuthGate } from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { RosterTable } from '@/components/roster/RosterTable';
import { RosterSummary } from '@/components/roster/RosterSummary';
import { InsightsDashboard } from '@/components/insights/InsightsDashboard';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (typeof window !== 'undefined') {
    console.log(`[RenderTrace] ClientDashboard#${renderCount.current}`);
  }
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
  } = useDashboardStore();
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
    console.log('[ClientDashboard] EXPERT CODER INITIALIZATION:', {
      initialClanTag,
      initialRoster: !!initialRoster,
      initialRosterMembers: initialRoster?.members?.length,
    });
    hasInitialized.current = true;
    if (initialClanTag && !clanTag) {
      setClanTag(initialClanTag);
    }
    if (initialRoster) {
      console.log('[ClientDashboard] Setting initial roster from server');
      setRoster(initialRoster);
    }
  }, []);

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
      console.log('[ClientDashboard] Auto-loading roster for:', currentClanTag);
      loadRoster(currentClanTag);
    }
  }, [initialRoster, initialClanTag, clanTag, homeClan, roster, status, loadRoster]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'roster':
        return (
          <div className="space-y-6">
            <RosterSummary />
            <RosterTable />
          </div>
        );
      
      case 'changes':
        return <div>Changes Dashboard Component</div>;
      
      case 'database':
        return <div>Player Database Component</div>;
      
      case 'coaching':
        return <InsightsDashboard />;
      
      case 'events':
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Events Dashboard</h3>
            <p className="text-gray-600">Event tracking and analytics coming soon...</p>
          </div>
        );
      
      case 'applicants':
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Applicant Evaluation</h3>
            <p className="text-gray-600">Applicant evaluation system coming soon...</p>
          </div>
        );
      
      case 'intelligence':
        return <div>Player DNA Dashboard Component</div>;
      
      case 'discord':
        return <div>Discord Publisher Component</div>;
      
      default:
        return <div>Roster Table Component</div>;
    }
  };

  return (
    <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    </AuthGate>
  );
}
