import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron Status Endpoint
 * Returns the status of cron job executions and data freshness
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get recent cron executions from ingest_logs
    const { data: cronLogs, error: logsError } = await supabase
      .from('ingest_logs')
      .select('*')
      .eq('job_name', 'daily-ingestion-cron')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (logsError) {
      console.error('[cron-status] Error fetching logs:', logsError);
    }
    
    // Get latest snapshot dates for each clan
    const { data: latestSnapshots, error: snapshotError } = await supabase
      .from('canonical_member_snapshots')
      .select('clan_tag, snapshot_date')
      .order('snapshot_date', { ascending: false });
    
    if (snapshotError) {
      console.error('[cron-status] Error fetching snapshots:', snapshotError);
    }
    
    // Group by clan_tag and get the latest date for each
    const latestByClan = new Map<string, string>();
    for (const snap of latestSnapshots || []) {
      if (!snap.clan_tag || !snap.snapshot_date) continue;
      const current = latestByClan.get(snap.clan_tag);
      if (!current || snap.snapshot_date > current) {
        latestByClan.set(snap.clan_tag, snap.snapshot_date);
      }
    }
    
    // Get current date
    const currentDateUTC = new Date().toISOString().split('T')[0];
    
    // Check for stale data
    const staleClans: Array<{ clanTag: string; snapshotDate: string; daysOld: number }> = [];
    for (const [clanTag, snapshotDate] of latestByClan.entries()) {
      const snapshotDateOnly = snapshotDate.split('T')[0];
      if (currentDateUTC > snapshotDateOnly) {
        const daysDiff = Math.floor(
          (new Date(currentDateUTC).getTime() - new Date(snapshotDateOnly).getTime()) / (1000 * 60 * 60 * 24)
        );
        staleClans.push({
          clanTag,
          snapshotDate: snapshotDateOnly,
          daysOld: daysDiff,
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      currentDate: currentDateUTC,
      cronExecutions: cronLogs || [],
      latestSnapshots: Array.from(latestByClan.entries()).map(([clanTag, date]) => ({
        clanTag,
        snapshotDate: date.split('T')[0],
        isStale: currentDateUTC > date.split('T')[0],
      })),
      staleClans,
      summary: {
        totalCronExecutions: cronLogs?.length || 0,
        recentSuccesses: cronLogs?.filter(log => log.status === 'completed').length || 0,
        recentFailures: cronLogs?.filter(log => log.status === 'failed').length || 0,
        totalClans: latestByClan.size,
        staleClanCount: staleClans.length,
      },
    });
  } catch (error: any) {
    console.error('[cron-status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
