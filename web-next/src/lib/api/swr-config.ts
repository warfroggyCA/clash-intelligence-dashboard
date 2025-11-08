/**
 * SWR Configuration
 * Global SWR settings for the application
 */

import { SWRConfiguration } from 'swr';

/**
 * Default SWR configuration
 * Applied globally unless overridden
 */
export const defaultSWRConfig: SWRConfiguration = {
  // Don't revalidate on window focus (reduce unnecessary requests)
  revalidateOnFocus: false,
  
  // Don't revalidate on reconnect (we'll handle stale data detection)
  revalidateOnReconnect: false,
  
  // Don't revalidate on mount if data exists (use cached data)
  revalidateIfStale: true,
  
  // Dedupe requests within this time (prevent duplicate requests)
  dedupingInterval: 5000, // 5 seconds
  
  // Error retry configuration
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  
  // Keep previous data while revalidating (better UX)
  keepPreviousData: true,
  
  // Don't show loading state if we have cached data
  fallbackData: undefined,
};

/**
 * Roster-specific SWR config
 * 5-minute cache (data changes daily via cron)
 */
export const rosterSWRConfig: SWRConfiguration = {
  ...defaultSWRConfig,
  dedupingInterval: 300000, // 5 minutes
  revalidateIfStale: true, // Still revalidate if stale
};

/**
 * Player profile SWR config
 * 30-second cache (more frequently viewed, but can be stale briefly)
 */
export const playerProfileSWRConfig: SWRConfiguration = {
  ...defaultSWRConfig,
  dedupingInterval: 30000, // 30 seconds
  revalidateIfStale: true,
};

