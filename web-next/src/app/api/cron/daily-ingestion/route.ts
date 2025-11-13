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

  const supabase = getSupabaseAdminClient();

  // Check if Mac cron already ran successfully today (fallback check)
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Check for successful Mac ingestion in the last hour
    const { data: macRun, error: macCheckError } = await supabase
      .from('ingest_logs')
      .select('job_name, status, finished_at, details')
      .eq('job_name', 'mac-ingestion-cron')
      .eq('status', 'completed')
      .gte('finished_at', oneHourAgo)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!macCheckError && macRun) {
      // Mac already ran successfully - skip Vercel execution
      console.log(`[Cron ${executionId}] ⏭️  Mac ingestion already completed at ${macRun.finished_at} - skipping Vercel fallback`);
      
      // Log that we skipped
      await supabase.from('ingest_logs').insert({
        job_name: 'daily-ingestion-cron',
        status: 'skipped',
        started_at: startTime,
        finished_at: new Date().toISOString(),
        details: {
          execution_id: executionId,
          source: 'vercel-cron',
          reason: 'mac_already_ran',
          mac_run_finished_at: macRun.finished_at,
          mac_run_details: macRun.details
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        reason: 'mac_already_ran',
        mac_run_at: macRun.finished_at,
        execution_id: executionId,
        timestamp: new Date().toISOString()
      });
    }
    
    if (macCheckError) {
      console.warn(`[Cron ${executionId}] Warning: Failed to check Mac run status:`, macCheckError.message);
      // Continue with Vercel execution if check fails
    }
  } catch (macCheckException: any) {
    console.warn(`[Cron ${executionId}] Warning: Exception checking Mac run status:`, macCheckException.message);
    // Continue with Vercel execution if check fails
  }

  try {
    console.log(`[Cron ${executionId}] Mac did not run (or check failed) - proceeding with Vercel fallback ingestion at ${startTime}`);
    
    // Log execution start to database for tracking
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
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    
    // CRITICAL: Verify data was actually written
    let dataVerified = false;
    if (result.success && !result.ingestionResult?.skipped) {
      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: verifyRow, error: verifyErr } = await supabase
          .from('canonical_member_snapshots')
          .select('snapshot_date')
          .eq('clan_tag', targetClanTag)
          .eq('snapshot_date', todayIso)
          .limit(1)
          .maybeSingle();
        
        if (!verifyErr && verifyRow) {
          dataVerified = true;
          console.log(`[Cron ${executionId}] ✅ Data verified: snapshot exists for ${todayIso}`);
        } else {
          console.error(`[Cron ${executionId}] ⚠️  WARNING: Ingestion reported success but no data found for ${todayIso}`);
        }
      } catch (verifyError: any) {
        console.error(`[Cron ${executionId}] Failed to verify data:`, verifyError.message);
      }
    } else if (result.ingestionResult?.skipped) {
      dataVerified = true; // Skip is OK if data exists
      console.log(`[Cron ${executionId}] ⏭️  Ingestion skipped: ${result.ingestionResult.reason}`);
    }
    
    console.log(`[Cron ${executionId}] Daily ingestion ${result.success ? 'completed' : 'FAILED'} at ${endTime} (${Math.round(durationMs / 1000)}s)`);
    
    // Update execution log
    await supabase.from('ingest_logs').update({
      status: result.success ? 'completed' : 'failed',
      finished_at: endTime,
      details: {
        execution_id: executionId,
        source: 'vercel-cron',
        results: results,
        duration_ms: durationMs,
        data_verified: dataVerified,
        verification_error: !dataVerified && result.success ? 'Data not found after ingestion' : null
      }
    }).eq('job_name', 'daily-ingestion-cron').eq('started_at', startTime);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          execution_id: executionId,
          error: result.error || 'Ingestion failed',
          timestamp: endTime
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      execution_id: executionId,
      data: results,
      data_verified: dataVerified,
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
