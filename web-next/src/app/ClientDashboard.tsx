"use client";

import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';
// import { AuthGate } from '@/components/layout/AuthGuard'; // Removed for Test 5
import DashboardLayout from '@/components/layout/DashboardLayout';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// FINAL TEST: Full ClientDashboard with AuthGuard infinite loop fix
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const roster = useDashboardStore((state) => state.roster);
  const setRoster = useDashboardStore((state) => state.setRoster);
  const setHomeClan = useDashboardStore((state) => state.setHomeClan);
  const setClanTag = useDashboardStore((state) => state.setClanTag);
  const initialized = useRef(false);

  console.log('[ClientDashboard] EXPERT CODER FIX - STABLE SELECTORS:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
    storeRoster: !!roster,
  });

  // TEST 8: Disable entire useEffect
  // useEffect(() => {
  //   if (initialized.current) return;
  //   initialized.current = true;

  //   console.log('[ClientDashboard] EXPERT CODER INITIALIZATION');
    
  //   const targetClan = initialClanTag || '2PR8R8V8P'; // Use actual home clan tag
  //   setHomeClan(targetClan);
  //   // TEST 7: Disable setClanTag call
  //   // setClanTag(targetClan);

  //   // TEST 6: Disable setRoster call
  //   // if (initialRoster) {
  //   //   console.log('[ClientDashboard] EXPERT CODER - CALLING SETROSTER');
  //   //   setRoster(initialRoster);
  //   // }
  // }, [initialClanTag, initialRoster, setHomeClan, setClanTag, setRoster]);
  
  const renderTabContent = () => {
    return (
      <div className="space-y-6">
        <div className="text-white p-4 bg-slate-800 rounded">
          <h2 className="text-xl font-semibold mb-4">EXPERT CODER COMPREHENSIVE FIX</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Store Roster:</strong> {roster ? 'Yes' : 'No'}</p>
            <p><strong>Status:</strong> TEST 8 - ENTIRE useEffect DISABLED</p>
            <p><strong>Components:</strong> AuthGate COMPLETELY REMOVED</p>
            <p><strong>Store Operations:</strong> ALL STORE OPERATIONS DISABLED (useEffect disabled)</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">TEST 5: AuthGate COMPLETELY REMOVED</h1>
        {renderTabContent()}
      </div>
    </div>
  );
}