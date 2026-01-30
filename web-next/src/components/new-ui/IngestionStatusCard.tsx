"use client";

import useSWR from 'swr';
import Card from '@/components/new-ui/Card';
import DataFreshness from '@/components/new-ui/DataFreshness';
import { apiFetcher } from '@/lib/api/swr-fetcher';

type HealthPayload = {
  success: boolean;
  data?: {
    jobId: string;
    clanTag: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    totalDurationMs: number | null;
    anomalies: Array<{ phase: string; message: string }>;
    logs: Array<{ timestamp: string; level: string; message: string }>;
    fetchedAt?: string | null;
    computedAt?: string | null;
  };
  error?: string;
};

export default function IngestionStatusCard({ clanTag }: { clanTag: string }) {
  const key = clanTag ? `/api/ingestion/health?clanTag=${encodeURIComponent(clanTag)}` : '/api/ingestion/health';
  const { data, error, isLoading } = useSWR<HealthPayload>(key, apiFetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
  });

  const payload = (data as any)?.data ?? null;

  return (
    <Card title="Ingestion status">
      {isLoading ? <div className="text-sm text-slate-300">Loading…</div> : null}
      {error ? <div className="text-sm text-rose-200">Failed to load ingestion status.</div> : null}

      {!isLoading && !error && payload ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-slate-500">Latest job</div>
            <div className="text-xs text-slate-400 font-mono">{payload.jobId.slice(0, 8)}…</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300">Status</div>
            <div className="text-sm font-semibold text-white">{payload.status}</div>
          </div>

          <DataFreshness
            at={payload.finishedAt || payload.startedAt}
            modeLabel={payload.status === 'running' ? 'Started' : 'Finished'}
            subline={payload.computedAt ? `Computed: ${payload.computedAt}` : undefined}
          />

          {payload.anomalies?.length ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-amber-200">Anomalies</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-100">
                {payload.anomalies.slice(0, 4).map((a: any) => (
                  <li key={`${a.phase}:${a.message}`}>• {a.phase}: {a.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-slate-400">No anomalies detected.</div>
          )}

          {payload.logs?.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recent logs</div>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {payload.logs.slice(-6).map((l: any) => (
                  <div key={`${l.timestamp}-${l.message}`}>
                    <span className="text-slate-500">{l.timestamp}</span> — {l.level}: {l.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
