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
  // Fetch raw response first to check structure
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

  const apiData = await response.json();

  // Handle standard API response format
  if (apiData.success === false) {
    const error: any = new Error(apiData.error || `API request failed: ${url}`);
    error.status = response.status;
    throw error;
  }

  // Import transform function
  const { transformRosterApiResponse } = await import('@/app/simple-roster/roster-transform');
  
  // Transform the API response (apiData is the full response, transform expects RosterApiResponse)
  return transformRosterApiResponse(apiData as any);
}

/**
 * Player profile fetcher
 * Uses the existing fetchPlayerProfileSupabase function
 */
export async function playerProfileFetcher(url: string) {
  // Extract tag from URL like '/api/player/#ABC123/profile'
  const match = url.match(/\/api\/player\/([^/]+)\/profile/);
  if (!match) {
    throw new Error('Invalid player profile URL');
  }

  const tag = decodeURIComponent(match[1]);
  
  // Use existing fetch function (it already has retry logic)
  const { fetchPlayerProfileSupabase } = await import('@/lib/player-profile-supabase');
  
  return fetchPlayerProfileSupabase(tag);
}

