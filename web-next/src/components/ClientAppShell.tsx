"use client";

import React from 'react';
import RootErrorBoundary from '@/components/layout/RootErrorBoundary';
import ClientDashboard from '@/app/ClientDashboard';
import ShadowRootPortal from '@/components/ShadowRootPortal';
import type { Roster } from '@/types';

export default function ClientAppShell({ initialRoster, initialClanTag }: { initialRoster: Roster | null; initialClanTag: string }) {
  return (
    <RootErrorBoundary>
      <ShadowRootPortal>
        <ClientDashboard initialRoster={initialRoster ?? null} initialClanTag={initialClanTag} />
      </ShadowRootPortal>
    </RootErrorBoundary>
  );
}
