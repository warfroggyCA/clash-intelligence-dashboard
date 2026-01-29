"use client";

import { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import type { RosterData } from './types';
import { apiFetcher, rosterFetcher } from '@/lib/api/swr-fetcher';
import { rosterSWRConfig } from '@/lib/api/swr-config';
import { cfg } from '@/lib/config';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useLeadership } from '@/hooks/useLeadership';
import { normalizeTag } from '@/lib/tags';
import type { Member, Roster } from '@/types';

export const useRosterData = (initialRoster?: RosterData | null) => {
  const selectedClanTag = useDashboardStore((state) => state.clanTag);
  const setRoster = useDashboardStore((state) => state.setRoster);

  const normalizedTag = useMemo(() => {
    const tag = selectedClanTag || cfg.homeClanTag || '';
    return normalizeTag(tag) || tag;
  }, [selectedClanTag]);

  const { permissions } = useLeadership();

  // Default: Supabase snapshot (no CoC calls)
  const swrKey = useMemo(() => {
    if (!normalizedTag) return '/api/roster/snapshot';
    return `/api/roster/snapshot?clanTag=${encodeURIComponent(normalizedTag)}`;
  }, [normalizedTag]);

  const swr = useSWR<RosterData>(swrKey, apiFetcher, {
    ...rosterSWRConfig,
    fallbackData: initialRoster || undefined,
  });

  // Optional: leaders can trigger a live refresh on-demand.
  const refreshLive = useMemo(() => {
    if (!permissions.canModifyClanData || !normalizedTag) return null;
    const liveKey = `/api/v2/roster?clanTag=${encodeURIComponent(normalizedTag)}&mode=live`;
    return async () => {
      return swr.mutate(() => rosterFetcher(liveKey), { revalidate: false });
    };
  }, [normalizedTag, permissions.canModifyClanData, swr]);

  useEffect(() => {
    if (!swr.data || !setRoster) return;
    const snapshot: Roster = {
      source: 'snapshot',
      ...swr.data,
      date: swr.data.date ?? undefined,
      members: swr.data.members as Member[],
      meta: swr.data.meta
        ? {
            ...swr.data.meta,
            clanName: swr.data.meta.clanName ?? undefined,
          }
        : undefined,
      snapshotMetadata: swr.data.snapshotMetadata &&
        swr.data.snapshotMetadata.snapshotDate &&
        swr.data.snapshotMetadata.fetchedAt
        ? {
            ...swr.data.snapshotMetadata,
            snapshotDate: swr.data.snapshotMetadata.snapshotDate,
            fetchedAt: swr.data.snapshotMetadata.fetchedAt,
          }
        : undefined,
    };
    setRoster(snapshot);
  }, [swr.data, setRoster]);

  return {
    ...swr,
    clanTag: normalizedTag,
    members: swr.data?.members ?? [],
    isEmpty: !swr.isLoading && (swr.data?.members?.length ?? 0) === 0,
    refreshLive,
  };
};

export type UseRosterReturn = ReturnType<typeof useRosterData>;
