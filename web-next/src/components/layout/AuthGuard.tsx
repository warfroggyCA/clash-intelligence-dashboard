"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Button } from '@/components/ui';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // RESTORED: Proper store selectors with critical fixes
  const currentUser = useDashboardStore((state) => state.currentUser);
  const hydrateSession = useDashboardStore((state) => state.hydrateSession);
  const sessionStatus = useDashboardStore((state) => state.sessionStatus);
  const sessionError = useDashboardStore((state) => state.sessionError);
  const needsOnboarding = useDashboardStore((state) => state.needsOnboarding);
  const pathname = usePathname();
  const router = useRouter();
  const disableAuthGate = process.env.NEXT_PUBLIC_DISABLE_AUTH_GATE === 'true';

  // Ensure login links stay on the current host (for localhost development)
  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/login');
  };

  useEffect(() => {
    if (sessionStatus === 'idle') {
      hydrateSession();
    }
  }, [hydrateSession, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'ready' && needsOnboarding && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [sessionStatus, needsOnboarding, pathname, router]);

  if (disableAuthGate) {
    return <>{children}</>;
  }

  if (sessionStatus === 'idle' || sessionStatus === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-clash-gold" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Verifying session…</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            Loading your clan credentials. This happens automatically—no action needed unless it fails to continue.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Sign In Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {sessionError || 'You need to sign in to access leadership tools.'}
          </p>
        </div>
        <Button size="lg" onClick={handleLoginClick}>
          Sign In
        </Button>
      </div>
    );
  }

  if (sessionStatus === 'ready' && needsOnboarding && pathname !== '/onboarding') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Finish onboarding</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            We’re redirecting you to select your player tags so the dashboard can personalize your access.
          </p>
        </div>
        <Button size="lg" onClick={() => router.replace('/onboarding')}>
          Go to onboarding
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
