"use client";

import useSWR from 'swr';
import { normalizeTag } from '@/lib/tags';
import type { ClanGamesSeasonEntry } from '@/types';

interface ApiResponse {
  success: boolean;
  data: ClanGamesSeasonEntry[];
  error?: string;
}

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url, { credentials: 'same-origin' });
  const contentType = res.headers.get('content-type');
  let payload: any = null;
  if (contentType && contentType.includes('application/json')) {
    payload = await res.json();
  } else {
    const text = await res.text();
    payload = { success: false, error: text || res.statusText };
  }

  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `Failed to load clan games history (${res.status})`);
  }

  return payload;
};

export function useClanGamesHistory(clanTag?: string | null, limit = 12) {
  const normalizedTag = clanTag ? normalizeTag(clanTag) : null;
  const query = normalizedTag ? `/api/clan-games?clanTag=${encodeURIComponent(normalizedTag)}&limit=${limit}` : null;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(query, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    errorRetryCount: 1,
  });

  return {
    entries: data?.data ?? [],
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

