#!/usr/bin/env npx tsx

/**
 * Script to seed Supabase with the latest snapshot data
 * Usage: npx tsx scripts/seed-supabase.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedSupabase() {
  try {
    console.log('🌱 Starting Supabase seeding...');

    // Find the latest snapshot file
    const snapshotDir = join(process.cwd(), '../out/full-snapshots');
    const latestFile = '2pr8r8v8p_2025-09-30T07-00-03-582Z.json';
    const filePath = join(snapshotDir, latestFile);

    console.log(`📁 Reading snapshot: ${latestFile}`);
    const snapshotData = JSON.parse(readFileSync(filePath, 'utf-8'));

    // Extract clan info
    const clanTag = snapshotData.clanTag;
    const clan = snapshotData.clan;
    const members = snapshotData.clan?.memberList || [];
    
    console.log(`🏰 Clan: ${clan.name} (${clanTag})`);
    console.log(`👥 Members: ${members.length}`);

    // Prepare member summaries
    const memberSummaries = members.map((member: any) => ({
      tag: member.tag,
      name: member.name,
      role: member.role,
      townHallLevel: member.townHallLevel,
      expLevel: member.expLevel,
      league: member.league?.name || 'Unranked',
      trophies: member.trophies || 0,
      donations: member.donations || 0,
      donationsReceived: member.donationsReceived || 0,
      warStars: member.warStars || 0,
      clanCapitalContributions: member.clanCapitalContributions || 0,
    }));

    // Prepare player details (same as member summaries for now)
    const playerDetails = memberSummaries;

    // Prepare metadata
    const metadata = {
      snapshotVersion: '1.0',
      totalMembers: members.length,
      clanLevel: clan.clanLevel,
      clanPoints: clan.clanPoints,
      warFrequency: clan.warFrequency,
      warWins: clan.warWins,
      warLosses: clan.warLosses,
      capitalLeague: clan.capitalLeague?.name || 'Unknown',
      clanCapitalPoints: clan.clanCapitalPoints,
    };

    // Prepare the snapshot record
    const snapshotRecord = {
      clan_tag: clanTag.replace('#', '').toLowerCase(),
      snapshot_date: '2025-09-30',
      fetched_at: new Date(snapshotData.fetchedAt).toISOString(),
      clan: clan,
      member_summaries: memberSummaries,
      player_details: playerDetails,
      current_war: snapshotData.currentWar || null,
      war_log: snapshotData.warLog || [],
      capital_seasons: snapshotData.capitalSeasons || [],
      metadata: metadata,
    };

    console.log('💾 Uploading to Supabase...');

    // Upsert the snapshot (will update if exists)
    const { data, error } = await supabase
      .from('clan_snapshots')
      .upsert([snapshotRecord], { 
        onConflict: 'clan_tag,snapshot_date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error uploading snapshot:', error);
      process.exit(1);
    }

    console.log('✅ Successfully seeded Supabase!');
    console.log(`📊 Snapshot ID: ${data.id}`);
    console.log(`🏷️  Clan Tag: ${data.clan_tag}`);
    console.log(`📅 Date: ${data.snapshot_date}`);
    console.log(`👥 Members: ${data.member_summaries.length}`);

    // Test the data retrieval
    console.log('\n🧪 Testing data retrieval...');
    
    const { data: testData, error: testError } = await supabase
      .from('clan_snapshots')
      .select('clan_tag, snapshot_date, member_summaries')
      .eq('clan_tag', '2pr8r8v8p')
      .single();

    if (testError) {
      console.error('❌ Error testing retrieval:', testError);
    } else {
      console.log('✅ Data retrieval test successful!');
      console.log(`📊 Retrieved ${testData.member_summaries.length} members`);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
seedSupabase();
