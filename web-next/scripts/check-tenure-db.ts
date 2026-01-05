import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

async function check() {
  const [{ getSupabaseAdminClient }, { normalizeTag }] = await Promise.all([
    import('../src/lib/supabase-admin'),
    import('../src/lib/tags'),
  ]);
  
  const supabase = getSupabaseAdminClient();
  
  // Check War.Frog's tenure in members table
  console.log('=== Checking War.Frog (#UL0LRJ02) ===\n');
  
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('tag, name, tenure_days, tenure_as_of')
    .eq('tag', '#UL0LRJ02')
    .single();
  
  if (memberErr) {
    console.error('❌ Members table error:', memberErr.message);
  } else {
    console.log('📋 Members table:');
    console.log(`   Name: ${member.name}`);
    console.log(`   Tag: ${member.tag}`);
    console.log(`   tenure_days: ${member.tenure_days}`);
    console.log(`   tenure_as_of: ${member.tenure_as_of}`);
  }
  
  console.log('\n');
  
  // Check latest canonical snapshot (order by created_at to get truly latest)
  const { data: canonical, error: canonicalErr } = await supabase
    .from('canonical_member_snapshots')
    .select('payload, snapshot_date, created_at, snapshot_id')
    .eq('player_tag', '#UL0LRJ02')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (canonicalErr) {
    console.error('❌ Canonical snapshot error:', canonicalErr.message);
  } else if (canonical && canonical.length > 0) {
    console.log(`📸 Latest ${canonical.length} canonical snapshots (by created_at):`);
    for (const row of canonical) {
      console.log(`\n   Snapshot ID: ${row.snapshot_id}`);
      console.log(`   Snapshot date: ${row.snapshot_date}`);
      console.log(`   Created at: ${row.created_at}`);
      console.log(`   Tenure in payload: ${JSON.stringify(row.payload?.member?.tenure)}`);
    }
  } else {
    console.log('⚠️  No canonical snapshots found');
  }
  
  console.log('\n');
  
  // Check BrenBren123 too
  console.log('=== Checking BrenBren123 (#LCJPY8QJY) ===\n');
  
  const { data: bren, error: brenErr } = await supabase
    .from('members')
    .select('tag, name, tenure_days, tenure_as_of')
    .eq('tag', '#LCJPY8QJY')
    .single();
  
  if (brenErr) {
    console.error('❌ Members table error:', brenErr.message);
  } else {
    console.log('📋 Members table:');
    console.log(`   Name: ${bren.name}`);
    console.log(`   Tag: ${bren.tag}`);
    console.log(`   tenure_days: ${bren.tenure_days}`);
    console.log(`   tenure_as_of: ${bren.tenure_as_of}`);
  }
  
  const { data: brenCanonical, error: brenCanonicalErr } = await supabase
    .from('canonical_member_snapshots')
    .select('payload, snapshot_date, created_at, snapshot_id')
    .eq('player_tag', '#LCJPY8QJY')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (brenCanonicalErr) {
    console.error('❌ Canonical snapshot error:', brenCanonicalErr.message);
  } else if (brenCanonical && brenCanonical.length > 0) {
    console.log(`\n📸 Latest ${brenCanonical.length} canonical snapshots (by created_at):`);
    for (const row of brenCanonical) {
      console.log(`\n   Snapshot ID: ${row.snapshot_id}`);
      console.log(`   Snapshot date: ${row.snapshot_date}`);
      console.log(`   Created at: ${row.created_at}`);
      console.log(`   Tenure in payload: ${JSON.stringify(row.payload?.member?.tenure)}`);
    }
  } else {
    console.log('⚠️  No canonical snapshots found');
  }
}

async function checkSnapshotStats() {
  const [{ getSupabaseAdminClient }, { normalizeTag }] = await Promise.all([
    import('../src/lib/supabase-admin'),
    import('../src/lib/tags'),
  ]);
  
  const supabase = getSupabaseAdminClient();
  
  // Get clan ID first
  const { data: clanRow } = await supabase
    .from('clans')
    .select('id')
    .eq('tag', '#2PR8R8V8P')
    .single();
    
  if (!clanRow) {
    console.log('⚠️  Clan not found');
    return;
  }
  
  console.log('\n=== Checking ALL roster_snapshots ===\n');
  
  // Get ALL snapshots for this clan, ordered by fetched_at desc
  const { data: allSnapshots } = await supabase
    .from('roster_snapshots')
    .select('id, fetched_at, member_count')
    .eq('clan_id', clanRow.id)
    .order('fetched_at', { ascending: false })
    .limit(10);
    
  if (!allSnapshots || allSnapshots.length === 0) {
    console.log('⚠️  No snapshots found');
    return;
  }
  
  console.log(`Found ${allSnapshots.length} snapshots:`);
  for (const snap of allSnapshots) {
    console.log(`  - ${snap.id} @ ${snap.fetched_at} (${snap.member_count} members)`);
  }
  
  const latestSnapshot = allSnapshots[0];
  console.log(`\n🎯 Latest snapshot: ${latestSnapshot.id}`);
  
  // Get member ID for War.Frog
  const { data: member } = await supabase
    .from('members')
    .select('id, tag, name')
    .eq('tag', '#UL0LRJ02')
    .single();
    
  if (!member) {
    console.log('⚠️  War.Frog not found in members table');
    return;
  }
  
  console.log(`Member ID: ${member.id}`);
  
  // Get stats for this member in EACH snapshot
  console.log('\n📊 tenure_days per snapshot for War.Frog:');
  for (const snap of allSnapshots.slice(0, 5)) {
    const { data: stats } = await supabase
      .from('member_snapshot_stats')
      .select('tenure_days, tenure_as_of')
      .eq('snapshot_id', snap.id)
      .eq('member_id', member.id)
      .maybeSingle();
      
    console.log(`  - ${snap.id.slice(0,8)}... @ ${snap.fetched_at}: tenure_days=${stats?.tenure_days ?? 'NULL'}`);
  }
}

check()
  .then(() => checkSnapshotStats())
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });

