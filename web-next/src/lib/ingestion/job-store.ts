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
  result?: Record<string, any>;
  logs: IngestionJobLogEntry[];
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
          result: record.result ?? null,
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
        result: data.result || undefined,
        logs: data.logs || [],
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
    record.result = result;
  }
  await writeJobRecord(record);
}

export async function getJobRecord(jobId: string): Promise<IngestionJobRecord | null> {
  return readJobRecord(jobId);
}
