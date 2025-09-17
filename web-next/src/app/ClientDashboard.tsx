"use client";

import React, { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { DashboardLayout, RosterTable, ApplicantsPanel } from '@/components';
import ClanAnalytics from '@/components/ClanAnalytics';
import ChangeDashboard from '@/components/ChangeDashboard';
import FullSnapshotDashboard from '@/components/FullSnapshotDashboard';
import PlayerDatabase from '@/components/PlayerDatabase';
import CoachingInsights from '@/components/CoachingInsights';
import PlayerDNADashboard from '@/components/PlayerDNADashboard';
import DiscordPublisher from '@/components/DiscordPublisher';
import SnapshotInfoBanner from '@/components/SnapshotInfoBanner';
import SnapshotDetailsPanel from '@/components/SnapshotDetailsPanel';
import type { Roster } from '@/types';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const {
    activeTab,
    loadRoster,
    homeClan,
    clanTag,
    roster,
    setClanTag,
    setHomeClan,
    setRoster,
    hydrateRosterFromCache,
  } = useDashboardStore();

  // Debug: Log roster changes and add global error handler
  useEffect(() => {
    console.log('[ClientDashboard] Roster changed:', {
      hasRoster: !!roster,
      memberCount: roster?.members?.length,
      clanTag: roster?.clanTag
    });

    // Add global error handler for date formatting errors
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Format string contains an unescaped latin alphabet character')) {
        console.error('=== DATE FORMATTING ERROR CAUGHT ===');
        console.error('Error message:', event.message);
        console.error('Error filename:', event.filename);
        console.error('Error line:', event.lineno);
        console.error('Error column:', event.colno);
        console.error('Current roster:', roster);
        console.error('Stack trace:', event.error?.stack);
        console.error('=====================================');
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [roster]);

  // Hydrate store on first mount
  useEffect(() => {
    console.log('[ClientDashboard] useEffect running with:', {
      initialClanTag,
      initialRoster: !!initialRoster,
      initialRosterMembers: initialRoster?.members?.length,
      currentClanTag: clanTag,
      currentHomeClan: homeClan,
      currentRoster: !!roster
    });
    
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
    // Prioritize initialRoster from server-side rendering
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
  }, []);

  const currentClanTag = clanTag || homeClan || initialClanTag || '';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'roster':
        return (
          <div className="space-y-6">
            <SnapshotInfoBanner />
            <div className="space-y-6">
              <RosterTable />
              <SnapshotDetailsPanel />
            </div>
          </div>
        );
      case 'changes':
        return <ChangeDashboard clanTag={currentClanTag} />;
      case 'snapshots':
        return <FullSnapshotDashboard clanTag={currentClanTag} />;
      case 'analytics':
        return <ClanAnalytics />;
      case 'database':
        return <PlayerDatabase />;
      case 'coaching':
        return <CoachingInsights clanData={roster} clanTag={currentClanTag} />;
      case 'events':
        return (
          <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
            <div className="container mx-auto px-6 py-12">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-6 shadow-2xl">
                  <span className="text-4xl">📊</span>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">Events Dashboard</h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">Track significant player events, milestones, and clan activities with beautiful analytics</p>
              </div>
            </div>
          </div>
        );
      case 'applicants':
        return <ApplicantsPanel defaultClanTag={currentClanTag} />;
      case 'intelligence':
        return <PlayerDNADashboard members={roster?.members || []} clanTag={currentClanTag} />;
      case 'discord':
        return <DiscordPublisher clanData={roster} clanTag={currentClanTag} />;
      default:
        return <RosterTable />;
    }
  };

  return <DashboardLayout>{renderTabContent()}</DashboardLayout>;
}
