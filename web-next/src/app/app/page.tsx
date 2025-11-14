/**
 * Authenticated dashboard entry lives at `/app`.
 * Mirrors the previous `/` implementation by rendering the roster experience.
 */

import { cookies } from 'next/headers';
import RosterPage from '../simple-roster/RosterPage';
import { getInitialRosterData } from '../simple-roster/get-initial-roster';
import type { RosterData } from '../simple-roster/roster-transform';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardHome() {
  let initialRoster: RosterData | null = null;

  try {
    const cookieStore = await cookies();
    const cookieClanTag = cookieStore.get('currentClanTag')?.value;
    initialRoster = await getInitialRosterData(cookieClanTag);
  } catch (error) {
    console.error('[DashboardHome] Failed to load initial roster payload', error);
  }

  return <RosterPage initialRoster={initialRoster} />;
}

