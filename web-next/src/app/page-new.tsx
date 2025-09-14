/**
 * Clash Intelligence Dashboard - Main Dashboard
 * 
 * A comprehensive Clash of Clans clan management dashboard featuring:
 * - Live roster data from CoC API with rate limiting
 * - Hero level tracking with TH-appropriate max levels
 * - Rush percentage calculation (peer-relative)
 * - Donation balance tracking (shows deficit when receiving more than giving)
 * - Tenure tracking with append-only ledger
 * - Player notes and custom fields
 * - AI-powered coaching and summaries
 * - Snapshot versioning for historical data
 * - Modern UI with gradients and responsive design
 * 
 * Version: 1.0.0 (New Architecture)
 * Last Updated: January 2025
 */

"use client";

import React, { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { DashboardLayout, RosterTable } from '@/components';
import ChangeDashboard from '@/components/ChangeDashboard';
import PlayerDatabase from '@/components/PlayerDatabase';
import AICoaching from '@/components/AICoaching';
import PlayerDNADashboard from '@/components/PlayerDNADashboard';
import DiscordPublisher from '@/components/DiscordPublisher';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function HomePage() {
  const { 
    activeTab, 
    loadRoster, 
    homeClan, 
    clanTag, 
    roster,
    setClanTag 
  } = useDashboardStore();

  // Initialize with home clan if available
  useEffect(() => {
    const currentTag = clanTag || homeClan;
    if (currentTag) {
      loadRoster(currentTag);
    }
  }, [clanTag, homeClan, loadRoster]);

  // Get current clan tag for components that need it
  const currentClanTag = clanTag || homeClan || '';

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'roster':
        return <RosterTable />;
      
      case 'changes':
        return <ChangeDashboard clanTag={currentClanTag} />;
      
      case 'database':
        return <PlayerDatabase />;
      
      case 'coaching':
        return (
          <AICoaching 
            clanData={roster}
            clanTag={currentClanTag}
          />
        );
      
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
        return (
          <PlayerDNADashboard 
            members={roster?.members || []}
            clanTag={currentClanTag}
          />
        );
      
      case 'discord':
        return (
          <DiscordPublisher 
            clanData={roster}
            clanTag={currentClanTag}
          />
        );
      
      default:
        return <RosterTable />;
    }
  };

  return (
    <DashboardLayout>
      {renderTabContent()}
    </DashboardLayout>
  );
}
