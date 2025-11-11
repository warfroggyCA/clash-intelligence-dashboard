#!/usr/bin/env tsx
/**
 * Mac-based ingestion script
 * Runs ingestion directly from Mac (no Fixie proxy needed)
 * Writes data to Supabase
 * 
 * Usage:
 *   npm run ingest:mac                    # Ingest home clan
 *   npm run ingest:mac -- #2PR8R8V8P      # Ingest specific clan
 *   npm run ingest:mac:all                # Ingest all tracked clans
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly (dotenv/config may not load .env.local by default)
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });
// Also load regular .env if it exists
config();
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { runStagedIngestionJob } from '../src/lib/ingestion/run-staged-ingestion';
import { cfg } from '../src/lib/config';
import { getSupabaseAdminClient } from '../src/lib/supabase-admin';

const LOG_DIR = process.env.HOME + '/Library/Logs';
const LOG_FILE = join(LOG_DIR, 'clash-intelligence-ingestion.log');

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
  console.log(message, ...args);
  
  // Also write to log file
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

async function loadTrackedClans(): Promise<string[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tracked_clans')
      .select('clan_tag')
      .eq('is_active', true)
      .order('added_at', { ascending: true });
    
    if (error) {
      log('Warning: Failed to load tracked clans from Supabase:', error.message);
      // Fall back to home clan
      return [cfg.homeClanTag];
    }
    
    if (data && data.length > 0) {
      return data.map(row => row.clan_tag);
    }
  } catch (error: any) {
    log('Warning: Failed to load tracked clans:', error.message);
  }
  
  // Default to home clan if no config or error
  return [cfg.homeClanTag];
}

async function ingestClan(clanTag: string, executionId: string): Promise<boolean> {
  const startTime = new Date().toISOString();
  log(`[${executionId}] Starting ingestion for ${clanTag}`);
  
  // Log execution start to database
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('ingest_logs').insert({
      job_name: 'mac-ingestion-cron',
      status: 'running',
      started_at: startTime,
      details: {
        execution_id: executionId,
        source: 'mac-cron',
        clan_tag: clanTag
      }
    });
  } catch (err: any) {
    log(`[${executionId}] Warning: Failed to log to database:`, err.message);
  }
  
  try {
    const result = await runStagedIngestionJob({
      clanTag,
      runPostProcessing: true
    });
    
    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    
    // Verify data was written
    let dataVerified = false;
    if (result.success && !result.ingestionResult?.skipped) {
      try {
        const supabase = getSupabaseAdminClient();
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: verifyRow, error: verifyErr } = await supabase
          .from('canonical_member_snapshots')
          .select('snapshot_date')
          .eq('clan_tag', clanTag)
          .eq('snapshot_date', todayIso)
          .limit(1)
          .maybeSingle();
        
        if (!verifyErr && verifyRow) {
          dataVerified = true;
          log(`[${executionId}] ✅ Data verified: snapshot exists for ${todayIso}`);
        } else {
          log(`[${executionId}] ⚠️  WARNING: Ingestion reported success but no data found for ${todayIso}`);
        }
      } catch (verifyError: any) {
        log(`[${executionId}] Failed to verify data:`, verifyError.message);
      }
    } else if (result.ingestionResult?.skipped) {
      dataVerified = true;
      log(`[${executionId}] ⏭️  Ingestion skipped: ${result.ingestionResult.reason}`);
    }
    
    // Update execution log
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from('ingest_logs').update({
        status: result.success ? 'completed' : 'failed',
        finished_at: endTime,
        details: {
          execution_id: executionId,
          source: 'mac-cron',
          clan_tag: clanTag,
          results: [{
            clanTag: result.clanTag,
            success: result.success,
            error: result.error,
            ingestionResult: result.ingestionResult
          }],
          duration_ms: durationMs,
          data_verified: dataVerified
        }
      }).eq('job_name', 'mac-ingestion-cron').eq('started_at', startTime);
    } catch (err: any) {
      log(`[${executionId}] Warning: Failed to update log:`, err.message);
    }
    
    if (result.success) {
      log(`[${executionId}] ✅ Ingestion completed for ${clanTag} (${Math.round(durationMs / 1000)}s)`);
      return true;
    } else {
      log(`[${executionId}] ❌ Ingestion failed for ${clanTag}:`, result.error);
      return false;
    }
  } catch (error: any) {
    const endTime = new Date().toISOString();
    log(`[${executionId}] ❌ Ingestion error for ${clanTag}:`, error.message || error);
    
    // Update execution log with error
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from('ingest_logs').update({
        status: 'failed',
        finished_at: endTime,
        details: {
          execution_id: executionId,
          source: 'mac-cron',
          clan_tag: clanTag,
          error: error?.message || 'Unknown error'
        }
      }).eq('job_name', 'mac-ingestion-cron').eq('started_at', startTime);
    } catch (err: any) {
      log(`[${executionId}] Warning: Failed to log error:`, err.message);
    }
    
    return false;
  }
}

async function main() {
  const executionId = `mac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  log(`[${executionId}] Mac ingestion started at ${startTime}`);
  
  // Check if specific clan tag provided as argument
  const clanTagArg = process.argv[2];
  const ingestAll = process.argv.includes('--all') || process.argv.includes('-a');
  
  let clansToIngest: string[];
  
  if (clanTagArg && !clanTagArg.startsWith('-')) {
    // Specific clan tag provided
    clansToIngest = [clanTagArg];
    log(`[${executionId}] Ingesting specific clan: ${clanTagArg}`);
  } else if (ingestAll) {
    // Ingest all tracked clans
    clansToIngest = await loadTrackedClans();
    log(`[${executionId}] Ingesting all tracked clans: ${clansToIngest.join(', ')}`);
  } else {
    // Default: home clan
    clansToIngest = [cfg.homeClanTag];
    log(`[${executionId}] Ingesting home clan: ${cfg.homeClanTag}`);
  }
  
  // Validate environment
  if (!process.env.COC_API_TOKEN && !process.env.COC_API_KEY) {
    log(`[${executionId}] ❌ ERROR: COC_API_TOKEN or COC_API_KEY not set`);
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log(`[${executionId}] ❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set`);
    process.exit(1);
  }
  
  // Ensure proxy is disabled for direct API calls (Mac has fixed IP, no Fixie needed)
  process.env.COC_DISABLE_PROXY = 'true';
  // Set NODE_ENV to development to allow direct connections
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }
  
  // Process each clan
  const results: Array<{ clanTag: string; success: boolean }> = [];
  
  for (const clanTag of clansToIngest) {
    const success = await ingestClan(clanTag, executionId);
    results.push({ clanTag, success });
    
    // Add delay between clans to respect rate limits (if multiple clans)
    if (clansToIngest.length > 1 && clanTag !== clansToIngest[clansToIngest.length - 1]) {
      log(`[${executionId}] Waiting 5 seconds before next clan...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  const endTime = new Date().toISOString();
  const allSuccess = results.every(r => r.success);
  const successCount = results.filter(r => r.success).length;
  
  log(`[${executionId}] Mac ingestion ${allSuccess ? 'completed' : 'finished'} at ${endTime}`);
  log(`[${executionId}] Results: ${successCount}/${results.length} successful`);
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

