"use client";

import { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Button } from '@/components/ui';
import type { ClanRoleName } from '@/lib/auth/roles';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // TEST 2: Stub out all store selectors with hard-coded values
  const currentUser = null; // Hard-coded to test if store subscription causes loop
  const hydrateSession = () => {}; // Stub function
  const impersonatedRole = 'leader'; // Hard-coded
  const setImpersonatedRole = (role?: any) => {}; // Stub function with optional parameter

  // TEST 4: Disable first useEffect that calls hydrateSession
  // useEffect(() => {
  //   hydrateSession();
  // }, [hydrateSession]);

  // TEST 3: Disable second useEffect that calls useDashboardStore.getState()
  // useEffect(() => {
  //   const allowAnon = process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true';
  //   if (!allowAnon) return;
  //   // only set default impersonation one time
  //   const state = useDashboardStore.getState();
  //   if (!state.impersonatedRole) {
  //     setImpersonatedRole('leader');
  //   }
  // }, [setImpersonatedRole]);

  if (!currentUser) {
    if (process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true') {
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Sign In Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            You need to be signed in to access leadership tools.
          </p>
        </div>
        <a href="/login">
          <Button size="lg">Sign In</Button>
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
