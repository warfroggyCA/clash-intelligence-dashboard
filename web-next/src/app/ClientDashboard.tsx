"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useLeadership } from '@/lib/hooks/useLeadership';
import { getVisibleTabs } from '@/lib/utils';
import { Roster } from '@/types';
import AuthGate from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { SnapshotInfoBanner } from '@/components/roster/SnapshotInfoBanner';
import { RosterTable } from '@/components/roster/RosterTable';
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
  const { permissions, check } = useLeadership();
  const hasInitialized = useRef(false);

  const visibleTabs = useMemo(
    () => getVisibleTabs({ permissions, check }),
    [permissions, check]
  );

  const safeActiveTab = useMemo(() => {
    if (visibleTabs.length === 0) {
      return 'roster' as const;
    }
    return visibleTabs.some((tab) => tab.id === activeTab)
      ? activeTab
      : visibleTabs[0].id;
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    if (safeActiveTab !== activeTab) {
      setActiveTab(safeActiveTab);
    }
  }, [safeActiveTab, activeTab, setActiveTab]);

  // MINIMAL INITIALIZATION - NO COMPLEX LOGIC
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    
    console.log('[ClientDashboard] MINIMAL INITIALIZATION:', {
      initialClanTag,
      initialRoster: !!initialRoster,
      initialRosterMembers: initialRoster?.members?.length,
    });
    
    hasInitialized.current = true;
    
    // Only set basic values, no complex operations
    if (initialClanTag) {
      setHomeClan(initialClanTag);
      if (!clanTag) setClanTag(initialClanTag);
    }
    
    // Only set roster if we have it, no cache operations
    if (initialRoster) {
      console.log('[ClientDashboard] Setting initial roster from server');
      setRoster(initialRoster);
    }
  }, []); // Empty dependency array

  const currentClanTag = clanTag || homeClan || initialClanTag || '';

  const renderTabContent = () => {
    switch (safeActiveTab) {
      case 'roster':
        return (
          <div className="space-y-6">
            <SnapshotInfoBanner />
            <RosterTable />
          </div>
        );
      case 'changes':
        return <ChangeDashboard clanTag={currentClanTag} />;
      case 'database':
        return <PlayerDatabase />;
      case 'coaching':
        return <CoachingInsights clanData={initialRoster} clanTag={currentClanTag} />;
      case 'applicants':
        return <ApplicantsPanel defaultClanTag={currentClanTag} />;
      case 'discord':
        return <DiscordPublisher clanData={initialRoster} clanTag={currentClanTag} />;
      default:
        return <RosterTable />;
    }
  };

  return (
    <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    </AuthGate>
  );
}