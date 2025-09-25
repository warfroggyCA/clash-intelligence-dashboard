"use client";

import { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Button } from '@/components/ui';
import type { ClanRoleName } from '@/lib/auth/roles';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useDashboardStore((state) => state.currentUser);
  const hydrateSession = useDashboardStore((state) => state.hydrateSession);
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const setImpersonatedRole = useDashboardStore((state) => state.setImpersonatedRole);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const allowAnon = process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true';
    if (allowAnon) {
      if (!impersonatedRole) {
        setImpersonatedRole('leader');
      }
      return;
    }
    if (currentUser && impersonatedRole) {
      setImpersonatedRole(null);
    }
  }, [currentUser, impersonatedRole, setImpersonatedRole]);

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
