#!/usr/bin/env tsx
/**
 * Migration Script: Add new WCI columns
 * 
 * Run this via Supabase CLI or copy/paste SQL into Supabase SQL Editor
 * 
 * Usage:
 *   Option 1: Run via Supabase CLI
 *     supabase db execute --file supabase/migrations/20250131_update_wci_schema_api_only.sql
 *   
 *   Option 2: Copy/paste SQL into Supabase Dashboard SQL Editor
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getSupabaseAdminClient } from '../src/lib/supabase-admin';

async function main() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Applying WCI schema migration...\n');
  
  // Check if columns already exist
  const { data: existing, error: checkError } = await supabase
    .from('wci_scores')
    .select('tpg, tef, activity')
    .limit(0);
  
  if (!checkError) {
    console.log('✅ New columns already exist!');
    return;
  }
  
  // Columns don't exist - need to add them
  console.log('❌ New columns not found. Please run this SQL manually in Supabase:\n');
  console.log(`
ALTER TABLE public.wci_scores 
  ADD COLUMN IF NOT EXISTS tpg DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS tef DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS activity DECIMAL(5,2);
  `);
  console.log('\nAfter running the SQL, re-run this script or the calculate-wci script.');
  process.exit(1);
}

main();

