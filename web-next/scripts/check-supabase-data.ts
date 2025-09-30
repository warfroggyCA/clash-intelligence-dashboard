#!/usr/bin/env npx tsx

/**
 * Script to check what data exists in Supabase
 * Usage: npx tsx scripts/check-supabase-data.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabaseData() {
  try {
    console.log('🔍 Checking Supabase data...');

    // Check clan_snapshots table
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('clan_snapshots')
      .select('clan_tag, snapshot_date, created_at')
      .order('created_at', { ascending: false });

    if (snapshotsError) {
      console.error('❌ Error fetching snapshots:', snapshotsError);
    } else {
      console.log(`📊 Found ${snapshots?.length || 0} snapshots:`);
      snapshots?.forEach((snapshot, index) => {
        console.log(`  ${index + 1}. ${snapshot.clan_tag} - ${snapshot.snapshot_date} (${snapshot.created_at})`);
      });
    }

    // Check batch_ai_results table
    const { data: aiResults, error: aiError } = await supabase
      .from('batch_ai_results')
      .select('clan_tag, date, created_at')
      .order('created_at', { ascending: false });

    if (aiError) {
      console.error('❌ Error fetching AI results:', aiError);
    } else {
      console.log(`🤖 Found ${aiResults?.length || 0} AI results:`);
      aiResults?.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.clan_tag} - ${result.date} (${result.created_at})`);
      });
    }

    // Check player_dna_cache table
    const { data: dnaCache, error: dnaError } = await supabase
      .from('player_dna_cache')
      .select('clan_tag, date')
      .order('date', { ascending: false });

    if (dnaError) {
      console.error('❌ Error fetching DNA cache:', dnaError);
    } else {
      console.log(`🧬 Found DNA cache for ${dnaCache?.length || 0} entries:`);
      dnaCache?.forEach((cache, index) => {
        console.log(`  ${index + 1}. ${cache.clan_tag} - ${cache.date}`);
      });
    }

    // Get latest snapshot details for #2PR8R8V8P
    const { data: latestSnapshot, error: latestError } = await supabase
      .from('clan_snapshots')
      .select('*')
      .eq('clan_tag', '2pr8r8v8p')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestError) {
      console.error('❌ Error fetching latest snapshot:', latestError);
    } else if (latestSnapshot) {
      console.log('\n🏰 Latest snapshot for #2PR8R8V8P:');
      console.log(`  📅 Date: ${latestSnapshot.snapshot_date}`);
      console.log(`  👥 Members: ${latestSnapshot.member_summaries?.length || 0}`);
      console.log(`  🏷️  Clan Name: ${latestSnapshot.clan?.name || 'Unknown'}`);
      console.log(`  📊 Clan Level: ${latestSnapshot.clan?.clanLevel || 'Unknown'}`);
      console.log(`  ⚔️  War Wins: ${latestSnapshot.clan?.warWins || 'Unknown'}`);
    }

  } catch (error) {
    console.error('❌ Error checking Supabase data:', error);
    process.exit(1);
  }
}

// Run the check
checkSupabaseData();
