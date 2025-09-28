"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { DashboardLayout, RosterTable, ApplicantsPanel } from '@/components';
import ChangeDashboard from '@/components/ChangeDashboard';
import PlayerDatabase from '@/components/PlayerDatabase';
import CoachingInsights from '@/components/CoachingInsights';
import DiscordPublisher from '@/components/DiscordPublisher';
import SnapshotInfoBanner from '@/components/SnapshotInfoBanner';
import { AuthGate } from '@/components/layout/AuthGuard';
import type { Roster } from '@/types';
import { useLeadership } from '@/hooks/useLeadership';
import { getVisibleTabs } from '@/lib/tab-config';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const {
    activeTab,
    loadRoster,
    loadSmartInsights,
    homeClan,
    clanTag,
    roster,
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

  // Add global error handler for date formatting errors (without roster dependency)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Format string contains an unescaped latin alphabet character')) {
        console.error('=== DATE FORMATTING ERROR CAUGHT ===');
        console.error('Error message:', event.message);
        console.error('Error filename:', event.filename);
        console.error('Error line:', event.lineno);
        console.error('Error column:', event.colno);
        console.error('Stack trace:', event.error?.stack);
        console.error('=====================================');
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []); // No dependencies - only run once on mount

  // Hydrate store on first mount only
  useEffect(() => {
    if (hasInitialized.current) {
      return; // Already initialized, don't run again
    }
    
    console.log('[ClientDashboard] useEffect running with (FIXED VERSION):', {
      initialClanTag,
      initialRoster: !!initialRoster,
      initialRosterMembers: initialRoster?.members?.length,
      currentClanTag: clanTag,
      currentHomeClan: homeClan,
      currentRoster: !!roster
    });
    
    hasInitialized.current = true;
    
    if (initialClanTag) {
      setHomeClan(initialClanTag);
      if (!clanTag) setClanTag(initialClanTag);
    }
    
    let had = false;
    try {
      had = hydrateRosterFromCache();
      console.log('[ClientDashboard] Cache hydration result:', had);
    } catch (error) {
      console.error('[ClientDashboard] Cache hydration error:', error);
    }
    
    // Re-enabled: setRoster and loadRoster calls after fixing DashboardLayout useEffect
    if (initialRoster) {
      console.log('[ClientDashboard] Setting initial roster from server');
      setRoster(initialRoster);
    } else if (!had) {
      // Only load from API if we don't have cached data and no initial roster
      const tag = clanTag || initialClanTag || homeClan || '';
      console.log('[ClientDashboard] Checking load conditions:', { had, tag, hasRoster: !!roster });
      if (tag && !roster) {
        console.log('[ClientDashboard] Loading roster for tag:', tag);
        loadRoster(tag);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  const currentClanTag = clanTag || homeClan || initialClanTag || '';

  useEffect(() => {
    if (!currentClanTag) return;
    loadSmartInsights(currentClanTag);
  }, [currentClanTag, loadSmartInsights]);

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
        return <CoachingInsights clanData={roster} clanTag={currentClanTag} />;
      case 'applicants':
        return <ApplicantsPanel defaultClanTag={currentClanTag} />;
      case 'discord':
        return <DiscordPublisher clanData={roster} clanTag={currentClanTag} />;
      default:
        return <RosterTable />;
    }
  };

  return (
    // TEMPORARILY DISABLED: AuthGate might still be causing React Error #185
    // <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    // </AuthGate>
  );
}
