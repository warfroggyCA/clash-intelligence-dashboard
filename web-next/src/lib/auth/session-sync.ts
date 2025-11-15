import type { Session } from '@supabase/supabase-js';

/**
 * Propagates Supabase auth state changes to the server so Route Handlers can read cookies.
 * Errors are intentionally swallowed so UI flows never break due to transient network issues.
 */
export async function syncServerSession(event: string, session: Session | null) {
  try {
    await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ event, session }),
    });
  } catch (error) {
    if (process.env.NEXT_PUBLIC_DASHBOARD_DEBUG_LOG === 'true') {
      // eslint-disable-next-line no-console
      console.warn('[session-sync] Failed to sync Supabase session', error);
    }
  }
}

