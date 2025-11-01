import { NextRequest, NextResponse } from 'next/server';
import { runStagedIngestionJob } from '@/lib/ingestion/run-staged-ingestion';
import { cfg } from '@/lib/config';
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
    
    const url = new URL(request.url);
    let targetClanTag = cfg.homeClanTag;
    
    // CRITICAL SAFEGUARD: Ensure we're using the correct default clan tag
    if (!targetClanTag || targetClanTag === '#G9QVRYC2Y') {
      console.error(`[Cron ${executionId}] INVALID CLAN TAG DETECTED: ${targetClanTag}. Forcing to #2PR8R8V8P`);
      targetClanTag = '#2PR8R8V8P';
    }
    
    // Only allow clanTag override with admin key header
    const adminKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
    const providedKey = request.headers.get('x-api-key');
    const clanTagOverride = url.searchParams.get('clanTag');
    if (clanTagOverride && adminKey && providedKey === adminKey) {
      targetClanTag = clanTagOverride;
      console.log(`[Cron ${executionId}] Using override clan tag: ${targetClanTag}`);
    }
    
    // Log the clan tag being used for debugging
    console.log(`[Cron ${executionId}] Using clan tag: ${targetClanTag} (from cfg.homeClanTag: ${cfg.homeClanTag})`);
    
    const result = await runStagedIngestionJob({ 
      clanTag: targetClanTag,
      runPostProcessing: true
    });
    
    const results = [{
      clanTag: result.clanTag,
      success: result.success,
      error: result.error,
      ingestionResult: result.ingestionResult
    }];
    
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
