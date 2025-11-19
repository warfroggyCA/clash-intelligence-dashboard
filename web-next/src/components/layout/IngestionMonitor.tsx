"use client";

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { normalizeTag } from '@/lib/tags';

interface IngestionJobStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, any>;
}

interface IngestionJobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, any>;
}

interface IngestionJobRecord {
  id: string;
  clanTag: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: IngestionJobStep[];
  createdAt: string;
  updatedAt: string;
  result?: Record<string, any>;
  logs: IngestionJobLogEntry[];
}

interface IngestionMonitorProps {
  jobId?: string;
  pollIntervalMs?: number;
  onClose(): void;
  onJobIdChange?: (jobId: string | undefined) => void;
}

interface ClanIngestionStatus {
  clanTag: string;
  clanName?: string;
  hasData: boolean;
  lastJobStatus?: 'pending' | 'running' | 'completed' | 'failed';
  lastJobAt?: string;
  lastSnapshotAt?: string;
  isStale: boolean;
  memberCount?: number;
  lastJobId?: string;
}

async function fetchJobRecord(jobId: string) {
  const res = await fetch(`/api/ingestion/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to load job ${jobId}`);
  }
  const payload = await res.json();
  return payload.data as IngestionJobRecord;
}

async function triggerNewJob() {
  const res = await fetch('/api/ingestion/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ awaitResult: false }),
  });

  if (!res.ok) {
    const errorPayload = await res.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'Failed to trigger ingestion');
  }

  const payload = await res.json();
  return payload.data.jobId as string;
}

type DirectIngestionOptions = {
  forceInsights?: boolean;
  forceFetch?: boolean;
};

