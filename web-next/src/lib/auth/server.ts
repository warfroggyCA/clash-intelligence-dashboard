import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get a fresh Supabase auth client for the current request.
 * Creates a new client per request to prevent cross-request cookie reuse.
 * 
 * SECURITY: Previously cached a singleton which captured the first request's
 * cookies, causing cross-tenant data leaks. Now creates fresh client each time.
 */
async function getSupabaseAuthClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing for auth client');
  }

  // Create fresh client per request to prevent cookie reuse across requests
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // no-op; we rely on auth helper middleware to manage cookies
      },
      remove() {
        // no-op
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const supabase = await getSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

