"use client";

import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// STEP 2: Test setRoster operation specifically
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const { roster, setRoster } = useDashboardStore((state) => ({
    roster: state.roster,
    setRoster: state.setRoster,
  }));
  const hasInitialized = useRef(false);

  console.log('[ClientDashboard] STEP 2 - TEST SETROSTER:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
    storeRoster: !!roster,
  });

  // STEP 2: Test setRoster operation with guard
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    
    console.log('[ClientDashboard] STEP 2 - TESTING SETROSTER OPERATION');
    hasInitialized.current = true;
    
    // Test setRoster operation with initial data
    if (initialRoster) {
      console.log('[ClientDashboard] STEP 2 - CALLING SETROSTER');
      setRoster(initialRoster);
      console.log('[ClientDashboard] STEP 2 - SETROSTER CALLED');
    }
  }, [initialRoster, setRoster]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Clash Intelligence Dashboard - STEP 2: TEST SETROSTER</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Store Roster:</strong> {roster ? 'Yes' : 'No'}</p>
            <p><strong>Status:</strong> STEP 2 - TESTING SETROSTER OPERATION</p>
            <p><strong>Components:</strong> ALL DISABLED</p>
            <p><strong>Store Operations:</strong> SETROSTER ONLY</p>
          </div>
        </div>
      </div>
    </div>
  );
}