async function triggerDirectIngestion(options: DirectIngestionOptions = {}) {
  const params = new URLSearchParams({ cron: 'true' });
  if (options.forceInsights) params.set('forceInsights', 'true');
  if (options.forceFetch) params.set('forceFetch', 'true');
  const res = await fetch(`/api/health?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorPayload = await res.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'Failed to trigger direct ingestion');
  }

  const payload = await res.json();
  return payload.data;
}

export default function IngestionMonitor({ jobId: initialJobId, pollIntervalMs = 2000, onClose, onJobIdChange }: IngestionMonitorProps) {
  const [jobId, setJobId] = useState<string | undefined>(initialJobId);
  const [job, setJob] = useState<IngestionJobRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [directTriggering, setDirectTriggering] = useState(false);
  const [forceInsightsTriggering, setForceInsightsTriggering] = useState(false);
  const [forceFetchTriggering, setForceFetchTriggering] = useState(false);
  const [directResult, setDirectResult] = useState<any>(null);
  const [clanStatuses, setClanStatuses] = useState<ClanIngestionStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [showMultiClanView, setShowMultiClanView] = useState(false);

  useEffect(() => {
    if (initialJobId) {
      setJobId(initialJobId);
    }
  }, [initialJobId]);

  useEffect(() => {
    if (onJobIdChange && jobId !== initialJobId) {
      onJobIdChange(jobId);
    }
  }, [jobId, onJobIdChange, initialJobId]);

  useEffect(() => {
    if (!jobId) return;

    let isActive = true;
    let timeout: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        if (isActive) setLoading(true);
        const record = await fetchJobRecord(jobId);
        if (!isActive) return;
        setJob(record);
        setError(null);
        setLoading(false);

        if (record.status === 'running' || record.status === 'pending') {
          timeout = setTimeout(load, pollIntervalMs);
        }
      } catch (err: any) {
        if (!isActive) return;
        setError(err.message || 'Failed to load job');
        setLoading(false);
        timeout = setTimeout(load, pollIntervalMs);
      }
    };

    load();

    return () => {
      isActive = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [jobId, pollIntervalMs]);

  const handleTriggerJob = async () => {
    try {
      setTriggering(true);
      const newJobId = await triggerNewJob();
      setJobId(newJobId);
      onJobIdChange?.(newJobId);
      setJob(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger ingestion');
    } finally {
      setTriggering(false);
    }
  };

  const handleDirectIngestion = async () => {
    try {
      setDirectTriggering(true);
      setError(null);
      const result = await triggerDirectIngestion();
      setDirectResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger direct ingestion');
    } finally {
      setDirectTriggering(false);
    }
  };

  const handleForceInsights = async () => {
    try {
      setForceInsightsTriggering(true);
      setError(null);
      const result = await triggerDirectIngestion({ forceInsights: true });
      setDirectResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to force insights generation');
    } finally {
      setForceInsightsTriggering(false);
    }
  };

  const handleForceFetch = async () => {
    try {
      setForceFetchTriggering(true);
      setError(null);
      const result = await triggerDirectIngestion({ forceFetch: true });
      setDirectResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to force ingestion');
    } finally {
      setForceFetchTriggering(false);
    }
  };

  const fetchClanStatuses = useCallback(async () => {
    try {
      setLoadingStatuses(true);
      const response = await fetch('/api/tracked-clans/status', {
        credentials: 'same-origin',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setClanStatuses(result.data.statuses || []);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch clan statuses:', err);
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    void fetchClanStatuses();
    // Refresh every 30 seconds
    const interval = setInterval(fetchClanStatuses, 30000);
    return () => clearInterval(interval);
  }, [fetchClanStatuses]);

  const handleSelectClanJob = useCallback((clan: ClanIngestionStatus) => {
    if (!clan.lastJobId) return;
    setShowMultiClanView(false);
    setJob(null);
    setJobId(clan.lastJobId);
    onJobIdChange?.(clan.lastJobId);
  }, [onJobIdChange]);

  const renderStepStatus = (step: IngestionJobStep) => {
    const statusColor = {
      pending: 'bg-gray-200 text-gray-700',
      running: 'bg-blue-200 text-blue-700',
      completed: 'bg-green-200 text-green-700',
      failed: 'bg-red-200 text-red-700',
    }[step.status];

    return (
      <div key={step.name} className="border border-slate-200 rounded-lg p-3 bg-white/80">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">{step.name}</p>
            <p className="text-xs text-slate-500">
              {step.startedAt ? `Started ${formatDistanceToNow(new Date(step.startedAt))} ago` : 'Not started'}
              {step.finishedAt ? ` • Finished ${formatDistanceToNow(new Date(step.finishedAt))} ago` : ''}
            </p>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusColor}`}>{step.status}</span>
        </div>
        {step.metadata && (
          <div className="mt-2 text-xs text-slate-600">
            <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(step.metadata, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  };

  const renderLogs = (logs: IngestionJobLogEntry[]) => {
    if (!logs.length) return <p className="text-sm text-slate-500">No logs yet.</p>;
    return (
      <div className="space-y-2 max-h-64 overflow-y-auto bg-slate-900 text-slate-100 rounded-lg p-3 text-xs">
        {logs.map((log) => (
          <div key={`${log.timestamp}-${log.message}`}>
            <span className="text-slate-400">{new Date(log.timestamp).toISOString().slice(11, 19)} •</span>{' '}
            <span className={
              log.level === 'error'
                ? 'text-red-300'
                : log.level === 'warn'
                ? 'text-yellow-300'
                : 'text-slate-100'
            }>
              {log.level.toUpperCase()}
            </span>
            : {log.message}
            {log.details ? (
              <pre className="mt-1 whitespace-pre-wrap text-slate-300 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-xl p-6 w-[min(720px,90vw)] max-h-[80vh] overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Ingestion Job Monitor</h2>
          <p className="text-sm text-slate-600">
            Track ingestion job progress, logs, and results. Jobs run via the new queue system.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700"
          aria-label="Close ingestion monitor"
        >
          ×
        </button>
      </div>

      {/* Multi-Clan Status Toggle */}
      {clanStatuses.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowMultiClanView(!showMultiClanView)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {showMultiClanView ? 'Show Single Job' : 'Show All Clans'}
          </button>
          <button
            onClick={() => void fetchClanStatuses()}
            disabled={loadingStatuses}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStatuses ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Multi-Clan Status View */}
      {showMultiClanView && clanStatuses.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tracked Clans Status</h3>
          <div className="space-y-2">
            {clanStatuses.map((clan) => {
              const statusColor = clan.isStale
                ? 'border-red-200 bg-red-50'
                : clan.lastJobStatus === 'running'
                ? 'border-blue-200 bg-blue-50'
                : clan.lastJobStatus === 'failed'
                ? 'border-red-200 bg-red-50'
                : 'border-green-200 bg-green-50';

              const statusDotColor = clan.isStale
                ? 'bg-red-400'
                : clan.lastJobStatus === 'running'
                ? 'bg-blue-400'
                : clan.lastJobStatus === 'failed'
                ? 'bg-red-400'
                : 'bg-green-400';

              const clickable = Boolean(clan.lastJobId);

              return (
                <button
                  key={clan.clanTag}
                  type="button"
                  onClick={() => handleSelectClanJob(clan)}
                  disabled={!clickable}
                  className={`w-full text-left border rounded-lg p-3 transition ${statusColor} ${
                    clickable ? 'hover:border-slate-400 hover:shadow-sm' : 'opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${statusDotColor} flex-shrink-0`} />
                        <span className="font-semibold text-slate-800">{clan.clanName || clan.clanTag}</span>
                        {clan.lastJobStatus && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-slate-600">
                            {clan.lastJobStatus}
                          </span>
                        )}
                      </div>
                      {clan.clanName && (
                        <div className="mt-0.5 text-xs font-mono text-slate-600">
                          {clan.clanTag}
                        </div>
                      )}
                      {clan.lastJobAt && (
                        <div className="mt-1 text-xs text-slate-600">
                          Last job: {formatDistanceToNow(new Date(clan.lastJobAt), { addSuffix: true })}
                        </div>
                      )}
                      {clan.memberCount !== undefined && (
                        <div className="text-xs text-slate-600">
                          {clan.memberCount} members
                        </div>
                      )}
                      {clan.isStale && (
                        <div className="mt-1 text-xs text-red-600 font-semibold">
                          ⚠️ Data is stale (more than 6 hours old)
                        </div>
                      )}
                      {clan.lastJobId && (
                        <div className="mt-2 text-xs font-semibold text-blue-700">
                          View latest job details →
                        </div>
                      )}
                      {!clan.lastJobId && (
                        <div className="mt-2 text-xs text-slate-500">
                          No ingestion jobs recorded yet
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleTriggerJob}
          disabled={triggering}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggering ? 'Triggering…' : 'Queue Ingestion' }
        </button>
        <button
          onClick={handleDirectIngestion}
          disabled={directTriggering || forceInsightsTriggering}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {directTriggering ? 'Running…' : 'Direct Ingestion'}
        </button>
        <button
          onClick={handleForceInsights}
          disabled={directTriggering || forceInsightsTriggering || forceFetchTriggering}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate insights even if data is current (skips data fetch)"
        >
          {forceInsightsTriggering ? 'Generating…' : 'Force Insights'}
        </button>
        <button
          onClick={handleForceFetch}
          disabled={directTriggering || forceFetchTriggering || forceInsightsTriggering}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Bypass up-to-date checks and run a full ingestion fetch even if today’s data already exists."
        >
          {forceFetchTriggering ? 'Forcing…' : 'Force Fetch'}
        </button>
        {jobId && (
          <span className="text-sm font-mono text-slate-500">Job ID: {jobId}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {directResult && (
        <div className={`mb-4 rounded-lg border p-3 ${
          directResult.some((r: any) => r.skipped) 
            ? 'border-amber-200 bg-amber-50' 
            : directResult.some((r: any) => r.error)
            ? 'border-red-200 bg-red-50'
            : 'border-green-200 bg-green-50'
        }`}>
          <h3 className={`text-sm font-semibold mb-2 ${
            directResult.some((r: any) => r.skipped)
              ? 'text-amber-800'
              : directResult.some((r: any) => r.error)
              ? 'text-red-800'
              : 'text-green-800'
          }`}>
            {directResult.some((r: any) => r.skipped) 
              ? '⏭️ Ingestion Skipped' 
              : directResult.some((r: any) => r.error)
              ? '❌ Direct Ingestion Failed'
              : '✅ Direct Ingestion Successful!'}
          </h3>
          <div className={`text-xs space-y-1 ${
            directResult.some((r: any) => r.skipped)
              ? 'text-amber-700'
              : directResult.some((r: any) => r.error)
              ? 'text-red-700'
              : 'text-green-700'
          }`}>
            {directResult.map((result: any, index: number) => (
              <div key={index} className="border-b border-current/20 pb-2 last:border-b-0">
                <div><strong>Clan:</strong> {result.clanTag}</div>
                {result.skipped ? (
                  <>
                    <div><strong>Status:</strong> Skipped</div>
                    <div><strong>Reason:</strong> {result.reason || 'Unknown'}</div>
                    {result.reason === 'up_to_date' && (
                      <div className="mt-1 text-xs italic">Data already exists for today. Ingestion skipped to avoid duplicates.</div>
                    )}
                  </>
                ) : (
                  <>
                    <div><strong>Members:</strong> {result.memberCount}</div>
                    {result.memberCount === 0 && result.success && (
                      <div className="mt-1 text-xs italic text-amber-600">
                        ⚠️ No members processed. This may indicate:
                        <ul className="list-disc list-inside mt-1 ml-2">
                          <li>Clan API returned empty data</li>
                          <li>All phases were skipped</li>
                          <li>Check server logs for details</li>
                        </ul>
                      </div>
                    )}
                    <div><strong>Changes:</strong> {result.changesDetected}</div>
                    <div><strong>Players Resolved:</strong> {result.playersResolved}</div>
                    {result.phases && (
                      <div className="mt-1 text-xs">
                        <strong>Phases:</strong> Fetch: {result.phases.fetch ? '✓' : '✗'}, 
                        Transform: {result.phases.transform ? '✓' : '✗'}, 
                        Upsert: {result.phases.upsertMembers ? '✓' : '✗'}, 
                        Snapshot: {result.phases.writeSnapshot ? '✓' : '✗'}, 
                        Stats: {result.phases.writeStats ? '✓' : '✗'}
                      </div>
                    )}
                    {result.error && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                    {result.summary && (
                      <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                        <strong>Summary:</strong> {result.summary}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !job && (
        <div className="py-12 text-center text-slate-500">Loading job…</div>
      )}

      {job && (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clan</p>
                <p className="font-semibold text-slate-800">{job.clanTag}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="font-semibold text-slate-800">{job.status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Started</p>
                <p className="text-slate-700 text-sm">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Updated</p>
                <p className="text-slate-700 text-sm">
                  {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Steps</h3>
            <div className="space-y-2">
              {job.steps.length ? job.steps.map(renderStepStatus) : (
                <p className="text-sm text-slate-500">No steps recorded yet.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Result</h3>
            {job.result ? (
              <div className="border border-slate-200 rounded-lg bg-white p-3 text-xs text-slate-700">
                <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(job.result, null, 2)}</pre>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Result not available yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Logs</h3>
            {renderLogs(job.logs)}
          </div>
        </div>
      )}
    </div>
  );
}
