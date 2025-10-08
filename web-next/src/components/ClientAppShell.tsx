"use client";

import React, { useEffect, useState } from 'react';
import RootErrorBoundary from '@/components/layout/RootErrorBoundary';
import ClientDashboard from '@/app/ClientDashboard';
import ShadowRootPortal from '@/components/ShadowRootPortal';
import type { Roster } from '@/types';

export default function ClientAppShell({ initialRoster, initialClanTag }: { initialRoster: Roster | null; initialClanTag: string }) {
  const disablePortal = process.env.NEXT_PUBLIC_DISABLE_SHADOW_PORTAL === 'true';
  const disableClientDashboard = process.env.NEXT_PUBLIC_DISABLE_CLIENT_DASHBOARD === 'true';
  const debug = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true';

  const [mounted, setMounted] = useState(false);
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ClientAppShell] render', { mounted, disablePortal, disableClientDashboard });
  }
  useEffect(() => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[ClientAppShell] effect mount');
    }
    setMounted(true);
  }, [debug]);

  // Auto-refresh removed (indicator-based approach used instead)

  return (
    <RootErrorBoundary>
      {!mounted || disableClientDashboard ? (
        <div data-client-shell-placeholder suppressHydrationWarning />
      ) : disablePortal ? (
        <ClientDashboard initialRoster={initialRoster ?? null} initialClanTag={initialClanTag} />
      ) : (
        <ShadowRootPortal>
          <ClientDashboard initialRoster={initialRoster ?? null} initialClanTag={initialClanTag} />
        </ShadowRootPortal>
      )}
    </RootErrorBoundary>
  );
}
