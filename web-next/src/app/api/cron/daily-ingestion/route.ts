import { NextRequest, NextResponse } from 'next/server';
import { runIngestionJob } from '@/lib/ingestion/run-ingestion';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron Jobs use GET requests, not POST
export async function GET(request: NextRequest) {
  const executionId = `cron-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  // Verify this is coming from Vercel's cron service
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Vercel cron jobs send a Bearer token in the Authorization header
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log(`[Cron ${executionId}] Unauthorized access attempt`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[Cron ${executionId}] Starting daily ingestion job at ${startTime}`);
    
    // Log execution start to database for tracking
    const supabase = getSupabaseAdminClient();
    await supabase.from('ingest_logs').insert({
      job_name: 'daily-ingestion-cron',
      status: 'running',
      started_at: startTime,
      details: {
        execution_id: executionId,
        source: 'vercel-cron',
        auth_header_present: !!authHeader
      }
    });
    
    const results = await runIngestionJob({ 
      clanTag: '#2PR8R8V8P'
    });
    
    const endTime = new Date().toISOString();
    console.log(`[Cron ${executionId}] Daily ingestion completed successfully at ${endTime}:`, results);
    
    // Update execution log
    await supabase.from('ingest_logs').update({
      status: 'completed',
      finished_at: endTime,
      details: {
        execution_id: executionId,
        source: 'vercel-cron',
        results: results,
        duration_ms: new Date(endTime).getTime() - new Date(startTime).getTime()
      }
    }).eq('job_name', 'daily-ingestion-cron').eq('started_at', startTime);
    
    return NextResponse.json({ 
      success: true, 
      execution_id: executionId,
      data: results,
      timestamp: endTime
    });
  } catch (error: any) {
    const endTime = new Date().toISOString();
    console.error(`[Cron ${executionId}] Daily ingestion FAILED at ${endTime}:`, error);
    
    // Update execution log with error
    const supabase = getSupabaseAdminClient();
    await supabase.from('ingest_logs').update({
      status: 'failed',
      finished_at: endTime,
      details: {
        execution_id: executionId,
        source: 'vercel-cron',
        error: error?.message || 'Internal Server Error',
        duration_ms: new Date(endTime).getTime() - new Date(startTime).getTime()
      }
    }).eq('job_name', 'daily-ingestion-cron').eq('started_at', startTime);
    
    return NextResponse.json(
      { 
        success: false, 
        execution_id: executionId,
        error: error?.message || 'Internal Server Error',
        timestamp: endTime
      }, 
      { status: 500 }
    );
  }
}
