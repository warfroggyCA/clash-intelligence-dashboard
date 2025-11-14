// War Ingestion Cron Endpoint
// Runs daily to fetch and store war log data

import { NextRequest, NextResponse } from 'next/server';
import { ingestWarData } from '@/lib/ingestion/war-ingestion';
import { ingestCapitalData } from '@/lib/ingestion/capital-ingestion';
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
    
    const warResult = await ingestWarData({
      clanTag,
      warLogLimit: 20, // Fetch last 20 wars
      skipCurrentWar: false, // Also fetch current war if active
    });

    const isCapitalRunDay = new Date().getUTCDay() === 1; // Monday (UTC)
    let capitalResult: Awaited<ReturnType<typeof ingestCapitalData>> | null = null;
    let capitalError: Error | null = null;

    if (isCapitalRunDay) {
      console.log(`[WarCron ${executionId}] Monday detected – triggering capital raid ingestion fallback`);
      try {
        capitalResult = await ingestCapitalData({
          clanTag,
          seasonLimit: 20,
        });

        await supabase.from('ingest_logs').insert({
          job_name: 'capital-ingestion-cron',
          status: capitalResult.success ? 'completed' : 'failed',
          started_at: startTime,
          finished_at: new Date().toISOString(),
          details: {
            execution_id: `${executionId}-capital`,
            clan_tag: capitalResult.clanTag,
            seasons_ingested: capitalResult.seasonsIngested,
            weekends_ingested: capitalResult.weekendsIngested,
            participants_ingested: capitalResult.participantsIngested,
            errors: capitalResult.errors,
            triggered_by: 'war-cron-fallback',
          },
        });
      } catch (error: any) {
        capitalError = error instanceof Error ? error : new Error(String(error));
        console.error(`[WarCron ${executionId}] Capital ingestion fallback failed:`, capitalError);
        await supabase.from('ingest_logs').insert({
          job_name: 'capital-ingestion-cron',
          status: 'failed',
          started_at: startTime,
          finished_at: new Date().toISOString(),
          details: {
            execution_id: `${executionId}-capital`,
            error: capitalError.message,
            triggered_by: 'war-cron-fallback',
          },
        });
      }
    }

    const endTime = new Date().toISOString();

    // Log ingestion result
    await supabase.from('ingest_logs').insert({
      job_name: 'war-ingestion-cron',
      status: warResult.success ? 'completed' : 'failed',
      started_at: startTime,
      finished_at: endTime,
      details: {
        execution_id: executionId,
        clan_tag: warResult.clanTag,
        wars_ingested: warResult.warsIngested,
        current_war_ingested: warResult.currentWarIngested,
        errors: warResult.errors,
        capital_ingestion_triggered: isCapitalRunDay,
        capital_ingestion_success: capitalResult?.success ?? (capitalError ? false : null),
      },
    });

    const responsePayload = {
      success: warResult.success && (!isCapitalRunDay || capitalError === null) && (capitalResult?.success ?? true),
      execution_id: executionId,
      clan_tag: warResult.clanTag,
      wars_ingested: warResult.warsIngested,
      current_war_ingested: warResult.currentWarIngested,
      timestamp: endTime,
      capital_ingestion: isCapitalRunDay
        ? {
            attempted: true,
            success: capitalResult?.success ?? false,
            seasons_ingested: capitalResult?.seasonsIngested ?? 0,
            weekends_ingested: capitalResult?.weekendsIngested ?? 0,
            participants_ingested: capitalResult?.participantsIngested ?? 0,
            errors: capitalResult?.errors ?? (capitalError ? [capitalError.message] : undefined),
          }
        : { attempted: false },
    };

    if (warResult.success && (!isCapitalRunDay || capitalError === null)) {
      console.log(`[WarCron ${executionId}] ✅ Successfully ingested ${warResult.warsIngested} wars${isCapitalRunDay ? ' (capital ingestion fallback executed)' : ''}`);
      return NextResponse.json(responsePayload);
    } else {
      console.error(`[WarCron ${executionId}] ❌ Ingestion completed with issues`, {
        warErrors: warResult.errors,
        capitalError: capitalError?.message,
        capitalErrors: capitalResult?.errors,
      });
      return NextResponse.json(responsePayload, { status: 500 });
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

