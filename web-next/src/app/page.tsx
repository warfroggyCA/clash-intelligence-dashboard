/**
 * Clash Intelligence Dashboard - Main Page
 * 
 * Redirects to /simple-roster (the new clean roster view)
 * 
 * Version: 2.0.0 (Simplified Architecture)
 * Last Updated: October 2025
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/simple-roster');
}
