import { useDashboardStore } from '@/lib/stores/dashboard-store';

/**
 * Smart API Client
 * Wraps fetch to automatically include impersonation headers in dev mode.
 */

export async function smartFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  
  // Try to get impersonated role from the store
  // We check for window to ensure this runs client-side
  if (typeof window !== 'undefined') {
    try {
      // Note: We use raw getState to avoid hook rules in a utility function
      const state = useDashboardStore.getState();
      if (state.impersonatedRole) {
        headers.set('x-impersonate-role', state.impersonatedRole);
      }
    } catch (e) {
      // Store might not be ready, ignore
    }
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
