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

  if (disableAuthGate) {
    return <>{children}</>;
  }

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

  if (sessionStatus === 'idle' || sessionStatus === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Checking access…</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Hang tight while we verify your leadership credentials. If this message doesn’t clear, head back to the sign-in page and try again.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-clash-gold" />
          <Button variant="outline" onClick={handleLoginClick}>
            Return to Sign In
          </Button>
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
