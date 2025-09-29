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

export default function ClientDashboard({ initialRoster, initialClanTag }: Props) {
  const {
    activeTab,
    homeClan,
    clanTag,
    setClanTag,
    setHomeClan,
    setRoster,
  } = useDashboardStore();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Client-side error caught:', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    console.log('[ClientDashboard] EXPERT CODER INITIALIZATION:', {
      initialClanTag,
      initialRoster: !!initialRoster,
      initialRosterMembers: initialRoster?.members?.length,
    });
    hasInitialized.current = true;
    if (initialClanTag && !clanTag) {
      setClanTag(initialClanTag);
    }
    if (initialRoster) {
      console.log('[ClientDashboard] Setting initial roster from server');
      setRoster(initialRoster);
    }
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'roster':
        return <div>Roster Table Component</div>;
      
      case 'changes':
        return <div>Changes Dashboard Component</div>;
      
      case 'database':
        return <div>Player Database Component</div>;
      
      case 'coaching':
        return <div>Coaching Insights Component</div>;
      
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
        return <div>Player DNA Dashboard Component</div>;
      
      case 'discord':
        return <div>Discord Publisher Component</div>;
      
      default:
        return <div>Roster Table Component</div>;
    }
  };

  return (
    <AuthGate>
      <DashboardLayout>{renderTabContent()}</DashboardLayout>
    </AuthGate>
  );
}