"use client";

import React, { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { DashboardLayout, RosterTable, ApplicantsPanel } from '@/components';
import ChangeDashboard from '@/components/ChangeDashboard';
import PlayerDatabase from '@/components/PlayerDatabase';
import CoachingInsights from '@/components/CoachingInsights';
import DiscordPublisher from '@/components/DiscordPublisher';
import SnapshotInfoBanner from '@/components/SnapshotInfoBanner';
import { AuthGate } from '@/components/layout/AuthGuard';
import type { Roster } from '@/types';

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

  useEffect(() => {
    if (!currentClanTag) return;
    loadSmartInsights(currentClanTag);
  }, [currentClanTag, loadSmartInsights]);

  const renderTabContent = () => {
    switch (activeTab) {
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

  // TEMPORARY: Minimal version to debug SSR issues
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Clash Intelligence Dashboard</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Clan Tag:</strong> {clanTag || 'Not set'}</p>
            <p><strong>Home Clan:</strong> {homeClan || 'Not set'}</p>
            <p><strong>Initial Clan Tag:</strong> {initialClanTag}</p>
            <p><strong>Has Roster:</strong> {roster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {roster?.members?.length || 0}</p>
            <p><strong>Active Tab:</strong> {activeTab}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
