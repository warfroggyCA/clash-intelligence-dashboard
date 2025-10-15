#!/usr/bin/env tsx
/**
 * Backfill Enriched Data Script
 * 
 * Replays historical clan_snapshots to populate enriched fields in member_snapshot_stats.
 * 
 * This script:
 * 1. Fetches all clan_snapshots with player_details JSONB data
 * 2. For each snapshot, extracts enriched fields from playerDetails
 * 3. Updates corresponding member_snapshot_stats rows with new enriched columns
 * 
 * Usage:
 *   npm run backfill-enriched-data                    # Dry run (preview changes)
 *   npm run backfill-enriched-data --execute          # Execute backfill
 *   npm run backfill-enriched-data --execute --limit=10  # Backfill 10 snapshots
 * 
 * @author Clash Intelligence Team
 * @date October 12, 2025
 */

import { getSupabaseAdminClient } from '../src/lib/supabase-admin';
import { normalizeTag } from '../src/lib/tags';
import { extractEnrichedFields } from '../src/lib/ingestion/field-extractors';

interface BackfillOptions {
  execute: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

interface BackfillStats {
  snapshotsProcessed: number;
  membersUpdated: number;
  errors: number;
  skipped: number;
  duration: number;
}

async function backfillEnrichedData(options: BackfillOptions): Promise<BackfillStats> {
  const startTime = Date.now();
  const supabase = getSupabaseAdminClient();
  
  console.log('🚀 Starting enriched data backfill...');
  console.log(`   Mode: ${options.execute ? '🔥 EXECUTE' : '👁️  DRY RUN'}`);
  if (options.limit) console.log(`   Limit: ${options.limit} snapshots`);
  if (options.startDate) console.log(`   Start Date: ${options.startDate}`);
  if (options.endDate) console.log(`   End Date: ${options.endDate}`);
  console.log('');

  const stats: BackfillStats = {
    snapshotsProcessed: 0,
    membersUpdated: 0,
    errors: 0,
    skipped: 0,
    duration: 0,
  };

  // Build query to fetch snapshots
  let query = supabase
    .from('clan_snapshots')
    .select('id, clan_tag, snapshot_date, fetched_at, player_details')
    .not('player_details', 'is', null)
    .order('fetched_at', { ascending: true });

  if (options.startDate) {
    query = query.gte('fetched_at', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('fetched_at', options.endDate);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: snapshots, error: snapshotsError } = await query;

  if (snapshotsError) {
    console.error('❌ Failed to fetch clan_snapshots:', snapshotsError);
    throw snapshotsError;
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('⚠️  No snapshots found matching criteria');
    return stats;
  }

  console.log(`📦 Found ${snapshots.length} snapshots to process\n`);

  // Process each snapshot
  for (const snapshot of snapshots) {
    const snapshotStartTime = Date.now();
    console.log(`\n📸 Processing snapshot ${snapshot.id}`);
    console.log(`   Clan: ${snapshot.clan_tag}`);
    console.log(`   Date: ${snapshot.fetched_at}`);

    try {
      const playerDetails = snapshot.player_details as Record<string, any>;
      if (!playerDetails || typeof playerDetails !== 'object') {
        console.log('   ⚠️  No player_details available, skipping...');
        stats.skipped++;
        continue;
      }

      const playerCount = Object.keys(playerDetails).length;
      console.log(`   Players: ${playerCount}`);

      // Get all member_snapshot_stats rows for this snapshot
      const { data: statsRows, error: statsError } = await supabase
        .from('member_snapshot_stats')
        .select('id, member_id')
        .eq('snapshot_id', snapshot.id);

      if (statsError) {
        console.error(`   ❌ Failed to fetch stats rows:`, statsError.message);
        stats.errors++;
        continue;
      }

      if (!statsRows || statsRows.length === 0) {
        console.log('   ⚠️  No member_snapshot_stats rows found for this snapshot, skipping...');
        stats.skipped++;
        continue;
      }

      // Get member tags for these member_ids
      const memberIds = statsRows.map(row => row.member_id);
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, tag')
        .in('id', memberIds);

      if (membersError) {
        console.error(`   ❌ Failed to fetch members:`, membersError.message);
        stats.errors++;
        continue;
      }

      // Create mapping: member_id -> tag
      const memberIdToTag = new Map<string, string>();
      for (const member of members || []) {
        memberIdToTag.set(member.id, normalizeTag(member.tag));
      }

      // Extract enriched fields for each member
      const updates: Array<{
        id: string;
        pet_levels: any;
        builder_hall_level: number | null;
        versus_trophies: number | null;
        versus_battle_wins: number | null;
        builder_league_id: number | null;
        war_stars: number | null;
        attack_wins: number | null;
        defense_wins: number | null;
        capital_contributions: number | null;
        max_troop_count: number | null;
        max_spell_count: number | null;
        super_troops_active: string[] | null;
        achievement_count: number | null;
        achievement_score: number | null;
        exp_level: number | null;
        best_trophies: number | null;
        best_versus_trophies: number | null;
      }> = [];

      for (const statsRow of statsRows) {
        const tag = memberIdToTag.get(statsRow.member_id);
        if (!tag) {
          console.log(`   ⚠️  No tag found for member_id ${statsRow.member_id}`);
          continue;
        }

        const detail = playerDetails[tag];
        if (!detail) {
          // Player detail not available (fetch failed, player left, etc.)
          continue;
        }

        const enriched = extractEnrichedFields(detail);

        updates.push({
          id: statsRow.id,
          pet_levels: enriched.petLevels,
          builder_hall_level: enriched.builderHallLevel,
          versus_trophies: enriched.versusTrophies,
          versus_battle_wins: enriched.versusBattleWins,
          builder_league_id: enriched.builderLeagueId,
          war_stars: enriched.warStars,
          attack_wins: enriched.attackWins,
          defense_wins: enriched.defenseWins,
          capital_contributions: enriched.capitalContributions,
          max_troop_count: enriched.maxTroopCount,
          max_spell_count: enriched.maxSpellCount,
          super_troops_active: enriched.superTroopsActive,
          achievement_count: enriched.achievementCount,
          achievement_score: enriched.achievementScore,
          exp_level: enriched.expLevel,
          best_trophies: enriched.bestTrophies,
          best_versus_trophies: enriched.bestVersusTrophies,
        });
      }

      console.log(`   📝 Prepared ${updates.length} updates`);

      if (options.execute && updates.length > 0) {
        // Execute the updates
        const { error: updateError } = await supabase
          .from('member_snapshot_stats')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          console.error(`   ❌ Failed to update stats:`, updateError.message);
          stats.errors++;
          continue;
        }

        console.log(`   ✅ Updated ${updates.length} member stats`);
        stats.membersUpdated += updates.length;
      } else if (!options.execute && updates.length > 0) {
        // Dry run - show sample
        console.log(`   👁️  DRY RUN - Would update ${updates.length} rows`);
        console.log(`   Sample enriched data for first member:`);
        const sample = updates[0];
        console.log(`      pet_levels: ${sample.pet_levels ? JSON.stringify(sample.pet_levels).substring(0, 50) : 'null'}`);
        console.log(`      builder_hall_level: ${sample.builder_hall_level}`);
        console.log(`      war_stars: ${sample.war_stars}`);
        console.log(`      achievement_count: ${sample.achievement_count}`);
        console.log(`      exp_level: ${sample.exp_level}`);
      }

      stats.snapshotsProcessed++;
      const snapshotDuration = Date.now() - snapshotStartTime;
      console.log(`   ⏱️  Snapshot processed in ${snapshotDuration}ms`);

    } catch (error: any) {
      console.error(`   ❌ Error processing snapshot:`, error.message);
      stats.errors++;
    }
  }

  stats.duration = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary');
  console.log('='.repeat(60));
  console.log(`   Mode: ${options.execute ? '🔥 EXECUTED' : '👁️  DRY RUN'}`);
  console.log(`   Snapshots Processed: ${stats.snapshotsProcessed}`);
  console.log(`   Members Updated: ${stats.membersUpdated}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Duration: ${(stats.duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));

  if (!options.execute) {
    console.log('\n💡 This was a dry run. Add --execute to apply changes.');
  }

  return stats;
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  const options: BackfillOptions = {
    execute: args.includes('--execute'),
    limit: undefined,
    startDate: undefined,
    endDate: undefined,
  };

  // Parse limit
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    options.limit = parseInt(limitArg.split('=')[1], 10);
  }

  // Parse start date
  const startDateArg = args.find(arg => arg.startsWith('--start-date='));
  if (startDateArg) {
    options.startDate = startDateArg.split('=')[1];
  }

  // Parse end date
  const endDateArg = args.find(arg => arg.startsWith('--end-date='));
  if (endDateArg) {
    options.endDate = endDateArg.split('=')[1];
  }

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Backfill Enriched Data Script

Usage:
  npm run backfill-enriched-data [options]

Options:
  --execute              Execute the backfill (default: dry run)
  --limit=N              Process only N snapshots
  --start-date=YYYY-MM-DD  Process snapshots from this date onwards
  --end-date=YYYY-MM-DD    Process snapshots up to this date
  --help, -h             Show this help message

Examples:
  # Dry run - preview first 5 snapshots
  npm run backfill-enriched-data --limit=5

  # Execute backfill for October 2025
  npm run backfill-enriched-data --execute --start-date=2025-10-01 --end-date=2025-10-31

  # Execute full backfill
  npm run backfill-enriched-data --execute
    `);
    process.exit(0);
  }

  try {
    await backfillEnrichedData(options);
    process.exit(0);
  } catch (error: any) {
    console.error('\n💥 Backfill failed:', error.message);
    process.exit(1);
  }
}

main();

