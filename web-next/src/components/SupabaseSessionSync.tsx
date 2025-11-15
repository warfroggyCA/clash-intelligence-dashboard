"use client";

import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { syncServerSession } from '@/lib/auth/session-sync';

let browserSupabase: ReturnType<typeof createBrowserClient> | null = null;

function getBrowserSupabase() {
  if (!browserSupabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase client credentials missing');
    }
    browserSupabase = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return browserSupabase;
}

export default function SupabaseSessionSync() {
  const hydrateSession = useDashboardStore((state) => state.hydrateSession);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let isMounted = true;

    const syncAndHydrate = async (event: string, session: Session | null) => {
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      await syncAndHydrate(event, session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateSession]);

  return null;
}

