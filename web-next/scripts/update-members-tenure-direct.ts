/**
 * Directly update members table with tenure values from the backfill data
 * 
 * This script bypasses the ledger and directly updates the members table
 * with the correct tenure values from the backfill script data.
 * 
 * Usage: tsx scripts/update-members-tenure-direct.ts
 */

import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

// Same data structure as the backfill script
interface MemberTenureData {
  tag: string;
  name: string;
  totalTenureDays: number;
}

const members: MemberTenureData[] = [
  { tag: '#LCJPY8QJY', name: 'BrenBren123', totalTenureDays: 122 },
  { tag: '#YYVUCPQ90', name: 'CosmicThomas', totalTenureDays: 655 },
  { tag: '#QV8R2GGY9', name: 'Deter', totalTenureDays: 32 },
  { tag: '#VGQVRLRL', name: 'DoubleD', totalTenureDays: 545 },
  { tag: '#Q9UP8YG99', name: 'Eren-y173', totalTenureDays: 33 },
  { tag: '#299PGYLG', name: 'flame', totalTenureDays: 44 },
  { tag: '#GLVJJQRJJ', name: 'Ghetto', totalTenureDays: 10 },
  { tag: '#9VCJVUGV', name: 'God Of LOYINS', totalTenureDays: 44 },
  { tag: '#GPYCPQV8J', name: 'Headhuntress', totalTenureDays: 635 },
  { tag: '#GCQPGVUYP', name: 'Isi', totalTenureDays: 43 },
  { tag: '#L9GJ0PJQ', name: 'Ozymandias', totalTenureDays: 6 },
  { tag: '#QUV0R9080', name: 'Powerful-PB', totalTenureDays: 38 },
  { tag: '#YUGUL9JJ0', name: 'se', totalTenureDays: 389 },
  { tag: '#L99VQ8GQ0', name: 'STICKS', totalTenureDays: 39 },
  { tag: '#G09GGYC2Y', name: 'Tigress', totalTenureDays: 792 },
  { tag: '#UL0LRJ02', name: 'War.Frog', totalTenureDays: 852 },
  { tag: '#G9QVRYC2Y', name: 'warfroggy', totalTenureDays: 851 },
  { tag: '#G8GCC8GGC', name: 'Zouboul', totalTenureDays: 713 },
];

async function main() {
  const [{ getSupabaseAdminClient }, { normalizeTag }, { cfg }, { ymdNowUTC }] = await Promise.all([
    import('../src/lib/supabase-admin'),
    import('../src/lib/tags'),
    import('../src/lib/config'),
    import('../src/lib/date'),
  ]);

  console.log('🔄 Directly updating members table with tenure values...\n');

  if (!cfg.useSupabase || !cfg.database.serviceRoleKey) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const supabase = getSupabaseAdminClient();
  const today = ymdNowUTC();

  // Get clan_id from clan_tag
  const clanTag = cfg.homeClanTag;
  if (!clanTag) {
    console.error('❌ No clan tag configured');
    process.exit(1);
  }

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

  // Create a map of tag -> tenure for quick lookup
  const tenureMap = new Map<string, number>();
  for (const member of members) {
    const tag = normalizeTag(member.tag);
    if (tag) {
      tenureMap.set(tag, member.totalTenureDays);
    }
  }

  console.log(`📋 Updating ${members.length} members with direct tenure values\n`);

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

    const tenureDays = member.totalTenureDays;

    // Find the member in the database - try both normalized and raw tag
    console.log(`🔍 Looking for ${member.name} with tag: "${playerTag}" (raw: "${member.tag}")`);
    
    let memberRow = null;
    let findError = null;
    
    // Try normalized tag first
    const result1 = await supabase
      .from('members')
      .select('id, tag, name, tenure_days, tenure_as_of')
      .eq('clan_id', clanRow.id)
      .eq('tag', playerTag)
      .maybeSingle();
    
    if (result1.data) {
      memberRow = result1.data;
      console.log(`   Found with normalized tag: ${memberRow.tag}`);
    } else {
      // Try raw tag
      const result2 = await supabase
        .from('members')
        .select('id, tag, name, tenure_days, tenure_as_of')
        .eq('clan_id', clanRow.id)
        .eq('tag', member.tag)
        .maybeSingle();
      
      if (result2.data) {
        memberRow = result2.data;
        console.log(`   Found with raw tag: ${memberRow.tag}`);
      } else {
        findError = result1.error || result2.error;
      }
    }

    if (findError) {
      console.error(`  ❌ Error finding ${member.name}: ${findError.message}\n`);
      errorCount++;
      continue;
    }

    if (!memberRow) {
      // List all members for debugging
      const { data: allMembers } = await supabase
        .from('members')
        .select('tag, name')
        .eq('clan_id', clanRow.id)
        .limit(5);
      console.log(`   Sample members in DB:`, allMembers?.map(m => m.tag));
      console.warn(`⚠️  Member not found: ${member.name} (${playerTag})\n`);
      skippedCount++;
      continue;
    }

    console.log(`   Current DB values: tenure_days=${memberRow.tenure_days}, tenure_as_of=${memberRow.tenure_as_of}`);
    console.log(`   Will update to: tenure_days=${tenureDays}, tenure_as_of=${today}`);

    const { data: updateData, error: updateError, count } = await supabase
      .from('members')
      .update({
        tenure_days: tenureDays,
        tenure_as_of: today,
      })
      .eq('id', memberRow.id)
      .select('tenure_days, tenure_as_of');

    if (updateError) {
      console.error(`  ❌ Error: ${updateError.message}\n`);
      errorCount++;
    } else {
      console.log(`  ✅ Updated! New values:`, updateData);
      updatedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updatedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total: ${members.length}`);

  if (updatedCount > 0) {
    console.log('\n✨ Members table updated with direct tenure values!');
    console.log('   Run another ingestion to update roster snapshots.');
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

