"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export default function NewSnapshotIndicator() {
  const clanTag = useDashboardStore((s) => s.clanTag || s.homeClan || cfg.homeClanTag || '');
  const latestVersion = useDashboardStore((s) => s.latestSnapshotVersion);
  const latestId = useDashboardStore((s) => s.latestSnapshotId ?? null);
  const refreshData = useDashboardStore((s) => s.refreshData);

  const normalizedTag = useMemo(() => normalizeTag(clanTag) || clanTag, [clanTag]);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const lastCheckedRef = useRef<number>(0);

  const checkForNew = useCallback(async () => {
    if (!normalizedTag || checking) return;
    const now = Date.now();
    // Throttle to at most once per 30 minutes
    if (now - lastCheckedRef.current < 30 * 60 * 1000) return;
    lastCheckedRef.current = now;
    setChecking(true);
    try {
      const params = new URLSearchParams({ clanTag: normalizedTag, _t: String(now) });
      const res = await fetch(`/api/ingestion/health?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (!body?.success) return;
      const data = body.data as any;
      const serverVersion: string | null = data?.payloadVersion ?? null;
      const serverSnapshotId: string | null = data?.snapshotId ?? null;
      const status: string | null = data?.status ?? null;
      if (status !== 'completed') return;
      const currentVersion = latestVersion ?? null;
      const currentId = latestId ?? null;
      const differs = (() => {
        if (serverVersion && currentVersion) return serverVersion !== currentVersion;
        if (!serverVersion && serverSnapshotId && currentId) return serverSnapshotId !== currentId;
        // if we have neither, don’t spam
        return false;
      })();
      if (differs) setHasUpdate(true);
    } catch {
      // silent
    } finally {
      setChecking(false);
    }
  }, [normalizedTag, checking, latestVersion, latestId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void checkForNew();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // Initial check on mount (throttled)
    void checkForNew();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [checkForNew]);

  if (!hasUpdate) return null;

  const onRefresh = async () => {
    try {
      await refreshData();
    } finally {
      setHasUpdate(false);
    }
  };

  return (
    <button
      onClick={onRefresh}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-600/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-600/30"
      title="A new snapshot is available. Click to refresh."
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      New snapshot available
      <span className="ml-1">•</span>
      <span>Refresh</span>
    </button>
  );
}

