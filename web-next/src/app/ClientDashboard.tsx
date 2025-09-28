"use client";

import React from 'react';
import { Roster } from '@/types';

type Props = {
  initialRoster?: Roster | null;
  initialClanTag: string;
};

// TEMPORARY: Minimal component to isolate React Error #185
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  console.log('[ClientDashboard] MINIMAL VERSION - NO STORE USAGE');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Clash Intelligence Dashboard - MINIMAL TEST</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Status:</strong> MINIMAL COMPONENT - NO STORE USAGE</p>
          </div>
        </div>
      </div>
    </div>
  );
}