"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
// import { useLeadership } from '@/lib/hooks/useLeadership';
// import { getVisibleTabs } from '@/lib/utils';
import { Roster } from '@/types';
import { AuthGate } from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
// import { SnapshotInfoBanner } from '@/components/roster/SnapshotInfoBanner';
// import { RosterTable } from '@/components/roster/RosterTable';
import ChangeDashboard from '@/components/ChangeDashboard';
import PlayerDatabase from '@/components/PlayerDatabase';
import CoachingInsights from '@/components/CoachingInsights';
import ApplicantsPanel from '@/components/ApplicantsPanel';
import DiscordPublisher from '@/components/DiscordPublisher';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const {
    activeTab,
    homeClan,
    clanTag,
    setClanTag,
    setHomeClan,
    setRoster,
    hydrateRosterFromCache,
    setActiveTab,
  } = useDashboardStore();
  // const { permissions, check } = useLeadership();
  const hasInitialized = useRef(false);

  // const visibleTabs = useMemo(
  //   () => getVisibleTabs({ permissions, check }),
  //   [permissions, check]
  // );

  // const safeActiveTab = useMemo(() => {
  //   if (visibleTabs.length === 0) {
  //     return 'roster' as const;
  //   }
  //   return visibleTabs.some((tab) => tab.id === activeTab)
  //     ? activeTab
  //     : visibleTabs[0].id;
  // }, [visibleTabs, activeTab]);

  // useEffect(() => {
  //   if (safeActiveTab !== activeTab) {
  //     setActiveTab(safeActiveTab);
  //   }
  // }, [safeActiveTab, activeTab, setActiveTab]);

  // Expert Coder Fix: Proper initialization pattern to prevent conflicts with DashboardHeader
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
    
    // Expert Coder Fix: Only set values if they don't already exist to prevent conflicts
    if (initialClanTag && !clanTag) {
      setClanTag(initialClanTag);
    }
    
    // Don't set homeClan here - let DashboardHeader handle it to avoid conflicts
    // if (initialClanTag) {
    //   setHomeClan(initialClanTag);
    // }
    
    // Only set roster if we have it, no cache operations
    if (initialRoster) {
      console.log('[ClientDashboard] Setting initial roster from server');
      setRoster(initialRoster);
    }
  }, []); // Empty dependency array

  const currentClanTag = clanTag || homeClan || initialClanTag || '';

  const renderTabContent = () => {
    // Expert Coder Fix: COMPLETELY DISABLE all roster components to test
    return (
      <div className="space-y-6">
        <div className="text-white p-4 bg-slate-800 rounded">ALL COMPONENTS DISABLED FOR TESTING</div>
        <div className="text-white p-4 bg-slate-800 rounded">No SnapshotInfoBanner</div>
        <div className="text-white p-4 bg-slate-800 rounded">No RosterTable</div>
        <div className="text-white p-4 bg-slate-800 rounded">No ChangeDashboard</div>
        <div className="text-white p-4 bg-slate-800 rounded">No PlayerDatabase</div>
        <div className="text-white p-4 bg-slate-800 rounded">No CoachingInsights</div>
        <div className="text-white p-4 bg-slate-800 rounded">No ApplicantsPanel</div>
        <div className="text-white p-4 bg-slate-800 rounded">No DiscordPublisher</div>
      </div>
    );
  };

  return (
    <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    </AuthGate>
  );
}