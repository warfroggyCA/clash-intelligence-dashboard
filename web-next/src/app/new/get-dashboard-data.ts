import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { getCurrentRosterData } from '@/lib/roster-current';

/**
 * Fetches roster data directly from Supabase for server components.
 * This avoids the HTTP dependency that can fail when ports don't match.
 */
export async function getDashboardData(requestedClanTag?: string): Promise<RosterData | null> {
  return getCurrentRosterData(requestedClanTag);
}

