import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  computeWarPlanAnalysisResult,
  fetchWarPlanRecordById,
  type WarPlanRecord,
  WAR_PLAN_SELECT_FIELDS,
} from './service';
import type { WarPlanProfile } from './analysis';
import {
  createBackgroundJob,
  getBackgroundJob,
  updateBackgroundJob,
  type BackgroundJobRecord,
} from '@/lib/jobs/background-job-store';

export const WAR_PLAN_ANALYSIS_JOB_TYPE = 'war-plan.analysis';
export const WAR_PLAN_ANALYSIS_VERSION = '2025.02.26';

export interface WarPlanAnalysisJobPayload {
  planId: string;
  ourFallback?: WarPlanProfile[];
  opponentFallback?: WarPlanProfile[];
  initiatedBy?: string;
  attempt?: number;
  aiEnabled?: boolean;
}

export interface QueueWarPlanAnalysisOptions {
  ourFallback?: WarPlanProfile[];
  opponentFallback?: WarPlanProfile[];
  initiatedBy?: string;
  inline?: boolean;
  dedupe?: boolean;
  useAI?: boolean;
}

export interface QueueWarPlanAnalysisResult {
  job: BackgroundJobRecord;
  plan: WarPlanRecord;
}

export async function queueWarPlanAnalysis(
  supabase: SupabaseClient,
  plan: WarPlanRecord,
  options: QueueWarPlanAnalysisOptions = {},
): Promise<QueueWarPlanAnalysisResult> {
  const payload: WarPlanAnalysisJobPayload = {
    planId: plan.id,
    ourFallback: options.ourFallback,
    opponentFallback: options.opponentFallback,
    initiatedBy: options.initiatedBy ?? 'manual',
    aiEnabled: options.useAI ?? true,
  };

  const job = await createBackgroundJob(supabase, {
    jobType: WAR_PLAN_ANALYSIS_JOB_TYPE,
    payload,
    jobKey: `war-plan:${plan.id}`,
    dedupe: options.dedupe ?? true,
  });

  const now = new Date().toISOString();
  const planStatus =
    job.status === 'running' ? 'running' : job.status === 'completed' ? 'ready' : job.status === 'failed' ? 'error' : 'queued';

  const planUpdates: Record<string, any> = {
    analysis_status: planStatus,
    analysis_job_id: job.id,
    analysis_version: WAR_PLAN_ANALYSIS_VERSION,
    updated_at: now,
  };

  if (planStatus === 'queued') {
    planUpdates.analysis_started_at = null;
    planUpdates.analysis_completed_at = null;
    planUpdates.analysis = null;
  } else if (planStatus === 'running') {
    planUpdates.analysis_started_at = job.started_at ?? now;
    planUpdates.analysis_completed_at = null;
    planUpdates.analysis = null;
  } else if (planStatus === 'ready') {
    planUpdates.analysis_started_at = job.started_at ?? now;
    planUpdates.analysis_completed_at = job.completed_at ?? now;
  } else if (planStatus === 'error') {
    planUpdates.analysis_started_at = job.started_at ?? null;
    planUpdates.analysis_completed_at = job.completed_at ?? null;
  }

  const { data: updatedPlan, error } = await supabase
    .from('war_plans')
    .update(planUpdates)
    .eq('id', plan.id)
    .select(WAR_PLAN_SELECT_FIELDS)
    .single<WarPlanRecord>();
  if (error) throw error;

  if (options.inline) {
    await runWarPlanAnalysisJob({ supabase, jobId: job.id });
  } else if (job.status === 'pending') {
    void runWarPlanAnalysisJob({ jobId: job.id }).catch((err) => {
      console.error('[WarPlanAnalysisJob] async execution failed', err);
    });
  }

  return { job, plan: updatedPlan };
}

export interface RunWarPlanAnalysisJobOptions {
  jobId: string;
  supabase?: SupabaseClient;
}

export interface WarPlanAnalysisJobResult {
  job: BackgroundJobRecord;
  plan: WarPlanRecord | null;
}

export async function runWarPlanAnalysisJob(
  options: RunWarPlanAnalysisJobOptions,
): Promise<WarPlanAnalysisJobResult> {
  const supabase = options.supabase ?? getSupabaseServerClient();
  const job = await getBackgroundJob(supabase, options.jobId);
  if (!job) {
    throw new Error(`War plan analysis job ${options.jobId} not found`);
  }

  if (job.status === 'completed') {
    return { job, plan: null };
  }

  const payload = (job.payload ?? {}) as WarPlanAnalysisJobPayload;
  if (!payload.planId) {
    await updateBackgroundJob(supabase, job.id, {
      status: 'failed',
      error: 'Missing planId in payload',
      completedAt: new Date().toISOString(),
    });
    throw new Error(`War plan analysis job ${job.id} missing planId payload`);
  }

  const plan = await fetchWarPlanRecordById(supabase, payload.planId);
  if (!plan) {
    await updateBackgroundJob(supabase, job.id, {
      status: 'failed',
      error: `War plan ${payload.planId} no longer exists`,
      completedAt: new Date().toISOString(),
    });
    return { job, plan: null };
  }

  const startedAt = new Date().toISOString();
  const attempts = (job.attempts ?? 0) + 1;

  await updateBackgroundJob(supabase, job.id, {
    status: 'running',
    attempts,
    startedAt,
    error: null,
  });

  await supabase
    .from('war_plans')
    .update({
      analysis_status: 'running',
      analysis_job_id: job.id,
      analysis_started_at: startedAt,
      analysis_completed_at: null,
      analysis_version: WAR_PLAN_ANALYSIS_VERSION,
      updated_at: startedAt,
      analysis: null,
    })
    .eq('id', plan.id);

  try {
    const { analysis } = await computeWarPlanAnalysisResult(supabase, plan, {
      ourFallback: payload.ourFallback ?? [],
      opponentFallback: payload.opponentFallback ?? [],
      enableAI: payload.aiEnabled ?? true,
    });

    const completedAt = new Date().toISOString();

    const { data: updatedPlan, error: updateError } = await supabase
      .from('war_plans')
      .update({
        analysis,
        analysis_status: 'ready',
        analysis_job_id: job.id,
        analysis_completed_at: completedAt,
        analysis_version: WAR_PLAN_ANALYSIS_VERSION,
        updated_at: completedAt,
      })
      .eq('id', plan.id)
      .select(WAR_PLAN_SELECT_FIELDS)
      .single<WarPlanRecord>();

    if (updateError) throw updateError;

    const updatedJob = await updateBackgroundJob(supabase, job.id, {
      status: 'completed',
      completedAt,
      result: {
        planId: plan.id,
        analysisVersion: WAR_PLAN_ANALYSIS_VERSION,
        completedAt,
        confidence: analysis.summary.confidence,
        outlook: analysis.summary.outlook,
        aiEnabled: payload.aiEnabled ?? true,
      },
    });

    return { job: updatedJob, plan: updatedPlan };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Failed to compute war plan analysis';

    await supabase
      .from('war_plans')
      .update({
        analysis_status: 'error',
        analysis_job_id: job.id,
        analysis_completed_at: failedAt,
        updated_at: failedAt,
      })
      .eq('id', plan.id);

    const updatedJob = await updateBackgroundJob(supabase, job.id, {
      status: 'failed',
      completedAt: failedAt,
      error: message,
    });

    throw Object.assign(new Error(message), { cause: error, job: updatedJob });
  }
}
