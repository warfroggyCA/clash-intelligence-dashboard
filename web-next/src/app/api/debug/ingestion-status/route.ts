import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check ingestion status and recent errors
 * No auth required for debugging (in production, restrict if needed)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get recent ingestion jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('ingestion_jobs')
      .select('id, clan_tag, status, created_at, updated_at, logs, result')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Get recent ingest logs
    const { data: logs, error: logsError } = await supabase
      .from('ingest_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    // Extract error messages
    const errors: Array<{ source: string; message: string; timestamp: string }> = [];
    
    if (jobs) {
      jobs.forEach(job => {
        const jobLogs = Array.isArray(job.logs) ? job.logs : [];
        const lastLog = jobLogs[jobLogs.length - 1];
        if (lastLog && (lastLog.level === 'error' || lastLog.message?.includes('403') || lastLog.message?.includes('Failed'))) {
          errors.push({
            source: 'ingestion_jobs',
            message: lastLog.message || 'Unknown error',
            timestamp: job.updated_at || job.created_at
          });
        }
        if (job.result && typeof job.result === 'object' && 'error' in job.result) {
          errors.push({
            source: 'ingestion_jobs (result)',
            message: String(job.result.error),
            timestamp: job.updated_at || job.created_at
          });
        }
      });
    }
    
    if (logs) {
      logs.forEach(log => {
        const details = log.details as any;
        if (details?.error || details?.error_message) {
          errors.push({
            source: 'ingest_logs',
            message: details.error || details.error_message,
            timestamp: log.finished_at || log.started_at
          });
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      recentJobs: jobs?.map(j => ({
        id: j.id,
        clanTag: j.clan_tag,
        status: j.status,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
        lastLog: Array.isArray(j.logs) ? j.logs[j.logs.length - 1] : null,
        error: j.result && typeof j.result === 'object' && 'error' in j.result ? j.result.error : null
      })) || [],
      recentLogs: logs?.map(l => ({
        jobName: l.job_name,
        status: l.status,
        startedAt: l.started_at,
        finishedAt: l.finished_at,
        details: l.details
      })) || [],
      errors: errors.slice(0, 10),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        fixieUrl: process.env.FIXIE_URL ? 'SET' : 'NOT SET',
        cocApiToken: process.env.COC_API_TOKEN ? 'SET' : 'NOT SET',
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
