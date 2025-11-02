"use client";

import React from 'react';
import RootErrorBoundary from '@/components/layout/RootErrorBoundary';
// DEPRECATED: This file has been retired. Main route now uses SimpleRosterPage.
// All imports and logic below are kept for reference only.
// import ClientDashboard from '@/app/ClientDashboard';
// import ShadowRootPortal from '@/components/ShadowRootPortal';
import type { Roster } from '@/types';

// DEPRECATED: This component is no longer used. Kept for reference only.
export default function ClientAppShell({ initialRoster, initialClanTag }: { initialRoster: Roster | null; initialClanTag: string }) {
  // All logic commented out - this component just returns a placeholder
  // const disablePortal = process.env.NEXT_PUBLIC_DISABLE_SHADOW_PORTAL === 'true';
  // const disableClientDashboard = process.env.NEXT_PUBLIC_DISABLE_CLIENT_DASHBOARD === 'true';
  // const debug = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true';
  // const [mounted, setMounted] = useState(false);

  // Auto-refresh removed (indicator-based approach used instead)

  // DEPRECATED: This component has been retired. Returning placeholder.
  return (
    <RootErrorBoundary>
      <div data-client-shell-placeholder suppressHydrationWarning>
        {/* DEPRECATED: ClientDashboard has been removed. This file is kept for reference only. */}
      </div>
      {/* DEPRECATED CODE - KEPT FOR REFERENCE:
      {!mounted || disableClientDashboard ? (
        <div data-client-shell-placeholder suppressHydrationWarning />
      ) : disablePortal ? (
        <ClientDashboard initialRoster={initialRoster ?? null} initialClanTag={initialClanTag} />
      ) : (
        <ShadowRootPortal>
          <ClientDashboard initialRoster={initialRoster ?? null} initialClanTag={initialClanTag} />
        </ShadowRootPortal>
      )}
      */}
    </RootErrorBoundary>
  );
}
