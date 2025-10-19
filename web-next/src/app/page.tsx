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

export default function Home() {
  return <RosterPage />;
}
