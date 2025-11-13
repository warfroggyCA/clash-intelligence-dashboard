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
  // Don't retry on 4xx errors (client errors like 404)
  // SWR 2.x uses onErrorRetry callback
  onErrorRetry: (error: any, key: string, config: any, revalidate: any, { retryCount }: any) => {
    const status = error?.status || error?.response?.status;
    // Don't retry 4xx errors (except 408 timeout and 429 rate limit)
    if (status >= 400 && status < 500) {
      if (status === 408 || status === 429) {
        // Retry timeout and rate limit errors
        if (retryCount < (config.errorRetryCount || 3)) {
          setTimeout(() => revalidate({ retryCount }), config.errorRetryInterval || 1000);
        }
      }
      // Don't retry other 4xx errors (like 404)
      return;
    }
    // Retry network errors and 5xx errors
    if (retryCount < (config.errorRetryCount || 3)) {
      setTimeout(() => revalidate({ retryCount }), config.errorRetryInterval || 1000);
    }
  },
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

