import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { cfg } from '@/lib/config';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get latest ingestion job
    const { data: latestJob, error: jobError } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('clan_tag', cfg.homeClanTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get latest snapshot
    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('clan_snapshots')
      .select('snapshot_date, created_at, member_count')
      .eq('clan_tag', cfg.homeClanTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate health status
    const now = new Date();
    const lastUpdate = latestSnapshot ? new Date(latestSnapshot.created_at) : null;
    const hoursSinceUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60) : null;
    
    const isHealthy = hoursSinceUpdate !== null && hoursSinceUpdate < 25; // Allow 1 hour grace period
    const isStale = hoursSinceUpdate !== null && hoursSinceUpdate > 48;
    
    const healthStatus = {
      overall: isHealthy ? 'healthy' : (isStale ? 'stale' : 'warning'),
      lastUpdate: lastUpdate?.toISOString() || null,
      hoursSinceUpdate: hoursSinceUpdate,
      memberCount: latestSnapshot?.member_count || 0,
      latestJob: latestJob ? {
        status: latestJob.status,
        createdAt: latestJob.created_at,
        completedAt: latestJob.completed_at,
        error: latestJob.error_message
      } : null,
      automation: {
        vercelCron: {
          enabled: true,
          schedule: '0 3 * * *', // 3 AM UTC
          nextRun: getNextCronTime('0 3 * * *')
        },
        githubActions: {
          enabled: true,
          schedule: '0 6 * * *', // 6 AM UTC
          nextRun: getNextCronTime('0 6 * * *')
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: healthStatus,
      timestamp: now.toISOString()
    });

  } catch (error: any) {
    console.error('[Health] Pipeline health check failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Health check failed',
      data: {
        overall: 'error',
        lastUpdate: null,
        hoursSinceUpdate: null,
        memberCount: 0,
        latestJob: null,
        automation: {
          vercelCron: { enabled: false, error: 'Health check failed' },
          githubActions: { enabled: false, error: 'Health check failed' }
        }
      }
    }, { status: 500 });
  }
}

function getNextCronTime(cronExpression: string): string {
  // Simple calculation for next run (this is a simplified version)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3, 0, 0, 0); // 3 AM UTC
  return tomorrow.toISOString();
}
