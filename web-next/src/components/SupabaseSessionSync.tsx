"use client";

import { useEffect } from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { syncServerSession } from '@/lib/auth/session-sync';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function SupabaseSessionSync() {
  const hydrateSession = useDashboardStore((state) => state.hydrateSession);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    const syncAndHydrate = async (event: AuthChangeEvent | 'INITIAL_SESSION', session: Session | null) => {
      await syncServerSession(event, session);
      if (isMounted) {
        await hydrateSession();
      }
    };

    const syncInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      await syncAndHydrate('INITIAL_SESSION', data.session ?? null);
    };

    syncInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      await syncAndHydrate(event, session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateSession]);

  return null;
}
