"use client";

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

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

export default function IngestionMonitor({ jobId: initialJobId, pollIntervalMs = 2000, onClose, onJobIdChange }: IngestionMonitorProps) {
  const [jobId, setJobId] = useState<string | undefined>(initialJobId);
  const [job, setJob] = useState<IngestionJobRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

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

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleTriggerJob}
          disabled={triggering}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggering ? 'Triggering…' : 'Trigger Ingestion' }
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
