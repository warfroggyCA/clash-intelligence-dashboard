/**
 * Update members table with tenure values from the ledger
 * 
 * This script directly updates the `members` table in Supabase with tenure values
 * from the tenure ledger, bypassing the ingestion's priority logic.
 * 
 * Usage: tsx scripts/update-members-tenure.ts
 */

import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

async function main() {
  const [{ getSupabaseAdminClient }, { readTenureDetails }, { normalizeTag }, { cfg }, { ymdNowUTC }] = await Promise.all([
    import('../src/lib/supabase-admin'),
    import('../src/lib/tenure'),
    import('../src/lib/tags'),
    import('../src/lib/config'),
    import('../src/lib/date'),
  ]);

  console.log('🔄 Updating members table with tenure from ledger...\n');

  if (!cfg.useSupabase || !cfg.database.serviceRoleKey) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const supabase = getSupabaseAdminClient();
  const today = ymdNowUTC();

  // Read tenure from ledger
  console.log('📖 Reading tenure ledger...');
  const tenureDetails = await readTenureDetails(today);
  console.log(`   Found ${Object.keys(tenureDetails).length} players in ledger\n`);

  // Get all current members
  const clanTag = cfg.homeClanTag;
  if (!clanTag) {
    console.error('❌ No clan tag configured');
    process.exit(1);
  }

  // Get clan_id from clan_tag
  const normalizedClanTag = normalizeTag(clanTag) || clanTag;
  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .select('id')
    .eq('tag', normalizedClanTag)
    .single();

  if (clanError || !clanRow) {
    console.error('❌ Failed to find clan:', clanError?.message || 'Clan not found');
    process.exit(1);
  }

  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, tag, name')
    .eq('clan_id', clanRow.id);

  if (membersError) {
    console.error('❌ Failed to fetch members:', membersError.message);
    process.exit(1);
  }

  if (!members || members.length === 0) {
    console.log('⚠️  No members found');
    process.exit(0);
  }

  console.log(`📋 Found ${members.length} current members\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const member of members) {
    const playerTag = normalizeTag(member.tag);
    if (!playerTag) {
      console.warn(`⚠️  Skipping member with invalid tag: ${member.tag}`);
      skippedCount++;
      continue;
    }

    const tenureEntry = tenureDetails[playerTag];
    if (!tenureEntry || typeof tenureEntry.days !== 'number') {
      console.warn(`⚠️  No tenure data for ${member.name || playerTag} (${playerTag})`);
      skippedCount++;
      continue;
    }

    const tenureDays = Math.max(1, Math.round(tenureEntry.days));
    const tenureAsOf = tenureEntry.as_of || today;

    console.log(`Updating ${member.name || playerTag} (${playerTag}):`);
    console.log(`  Tenure: ${tenureDays} days (as of ${tenureAsOf})`);

    const { error: updateError } = await supabase
      .from('members')
      .update({
        tenure_days: tenureDays,
        tenure_as_of: tenureAsOf,
      })
      .eq('id', member.id);

    if (updateError) {
      console.error(`  ❌ Error: ${updateError.message}\n`);
      errorCount++;
    } else {
      console.log(`  ✅ Updated\n`);
      updatedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updatedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total: ${members.length}`);

  if (updatedCount > 0) {
    console.log('\n✨ Members table updated!');
    console.log('   Run another ingestion to update roster snapshots with the new tenure values.');
  }
}

main()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

