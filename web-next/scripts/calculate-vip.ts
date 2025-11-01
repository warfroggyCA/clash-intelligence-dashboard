#!/usr/bin/env tsx
/**
 * Manual VIP Calculation Script
 * Calculates VIP scores for existing Monday snapshots
 * 
 * Usage:
 *   tsx scripts/calculate-vip.ts [snapshot-date]
 *   
 * Example:
 *   tsx scripts/calculate-vip.ts 2025-10-27
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { calculateAndStoreVIP } from '../src/lib/ingestion/calculate-vip';

async function main() {
  const snapshotDateArg = process.argv[2];
  
  if (!snapshotDateArg) {
    console.error('Usage: tsx scripts/calculate-vip.ts <snapshot-date>\n');
    console.error('Example: tsx scripts/calculate-vip.ts 2025-10-27');
    console.error('\nNote: Date should be in YYYY-MM-DD format');
    process.exit(1);
  }

  // Parse date
  const snapshotDate = new Date(snapshotDateArg + 'T00:00:00Z');
  if (isNaN(snapshotDate.getTime())) {
    console.error(`Invalid date format: ${snapshotDateArg}`);
    console.error('Expected format: YYYY-MM-DD (e.g., 2025-10-27)');
    process.exit(1);
  }

  // Check if it's a Monday (optional warning)
  const dayOfWeek = snapshotDate.getUTCDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (dayOfWeek !== 1) {
    console.warn(`⚠️  Warning: ${snapshotDateArg} is a ${dayNames[dayOfWeek]}, not Monday.`);
    console.warn('VIP is typically calculated for Monday snapshots.');
    console.warn('Proceeding anyway...\n');
  }

  console.log(`Calculating VIP for snapshot date: ${snapshotDateArg}`);
  console.log(`Day of week: ${dayNames[dayOfWeek]}\n`);

  try {
    // Allow manual execution even if not Monday
    const result = await calculateAndStoreVIP('manual-calculation', snapshotDate, { 
      skipMondayCheck: true 
    });
    
    if (result.success) {
      console.log(`✅ VIP calculation completed successfully!`);
      console.log(`   Scores calculated: ${result.scoresCalculated}`);
      if (result.scoresCalculated === 0) {
        console.log(`   (No new scores - may already exist for this week)`);
      }
    } else {
      console.error(`❌ VIP calculation failed:`);
      console.error(`   ${result.error}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Unexpected error:`, error?.message || error);
    process.exit(1);
  }
}

main();

