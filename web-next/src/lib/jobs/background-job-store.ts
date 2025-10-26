import type { SupabaseClient } from '@supabase/supabase-js';

export type BackgroundJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundJobRecord {
  id: string;
  job_type: string;
  status: BackgroundJobStatus;
  payload: Record<string, any> | null;
  result: Record<string, any> | null;
  error: string | null;
  attempts: number;
  job_key: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateBackgroundJobParams {
  jobType: string;
  payload?: Record<string, any> | null;
  jobKey?: string | null;
  initialStatus?: BackgroundJobStatus;
  dedupe?: boolean;
  dedupeStatuses?: BackgroundJobStatus[];
}

export async function getBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<BackgroundJobRecord | null> {
  if (!jobId) return null;
  const { data, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle<BackgroundJobRecord>();
  if (error) throw error;
  return data ?? null;
}

export async function createBackgroundJob(
  supabase: SupabaseClient,
  params: CreateBackgroundJobParams,
): Promise<BackgroundJobRecord> {
  const dedupeStatuses = params.dedupeStatuses ?? ['pending', 'running'];

  if (params.dedupe && params.jobKey) {
    const { data, error } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('job_key', params.jobKey)
      .in('status', dedupeStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<BackgroundJobRecord>();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    if (data) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from('background_jobs')
    .insert({
      job_type: params.jobType,
      status: params.initialStatus ?? 'pending',
      payload: params.payload ?? null,
      job_key: params.jobKey ?? null,
      attempts: 0,
    })
    .select('*')
    .single<BackgroundJobRecord>();

  if (error) throw error;
  return data;
}

export interface UpdateBackgroundJobParams {
  status?: BackgroundJobStatus;
  result?: Record<string, any> | null;
  error?: string | null;
  attempts?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  payload?: Record<string, any> | null;
}

export async function updateBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  params: UpdateBackgroundJobParams,
): Promise<BackgroundJobRecord> {
  const updates: Record<string, any> = {};

  if (params.status !== undefined) updates.status = params.status;
  if (params.result !== undefined) updates.result = params.result;
  if (params.error !== undefined) updates.error = params.error;
  if (params.attempts !== undefined) updates.attempts = params.attempts;
  if (params.startedAt !== undefined) updates.started_at = params.startedAt;
  if (params.completedAt !== undefined) updates.completed_at = params.completedAt;
  if (params.payload !== undefined) updates.payload = params.payload;

  if (Object.keys(updates).length === 0) {
    const existing = await getBackgroundJob(supabase, jobId);
    if (!existing) {
      throw new Error(`Background job ${jobId} not found`);
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('background_jobs')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .single<BackgroundJobRecord>();

  if (error) throw error;
  return data;
}
