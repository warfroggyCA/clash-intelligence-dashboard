/**
 * SWR Fetcher Functions
 * Simple, reusable fetchers for SWR hooks
 */

import { fetchWithRetry } from './retry';

/**
 * Generic API fetcher for SWR
 * Handles the standard API response format: { success: boolean, data?: T, error?: string }
 */
export async function apiFetcher<T = any>(url: string): Promise<T> {
  const response = await fetchWithRetry(
    url,
    {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
    }
  );

  const data = await response.json();

  // Handle standard API response format
  if (data.success === false) {
    const error: any = new Error(data.error || `API request failed: ${url}`);
    error.status = response.status;
    throw error;
  }

  // Return the data (either data.data or the whole response)
  return data.data ?? data;
}

/**
 * Roster-specific fetcher
 * Transforms the API response to RosterData format
 */
export async function rosterFetcher(url: string) {
  // Fetch raw response - don't use fetchWithRetry here since it throws on non-ok responses
  // We want to read the JSON body even for 404s
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  const apiData = await response.json();

  // Handle standard API response format (including 404s with JSON bodies)
  if (apiData.success === false) {
    const error: any = new Error(apiData.error || `API request failed: ${url}`);
    error.status = response.status;
    // Mark 4xx errors as non-retryable
    if (response.status >= 400 && response.status < 500) {
      error.retryable = false;
    }
    throw error;
  }

  // Import transform function
  const { transformRosterApiResponse } = await import('@/app/(dashboard)/simple-roster/roster-transform');

  // Transform the API response (apiData is the full response, transform expects RosterApiResponse)
  return transformRosterApiResponse(apiData as any);
}

/**
 * Player profile fetcher
 * Uses the existing fetchPlayerProfileSupabase function
 */
export async function playerProfileFetcher(url: string) {
  // Extract tag from URL like '/api/player/#ABC123/profile' or '/api/v2/player/#ABC123'
  const match =
    url.match(/\/api\/v2\/player\/([^/?#]+)/) ||
    url.match(/\/api\/player\/([^/]+)\/profile/);
  if (!match) {
    throw new Error('Invalid player profile URL');
  }

  const tag = decodeURIComponent(match[1]);

  // Extract clanTag from URL query params if present
  const urlObj = new URL(url, window.location.origin);
  const clanTag = urlObj.searchParams.get('clanTag');

  // Use existing fetch function (it already has retry logic)
  const { fetchPlayerProfileSupabase } = await import('@/lib/player-profile-supabase');

  return fetchPlayerProfileSupabase(tag, clanTag);
}

/**
 * Smart insights fetcher
 * Fetches smart insights payload from /api/insights
 */
export async function insightsFetcher(url: string) {
  // Add nocache parameter to bypass server-side cache when revalidating
  const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5050');
  // Only add nocache if not already present (to avoid duplicates)
  if (!urlObj.searchParams.has('nocache') && !urlObj.searchParams.has('_refresh')) {
    urlObj.searchParams.set('nocache', '1');
  }
  const finalUrl = urlObj.pathname + urlObj.search;

  const response = await fetchWithRetry(
    finalUrl,
    {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
    }
  );

  const apiData = await response.json();

  // Handle standard API response format
  if (apiData.success === false) {
    const error: any = new Error(apiData.error || `API request failed: ${finalUrl}`);
    error.status = response.status;
    throw error;
  }

  // Extract the payload from the response
  // API returns: { success: true, data: { smartInsightsPayload: ..., payload: ... } }
  return apiData.data?.smartInsightsPayload ?? apiData.data?.payload ?? null;
}
