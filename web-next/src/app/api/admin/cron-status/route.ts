import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get recent cron executions
    const { data: cronLogs, error } = await supabase
      .from('ingest_logs')
      .select('*')
      .eq('job_name', 'daily-ingestion-cron')
      .order('started_at', { ascending: false })
      .limit(50);
    
    if (error) {
      throw new Error(`Failed to fetch cron logs: ${error.message}`);
    }
    
    // Analyze execution patterns
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const todayExecutions = cronLogs?.filter(log => 
      log.started_at?.startsWith(today)
    ) || [];
    
    const yesterdayExecutions = cronLogs?.filter(log => 
      log.started_at?.startsWith(yesterday)
    ) || [];
    
    // Count successful vs failed executions
    const todayStats = {
      total: todayExecutions.length,
      successful: todayExecutions.filter(log => log.status === 'completed').length,
      failed: todayExecutions.filter(log => log.status === 'failed').length,
      running: todayExecutions.filter(log => log.status === 'running').length
    };
    
    const yesterdayStats = {
      total: yesterdayExecutions.length,
      successful: yesterdayExecutions.filter(log => log.status === 'completed').length,
      failed: yesterdayExecutions.filter(log => log.status === 'failed').length,
      running: yesterdayExecutions.filter(log => log.status === 'running').length
    };
    
    return NextResponse.json({
      success: true,
      data: {
        today: {
          date: today,
          stats: todayStats,
          executions: todayExecutions
        },
        yesterday: {
          date: yesterday,
          stats: yesterdayStats,
          executions: yesterdayExecutions
        },
        recent_logs: cronLogs?.slice(0, 10) || []
      }
    });
  } catch (error: any) {
    console.error('[Cron Status] Failed to fetch status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Internal Server Error'
      }, 
      { status: 500 }
    );
  }
}
