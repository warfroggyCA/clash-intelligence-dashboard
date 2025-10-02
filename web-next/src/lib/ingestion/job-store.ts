import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export type IngestionStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface IngestionJobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, any>;
}

export interface IngestionJobStep {
  name: string;
  status: IngestionStepStatus;
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, any>;
}

export interface IngestionJobRecord {
  id: string;
  clanTag: string;
  status: IngestionStepStatus;
  steps: IngestionJobStep[];
  createdAt: string;
  updatedAt: string;
  logs: IngestionJobLogEntry[];
  anomalies?: Array<{ phase: string; message: string }>;
  totalDurationMs?: number | null;
  payloadVersion?: string | null;
  ingestionVersion?: string | null;
  schemaVersion?: string | null;
  fetchedAt?: string | null;
  computedAt?: string | null;
}

const JOBS_DIR = path.join(process.cwd(), cfg.dataRoot, 'ingestion-jobs');

function getJobFilePath(jobId: string) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

async function ensureJobsDir() {
  if (!cfg.useLocalData) {
    return;
  }
  await fsp.mkdir(JOBS_DIR, { recursive: true });
}

async function writeJobRecordLocally(record: IngestionJobRecord) {
  if (!cfg.useLocalData) {
    return;
  }
  await ensureJobsDir();
  const filePath = getJobFilePath(record.id);
  await fsp.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
}

async function readJobRecordLocally(jobId: string): Promise<IngestionJobRecord | null> {
  if (!cfg.useLocalData) {
    return null;
  }
  try {
    const filePath = getJobFilePath(jobId);
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as IngestionJobRecord;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJobRecord(record: IngestionJobRecord) {
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from('ingestion_jobs')
        .upsert({
          id: record.id,
          clan_tag: record.clanTag,
          status: record.status,
          steps: record.steps,
          logs: record.logs,
          anomalies: record.anomalies ?? null,
          total_duration_ms: record.totalDurationMs ?? null,
          payload_version: record.payloadVersion ?? null,
          ingestion_version: record.ingestionVersion ?? null,
          schema_version: record.schemaVersion ?? null,
          fetched_at: record.fetchedAt ?? null,
          computed_at: record.computedAt ?? null,
          created_at: record.createdAt,
          updated_at: record.updatedAt,
        });
      if (error) {
        console.warn('[IngestionJobStore] Failed to persist job to Supabase, falling back to local', error);
        await writeJobRecordLocally(record);
      }
    } catch (error) {
      console.warn('[IngestionJobStore] Supabase unavailable, using local fallback', error);
      await writeJobRecordLocally(record);
    }
  } else {
    await writeJobRecordLocally(record);
  }
}

async function readJobRecord(jobId: string): Promise<IngestionJobRecord | null> {
  if (cfg.useSupabase) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('ingestion_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (error) {
        console.warn('[IngestionJobStore] Failed to load job from Supabase, trying local', error);
        return readJobRecordLocally(jobId);
      }
      if (!data) {
        return readJobRecordLocally(jobId);
      }
      return {
        id: data.id,
        clanTag: data.clan_tag,
        status: data.status,
        steps: data.steps || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        logs: data.logs || [],
        anomalies: data.anomalies ?? undefined,
        totalDurationMs: data.total_duration_ms ?? undefined,
        payloadVersion: data.payload_version ?? undefined,
        ingestionVersion: data.ingestion_version ?? undefined,
        schemaVersion: data.schema_version ?? undefined,
        fetchedAt: data.fetched_at ?? undefined,
        computedAt: data.computed_at ?? undefined,
      };
    } catch (error) {
      console.warn('[IngestionJobStore] Supabase unavailable, using local fallback', error);
      return readJobRecordLocally(jobId);
    }
  }
  return readJobRecordLocally(jobId);
}

export async function createJobRecord(jobId: string, clanTag: string): Promise<IngestionJobRecord> {
  const now = new Date().toISOString();
  const record: IngestionJobRecord = {
    id: jobId,
    clanTag,
    status: 'pending',
    steps: [],
    createdAt: now,
    updatedAt: now,
    logs: [],
  };
  await writeJobRecord(record);
  return record;
}

export async function appendJobLog(jobId: string, entry: IngestionJobLogEntry): Promise<void> {
  const record = await readJobRecord(jobId);
  if (!record) return;
  record.logs.push(entry);
  record.updatedAt = entry.timestamp;
  await writeJobRecord(record);
}

export async function upsertJobStep(jobId: string, step: IngestionJobStep): Promise<void> {
  const record = await readJobRecord(jobId);
  if (!record) return;
  const existingIndex = record.steps.findIndex((s) => s.name === step.name);
  if (existingIndex === -1) {
    record.steps.push(step);
  } else {
    record.steps[existingIndex] = {
      ...record.steps[existingIndex],
      ...step,
    };
  }
  record.updatedAt = new Date().toISOString();
  await writeJobRecord(record);
}

export async function updateJobStatus(jobId: string, status: IngestionStepStatus, result?: Record<string, any>) {
  const record = await readJobRecord(jobId);
  if (!record) return;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  if (result) {
    record.totalDurationMs = typeof result.totalDurationMs === 'number' ? result.totalDurationMs : record.totalDurationMs;
    record.anomalies = Array.isArray(result.anomalies) ? result.anomalies : record.anomalies;
    record.payloadVersion = result.payloadVersion ?? record.payloadVersion;
    record.ingestionVersion = result.ingestionVersion ?? record.ingestionVersion;
    record.schemaVersion = result.schemaVersion ?? record.schemaVersion;
    record.fetchedAt = result.fetchedAt ?? record.fetchedAt;
    record.computedAt = result.computedAt ?? record.computedAt;
  }
  await writeJobRecord(record);
}

export async function getJobRecord(jobId: string): Promise<IngestionJobRecord | null> {
  return readJobRecord(jobId);
}
