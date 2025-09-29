"use client";

import React from 'react';
// No imports at all - testing if the issue is in the component rendering logic itself

type Props = {
  initialRoster?: any | null;
  initialClanTag: string;
};

// TEST 10: Minimal component with no logic at all
export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  console.log('[ClientDashboard] TEST 10 - MINIMAL COMPONENT:', {
    initialClanTag,
    initialRoster: !!initialRoster,
    initialRosterMembers: initialRoster?.members?.length,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">TEST 10: MINIMAL COMPONENT</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">MINIMAL COMPONENT TEST</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Initial Clan Tag:</strong> {initialClanTag || 'Not set'}</p>
            <p><strong>Has Initial Roster:</strong> {initialRoster ? 'Yes' : 'No'}</p>
            <p><strong>Roster Members:</strong> {initialRoster?.members?.length || 0}</p>
            <p><strong>Status:</strong> TEST 10 - MINIMAL COMPONENT (no logic, no imports)</p>
            <p><strong>Components:</strong> NONE</p>
            <p><strong>Store Operations:</strong> NONE</p>
            <p><strong>Imports:</strong> NONE</p>
            <p><strong>Logic:</strong> NONE</p>
          </div>
        </div>
      </div>
    </div>
  );
}