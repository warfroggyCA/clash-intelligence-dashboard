#!/usr/bin/env tsx
/**
 * Manual WCI Calculation Script
 * Calculates WCI scores for existing Monday snapshots
 * 
 * Usage:
 *   tsx scripts/calculate-wci.ts [snapshot-date]
 *   
 * Example:
 *   tsx scripts/calculate-wci.ts 2025-10-27
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { calculateAndStoreWCI } from '../src/lib/ingestion/calculate-wci';

async function main() {
  const snapshotDateArg = process.argv[2];
  
  if (!snapshotDateArg) {
    console.error('Usage: tsx scripts/calculate-wci.ts <snapshot-date>\n');
    console.error('Example: tsx scripts/calculate-wci.ts 2025-10-27');
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
    console.warn('WCI is typically calculated for Monday snapshots.');
    console.warn('Proceeding anyway...\n');
  }

  console.log(`Calculating WCI for snapshot date: ${snapshotDateArg}`);
  console.log(`Day of week: ${dayNames[dayOfWeek]}\n`);

  try {
    // Allow manual execution even if not Monday
    const result = await calculateAndStoreWCI('manual-calculation', snapshotDate, { 
      skipMondayCheck: true 
    });
    
    if (result.success) {
      console.log(`✅ WCI calculation completed successfully!`);
      console.log(`   Scores calculated: ${result.scoresCalculated}`);
      if (result.scoresCalculated === 0) {
        console.log(`   (No new scores - may already exist for this week)`);
      }
    } else {
      console.error(`❌ WCI calculation failed:`);
      console.error(`   ${result.error}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Unexpected error:`, error?.message || error);
    process.exit(1);
  }
}

main();

