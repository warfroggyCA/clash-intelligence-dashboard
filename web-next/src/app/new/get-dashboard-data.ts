import type { DashboardData } from '@/lib/dashboard/dashboard-data';
import { loadDashboardData } from '@/lib/dashboard/dashboard-data';

/**
 * Fetches roster data directly from Supabase for server components.
 * This avoids the HTTP dependency that can fail when ports don't match.
 */
export async function getDashboardData(requestedClanTag?: string): Promise<DashboardData> {
  return loadDashboardData(requestedClanTag);
}

