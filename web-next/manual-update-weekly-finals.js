const { getSupabaseAdminClient } = require('./src/lib/supabase-admin.ts');

async function updateWeeklyFinals() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Getting member ID for warfroggy...');
  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('id, tag')
    .eq('tag', '#G9QVRYC2Y');
    
  if (memberError || !memberRows?.length) {
    console.error('Error fetching member:', memberError);
    return;
  }
  
  const memberId = memberRows[0].id;
  console.log('Member ID:', memberId);
  
  // Find the snapshot for week ending Oct 13 (should be around Oct 13)
  console.log('\nFinding snapshot for week ending Oct 13...');
  const { data: oct13Snapshots, error: oct13Error } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-13T00:00:00Z')
    .lte('snapshot_date', '2025-10-13T23:59:59Z')
    .order('snapshot_date', { ascending: false });
    
  if (oct13Error) {
    console.error('Error fetching Oct 13 snapshots:', oct13Error);
    return;
  }
  
  console.log('Oct 13 snapshots:', oct13Snapshots);
  
  // Find the snapshot for week ending Oct 20 (should be around Oct 20)
  console.log('\nFinding snapshot for week ending Oct 20...');
  const { data: oct20Snapshots, error: oct20Error } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-20T00:00:00Z')
    .lte('snapshot_date', '2025-10-20T23:59:59Z')
    .order('snapshot_date', { ascending: false });
    
  if (oct20Error) {
    console.error('Error fetching Oct 20 snapshots:', oct20Error);
    return;
  }
  
  console.log('Oct 20 snapshots:', oct20Snapshots);
  
  // Update Oct 13 week (should be 408)
  if (oct13Snapshots && oct13Snapshots.length > 0) {
    const snapshot = oct13Snapshots[0];
    console.log(`\nUpdating Oct 13 snapshot ${snapshot.snapshot_id} to 408 trophies...`);
    const { error: update13Error } = await supabase
      .from('member_snapshot_stats')
      .update({ ranked_trophies: 408 })
      .eq('member_id', memberId)
      .eq('snapshot_id', snapshot.snapshot_id);
      
    if (update13Error) {
      console.error('Error updating Oct 13:', update13Error);
    } else {
      console.log('✅ Updated Oct 13 to 408 trophies');
    }
  }
  
  // Update Oct 20 week (should be 486)
  if (oct20Snapshots && oct20Snapshots.length > 0) {
    const snapshot = oct20Snapshots[0];
    console.log(`\nUpdating Oct 20 snapshot ${snapshot.snapshot_id} to 486 trophies...`);
    const { error: update20Error } = await supabase
      .from('member_snapshot_stats')
      .update({ ranked_trophies: 486 })
      .eq('member_id', memberId)
      .eq('snapshot_id', snapshot.snapshot_id);
      
    if (update20Error) {
      console.error('Error updating Oct 20:', update20Error);
    } else {
      console.log('✅ Updated Oct 20 to 486 trophies');
    }
  }
  
  console.log('\nManual update completed!');
}

updateWeeklyFinals().catch(console.error);
