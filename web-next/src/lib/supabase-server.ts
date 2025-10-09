import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from './supabase-admin';

let cached: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured with the service-role key for
 * trusted server-side operations. Downstream code should prefer this helper
 * instead of creating ad-hoc clients so we can centralise connection logic.
 */
export function getSupabaseServerClient(): SupabaseClient {
  // Temporarily disable caching to debug snapshot issue
  // if (cached) return cached;
  cached = getSupabaseAdminClient();
  return cached;
}

