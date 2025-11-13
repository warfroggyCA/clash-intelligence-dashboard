// War Ingestion Cron Endpoint
// Runs daily to fetch and store war log data

import { NextRequest, NextResponse } from 'next/server';
import { ingestWarData } from '@/lib/ingestion/war-ingestion';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { cfg } from '@/lib/config';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const executionId = `war-cron-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  // Verify this is coming from Vercel's cron service or authorized source
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log(`[WarCron ${executionId}] Unauthorized access attempt`);
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
    console.log(`[WarCron ${executionId}] Starting war ingestion for ${clanTag}`);
    
    const result = await ingestWarData({
      clanTag,
      warLogLimit: 20, // Fetch last 20 wars
      skipCurrentWar: false, // Also fetch current war if active
    });

    const endTime = new Date().toISOString();

    // Log ingestion result
    await supabase.from('ingest_logs').insert({
      job_name: 'war-ingestion-cron',
      status: result.success ? 'completed' : 'failed',
      started_at: startTime,
      finished_at: endTime,
      details: {
        execution_id: executionId,
        clan_tag: result.clanTag,
        wars_ingested: result.warsIngested,
        current_war_ingested: result.currentWarIngested,
        errors: result.errors,
      },
    });

    if (result.success) {
      console.log(`[WarCron ${executionId}] ✅ Successfully ingested ${result.warsIngested} wars`);
      return NextResponse.json({
        success: true,
        execution_id: executionId,
        clan_tag: result.clanTag,
        wars_ingested: result.warsIngested,
        current_war_ingested: result.currentWarIngested,
        timestamp: endTime,
      });
    } else {
      console.error(`[WarCron ${executionId}] ❌ War ingestion completed with errors:`, result.errors);
      return NextResponse.json({
        success: false,
        execution_id: executionId,
        clan_tag: result.clanTag,
        wars_ingested: result.warsIngested,
        current_war_ingested: result.currentWarIngested,
        errors: result.errors,
        timestamp: endTime,
      }, { status: 500 });
    }
  } catch (error: any) {
    const endTime = new Date().toISOString();
    console.error(`[WarCron ${executionId}] Fatal error:`, error);

    await supabase.from('ingest_logs').insert({
      job_name: 'war-ingestion-cron',
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
      error: error?.message || 'War ingestion failed',
      timestamp: endTime,
    }, { status: 500 });
  }
}

