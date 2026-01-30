"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/new-ui/Button';
import { showToast } from '@/lib/toast';
import { apiFetcher } from '@/lib/api/swr-fetcher';
import type { IngestionJobRecord } from '@/lib/ingestion/job-store';

type Props = {
  clanTag: string;
  enabled: boolean;
  onCompleted?: () => void;
  className?: string;
};

export default function IngestionRefreshButton({ clanTag, enabled, onCompleted, className }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);

  const jobKey = useMemo(() => (jobId ? `/api/ingestion/jobs/${encodeURIComponent(jobId)}` : null), [jobId]);
  const { data: job } = useSWR<IngestionJobRecord>(jobKey, apiFetcher, {
    refreshInterval: jobId ? 1500 : 0,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!jobId || !job) return;
    if (job.status === 'completed') {
      showToast('Refresh complete. Loading latest snapshot…', 'success');
      setJobId(null);
      onCompleted?.();
    } else if (job.status === 'failed') {
      showToast('Refresh failed. Check logs.', 'error');
      setJobId(null);
    }
  }, [job, jobId, onCompleted]);

  const handleClick = useCallback(async () => {
    if (!enabled) {
      showToast('Permission required to request refresh.', 'error');
      return;
    }
    if (jobId) {
      return;
    }

    try {
      const res = await fetch('/api/ingestion/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      const nextJobId = payload?.data?.jobId as string;
      setJobId(nextJobId);
      showToast('Refresh queued.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to request refresh.', 'error');
    }
  }, [clanTag, enabled, jobId]);

  const label = jobId
    ? (job?.status === 'running' ? 'Refreshing…' : 'Refresh queued')
    : 'Request refresh';

  return (
    <Button
      tone="accentAlt"
      onClick={handleClick}
      disabled={!enabled || Boolean(jobId)}
      title={!enabled ? 'Permission required' : (jobId ? 'Refresh already running' : 'Queue a full ingestion run (updates snapshots)')}
      className={className}
    >
      {label}
    </Button>
  );
}
