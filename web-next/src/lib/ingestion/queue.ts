import { getJobRecord, updateJobStatus, appendJobLog, createJobRecord } from './job-store';
import { runIngestionJob, RunIngestionOptions } from './run-ingestion';
import { cfg } from '@/lib/config';

export interface QueueJob {
  id: string;
  clanTag: string;
  retries: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

const queue: QueueJob[] = [];
const runningJobs = new Set<string>();
const MAX_RETRIES = 2;

function logQueue(jobId: string, message: string, details?: Record<string, any>) {
  const tag = `[IngestionQueue ${jobId}]`;
  console.log(tag, message, details ?? '');
}

export async function enqueueIngestionJob(clanTag: string, jobId?: string) {
  const id = jobId || crypto.randomUUID();
  queue.push({ id, clanTag, retries: 0, status: 'pending' });
  await createJobRecord(id, clanTag);
  logQueue(id, 'Job enqueued');
  void processQueue();
  return id;
}

export async function processQueue() {
  const job = queue.find(j => j.status === 'pending');
  if (!job) {
    return;
  }
  if (runningJobs.has(job.id)) {
    return;
  }
  if (cfg.ingestion?.maxConcurrentJobs && runningJobs.size >= cfg.ingestion.maxConcurrentJobs) {
    return;
  }

  runningJobs.add(job.id);
  job.status = 'running';
  await updateJobStatus(job.id, 'running');
  logQueue(job.id, 'Job started');

  try {
    await runIngestionJob({ clanTag: job.clanTag, jobId: job.id });
    job.status = 'completed';
    runningJobs.delete(job.id);
    logQueue(job.id, 'Job completed');
  } catch (error: any) {
    runningJobs.delete(job.id);
    job.retries += 1;
    logQueue(job.id, 'Job failed', { error });
    await appendJobLog(job.id, {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Job failed',
      details: { error },
    });

    if (job.retries <= MAX_RETRIES) {
      job.status = 'pending';
      logQueue(job.id, 'Retrying job', { attempt: job.retries });
    } else {
      job.status = 'failed';
      await updateJobStatus(job.id, 'failed', { error: error?.message || 'Ingestion failed' });
      logQueue(job.id, 'Job marked as failed after retries');
    }
  }

  void processQueue();
}
