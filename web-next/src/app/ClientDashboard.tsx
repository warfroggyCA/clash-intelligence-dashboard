"use client";

import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Roster } from '@/types';
import { AuthGate } from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// FINAL TEST: Full ClientDashboard with AuthGuard infinite loop fix
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const { roster, setRoster } = useDashboardStore((state) => ({
    roster: state.roster,
    setRoster: state.setRoster,
  }));
  const hasInitialized = useRef(false);

  console.log('[ClientDashboard] FINAL TEST - AUTHGUARD LOOP FIX:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
    storeRoster: !!roster,
  });

  // FINAL TEST: Full initialization with AuthGuard fix
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    
    console.log('[ClientDashboard] FINAL TEST - FULL INITIALIZATION');
    hasInitialized.current = true;
    
    // Set initial roster if available
    if (initialRoster) {
      console.log('[ClientDashboard] FINAL TEST - CALLING SETROSTER');
      setRoster(initialRoster);
      console.log('[ClientDashboard] FINAL TEST - SETROSTER CALLED');
    }
  }, [initialRoster, setRoster]);
  
  const renderTabContent = () => {
    return (
      <div className="space-y-6">
        <div className="text-white p-4 bg-slate-800 rounded">
          <h2 className="text-xl font-semibold mb-4">FINAL TEST - AUTHGUARD LOOP FIX</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Store Roster:</strong> {roster ? 'Yes' : 'No'}</p>
            <p><strong>Status:</strong> FINAL TEST - AUTHGUARD INFINITE LOOP FIXED</p>
            <p><strong>Components:</strong> AuthGate + DashboardLayout</p>
            <p><strong>Store Operations:</strong> FULL STORE USAGE</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    </AuthGate>
  );
}