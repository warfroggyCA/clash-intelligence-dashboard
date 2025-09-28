"use client";

import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// STEP 1: Test store usage without any operations
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const roster = useDashboardStore((state) => state.roster);
  const hasInitialized = useRef(false);

  console.log('[ClientDashboard] STEP 1 - STORE READ ONLY:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
    storeRoster: !!roster,
  });

  // STEP 1: Only read from store, no operations
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    
    console.log('[ClientDashboard] STEP 1 - READ ONLY INITIALIZATION');
    hasInitialized.current = true;
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Clash Intelligence Dashboard - STEP 1: READ ONLY</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Store Roster:</strong> {roster ? 'Yes' : 'No'}</p>
            <p><strong>Status:</strong> STEP 1 - READ ONLY STORE USAGE</p>
            <p><strong>Components:</strong> ALL DISABLED</p>
            <p><strong>Store Operations:</strong> READ ONLY</p>
          </div>
        </div>
      </div>
    </div>
  );
}