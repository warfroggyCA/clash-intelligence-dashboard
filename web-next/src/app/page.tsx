/**
 * Clash Intelligence Dashboard - Main Page
 *
 * Renders the simplified roster experience directly at `/`
 * while keeping `/simple-roster` as a legacy redirect.
 *
 * Version: 3.0.0 (Simplified Architecture)
 * Last Updated: October 2025
 */

import RosterPage from './simple-roster/RosterPage';
import { getInitialRosterData } from './simple-roster/get-initial-roster';
import type { RosterData } from './simple-roster/roster-transform';

// Force dynamic rendering to prevent stale data caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  let initialRoster: RosterData | null = null;

  try {
    initialRoster = await getInitialRosterData();
  } catch (error) {
    console.error('[Home] Failed to load initial roster payload', error);
  }

  return <RosterPage initialRoster={initialRoster} />;
}
