#!/usr/bin/env tsx
/**
 * Mac-based war ingestion script
 * Runs war ingestion directly from Mac (no Fixie proxy needed)
 * Writes data to Supabase
 * 
 * This mirrors the Vercel cron job at /api/cron/war-ingestion
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });
config();

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ingestWarData } from '../src/lib/ingestion/war-ingestion';
import { ingestCapitalData } from '../src/lib/ingestion/capital-ingestion';
import { cfg } from '../src/lib/config';
import { getSupabaseAdminClient } from '../src/lib/supabase-admin';

const LOG_DIR = process.env.HOME + '/Library/Logs';
const LOG_FILE = join(LOG_DIR, 'clash-intelligence-war-ingestion.log');

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
  console.log(message, ...args);
  
  try {
    const logDir = dirname(LOG_FILE);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    appendFileSync(LOG_FILE, logMessage);
  } catch (err) {
    // Ignore log file errors
  }
}

async function main() {
  const executionId = `mac-war-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  const clanTag = cfg.homeClanTag;
  if (!clanTag) {
    log(`[${executionId}] ❌ No home clan tag configured`);
    process.exit(1);
  }

  try {
    log(`[${executionId}] Starting war ingestion for ${clanTag}`);
    
    const warResult = await ingestWarData({
      clanTag,
      warLogLimit: 20,
      skipCurrentWar: false,
    });

    const isCapitalRunDay = new Date().getUTCDay() === 1; // Monday (UTC)
    let capitalResult: Awaited<ReturnType<typeof ingestCapitalData>> | null = null;

    if (isCapitalRunDay) {
      log(`[${executionId}] Monday detected – triggering capital raid ingestion`);
      try {
        capitalResult = await ingestCapitalData({ clanTag });
        log(`[${executionId}] Capital ingestion completed: ${capitalResult?.seasonsIngested || 0} seasons`);
      } catch (capitalError: any) {
        log(`[${executionId}] Capital ingestion failed: ${capitalError?.message || 'Unknown error'}`);
      }
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from('ingestion_jobs').insert({
      job_name: 'war-ingestion-cron',
      clan_tag: clanTag,
      status: 'completed',
      started_at: startTime,
      completed_at: new Date().toISOString(),
      metadata: {
        executionId,
        warsIngested: warResult.warsIngested,
        capitalSeasonsIngested: capitalResult?.seasonsIngested || 0,
        isCapitalRunDay,
      },
    });

    log(`[${executionId}] ✅ Successfully ingested ${warResult.warsIngested} wars${isCapitalRunDay ? ' (capital ingestion executed)' : ''}`);
    process.exit(0);
  } catch (error: any) {
    log(`[${executionId}] ❌ Fatal error: ${error?.message || 'Unknown error'}`);
    
    const supabase = getSupabaseAdminClient();
    await supabase.from('ingestion_jobs').insert({
      job_name: 'war-ingestion-cron',
      clan_tag: clanTag,
      status: 'failed',
      started_at: startTime,
      completed_at: new Date().toISOString(),
      error: error?.message || 'War ingestion failed',
    });
    
    process.exit(1);
  }
}

main();





