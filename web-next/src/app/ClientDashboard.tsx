"use client";

import React from 'react';
import { Roster } from '@/types';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// ULTIMATE TEST: NO ZUSTAND STORE USAGE AT ALL
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  console.log('[ClientDashboard] NO STORE USAGE - ULTIMATE TEST:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
  });
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Clash Intelligence Dashboard - NO STORE TEST</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Status:</strong> NO ZUSTAND STORE USAGE - ULTIMATE TEST</p>
            <p><strong>Components:</strong> ALL DISABLED</p>
            <p><strong>Store:</strong> COMPLETELY DISABLED</p>
          </div>
        </div>
      </div>
    </div>
  );
}