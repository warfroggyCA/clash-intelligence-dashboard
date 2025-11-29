"use client";

import { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { rosterFetcher } from '@/lib/api/swr-fetcher';
import { rosterSWRConfig } from '@/lib/api/swr-config';
import { cfg } from '@/lib/config';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import type { Member, Roster } from '@/types';

export const useRosterData = (initialRoster?: RosterData | null) => {
  const selectedClanTag = useDashboardStore((state) => state.clanTag);
  const setRoster = useDashboardStore((state) => state.setRoster);

  const normalizedTag = useMemo(() => {
    const tag = selectedClanTag || cfg.homeClanTag || '';
    return normalizeTag(tag) || tag;
  }, [selectedClanTag]);

  const swrKey = normalizedTag
    ? `/api/v2/roster?clanTag=${encodeURIComponent(normalizedTag)}`
    : '/api/v2/roster';

  const swr = useSWR<RosterData>(swrKey, rosterFetcher, {
    ...rosterSWRConfig,
    fallbackData: initialRoster || undefined,
  });

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
  };
};

export type UseRosterReturn = ReturnType<typeof useRosterData>;
