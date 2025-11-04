#!/usr/bin/env tsx
/**
 * Comprehensive ingestion diagnostics script
 * Checks cron schedules, execution history, and data freshness
 */

import { getSupabaseAdminClient } from '../src/lib/supabase-admin';
import { cfg } from '../src/lib/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('INGESTION DIAGNOSTICS');
  console.log('='.repeat(80));
  console.log();

  const supabase = getSupabaseAdminClient();
  const clanTag = cfg.homeClanTag || '#2PR8R8V8P';

  // 1. Check Vercel cron configuration
  console.log('1. VERCEL CRON CONFIGURATION');
  console.log('-'.repeat(80));
  try {
    const vercelJsonPath = join(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const crons = vercelJson.crons || [];
    console.log(`Found ${crons.length} cron job(s):`);
    crons.forEach((cron: any, i: number) => {
      console.log(`  ${i + 1}. Schedule: ${cron.schedule} → ${cron.path}`);
    });
  } catch (error: any) {
    console.error(`  ❌ Failed to read vercel.json: ${error.message}`);
  }
  console.log();

  // 2. Check ingestion jobs table
  console.log('2. INGESTION JOBS HISTORY (Last 10)');
  console.log('-'.repeat(80));
  try {
    const { data: jobs, error } = await supabase
      .from('ingestion_jobs')
      .select('id, clan_tag, status, created_at, completed_at, error_message')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error(`  ❌ Error querying ingestion_jobs: ${error.message}`);
    } else if (!jobs || jobs.length === 0) {
      console.log('  ⚠️  No ingestion jobs found');
    } else {
      console.log(`  Found ${jobs.length} job(s):`);
      jobs.forEach((job, i) => {
        const created = new Date(job.created_at);
        const completed = job.completed_at ? new Date(job.completed_at) : null;
        const duration = completed ? Math.round((completed.getTime() - created.getTime()) / 1000) : null;
        const statusIcon = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${i + 1}. ${statusIcon} ${job.status.toUpperCase()}`);
        console.log(`     Created: ${created.toISOString()}`);
        if (completed) {
          console.log(`     Completed: ${completed.toISOString()} (${duration}s)`);
        }
        if (job.error_message) {
          console.log(`     Error: ${job.error_message}`);
        }
      });
    }
  } catch (error: any) {
    console.error(`  ❌ Failed to query ingestion_jobs: ${error.message}`);
  }
  console.log();

  // 3. Check canonical_member_snapshots for latest dates
  console.log('3. LATEST SNAPSHOT DATES');
  console.log('-'.repeat(80));
  try {
    const { data: latestSnapshots, error } = await supabase
      .from('canonical_member_snapshots')
      .select('snapshot_date')
      .eq('clan_tag', clanTag)
      .order('snapshot_date', { ascending: false })
      .limit(10);

    if (error) {
      console.error(`  ❌ Error querying canonical_member_snapshots: ${error.message}`);
    } else if (!latestSnapshots || latestSnapshots.length === 0) {
      console.log('  ⚠️  No snapshots found');
    } else {
      const uniqueDates = [...new Set(latestSnapshots.map(s => s.snapshot_date?.slice(0, 10)))].filter(Boolean);
      console.log(`  Latest snapshot dates (${uniqueDates.length} unique):`);
      uniqueDates.slice(0, 10).forEach((date, i) => {
        const dateObj = new Date(date + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const daysAgo = Math.floor((today.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
        const freshness = daysAgo === 0 ? '✅ TODAY' : daysAgo === 1 ? '⚠️  YESTERDAY' : `❌ ${daysAgo} DAYS AGO`;
        console.log(`    ${i + 1}. ${date} ${freshness}`);
      });
      
      const latestDate = uniqueDates[0];
      const todayIso = new Date().toISOString().slice(0, 10);
      if (latestDate && latestDate < todayIso) {
        console.log(`  ⚠️  WARNING: Latest snapshot is ${latestDate}, but today is ${todayIso}`);
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Failed to query canonical_member_snapshots: ${error.message}`);
  }
  console.log();

  // 4. Check ingest_logs
  console.log('4. INGEST LOGS (Last 10)');
  console.log('-'.repeat(80));
  try {
    const { data: logs, error } = await supabase
      .from('ingest_logs')
      .select('job_name, status, started_at, finished_at, details')
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error(`  ❌ Error querying ingest_logs: ${error.message}`);
    } else if (!logs || logs.length === 0) {
      console.log('  ⚠️  No ingest logs found');
    } else {
      console.log(`  Found ${logs.length} log entry/entries:`);
      logs.forEach((log, i) => {
        const started = new Date(log.started_at);
        const finished = log.finished_at ? new Date(log.finished_at) : null;
        const statusIcon = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${i + 1}. ${statusIcon} ${log.job_name} - ${log.status}`);
        console.log(`     Started: ${started.toISOString()}`);
        if (finished) {
          const duration = Math.round((finished.getTime() - started.getTime()) / 1000);
          console.log(`     Finished: ${finished.toISOString()} (${duration}s)`);
        }
        if (log.details?.error) {
          console.log(`     Error: ${log.details.error}`);
        }
      });
    }
  } catch (error: any) {
    console.error(`  ❌ Failed to query ingest_logs: ${error.message}`);
  }
  console.log();

  // 5. Check today's expected runs
  console.log('5. EXPECTED RUNS TODAY');
  console.log('-'.repeat(80));
  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  
  // Expected times: 4:30 UTC and 5:30 UTC
  const run1 = new Date(today);
  run1.setUTCHours(4, 30, 0, 0);
  const run2 = new Date(today);
  run2.setUTCHours(5, 30, 0, 0);
  
  console.log(`  Today: ${today.toISOString().slice(0, 10)}`);
  console.log(`  Expected run 1: ${run1.toISOString()} (4:30 UTC)`);
  console.log(`  Expected run 2: ${run2.toISOString()} (5:30 UTC)`);
  console.log(`  Current time: ${now.toISOString()}`);
  
  if (now < run1) {
    console.log(`  ⏳ Run 1 hasn't happened yet (in ${Math.round((run1.getTime() - now.getTime()) / 1000 / 60)} minutes)`);
  } else if (now >= run1 && now < run2) {
    console.log(`  ✅ Run 1 should have completed`);
    console.log(`  ⏳ Run 2 hasn't happened yet (in ${Math.round((run2.getTime() - now.getTime()) / 1000 / 60)} minutes)`);
  } else {
    console.log(`  ✅ Both runs should have completed`);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('DIAGNOSTICS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);

