// Capital Raid Ingestion Cron Endpoint
// Runs weekly to fetch and store capital raid data

import { NextRequest, NextResponse } from 'next/server';
import { ingestCapitalData } from '@/lib/ingestion/capital-ingestion';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { cfg } from '@/lib/config';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const executionId = `capital-cron-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  // Verify this is coming from Vercel's cron service or authorized source
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log(`[CapitalCron ${executionId}] Unauthorized access attempt`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const clanTag = cfg.homeClanTag;

  if (!clanTag) {
    return NextResponse.json({ 
      success: false, 
      error: 'No home clan tag configured' 
    }, { status: 400 });
  }

  try {
    console.log(`[CapitalCron ${executionId}] Starting capital ingestion for ${clanTag}`);
    
    const result = await ingestCapitalData({
      clanTag,
      seasonLimit: 10, // Fetch last 10 raid weekends
    });

    const endTime = new Date().toISOString();

    // Log ingestion result
    await supabase.from('ingest_logs').insert({
      job_name: 'capital-ingestion-cron',
      status: result.success ? 'completed' : 'failed',
      started_at: startTime,
      finished_at: endTime,
      details: {
        execution_id: executionId,
        clan_tag: result.clanTag,
        seasons_ingested: result.seasonsIngested,
        weekends_ingested: result.weekendsIngested,
        participants_ingested: result.participantsIngested,
        errors: result.errors,
      },
    });

    if (result.success) {
      console.log(`[CapitalCron ${executionId}] ✅ Successfully ingested ${result.seasonsIngested} seasons, ${result.weekendsIngested} weekends, ${result.participantsIngested} participants`);
      return NextResponse.json({
        success: true,
        execution_id: executionId,
        clan_tag: result.clanTag,
        seasons_ingested: result.seasonsIngested,
        weekends_ingested: result.weekendsIngested,
        participants_ingested: result.participantsIngested,
        timestamp: endTime,
      });
    } else {
      console.error(`[CapitalCron ${executionId}] ❌ Capital ingestion completed with errors:`, result.errors);
      return NextResponse.json({
        success: false,
        execution_id: executionId,
        clan_tag: result.clanTag,
        seasons_ingested: result.seasonsIngested,
        weekends_ingested: result.weekendsIngested,
        participants_ingested: result.participantsIngested,
        errors: result.errors,
        timestamp: endTime,
      }, { status: 500 });
    }
  } catch (error: any) {
    const endTime = new Date().toISOString();
    console.error(`[CapitalCron ${executionId}] Fatal error:`, error);

    await supabase.from('ingest_logs').insert({
      job_name: 'capital-ingestion-cron',
      status: 'failed',
      started_at: startTime,
      finished_at: endTime,
      details: {
        execution_id: executionId,
        error: error?.message || String(error),
      },
    });

    return NextResponse.json({
      success: false,
      execution_id: executionId,
      error: error?.message || 'Capital ingestion failed',
      timestamp: endTime,
    }, { status: 500 });
  }
}

