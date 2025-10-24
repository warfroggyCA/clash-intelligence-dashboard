const { getSupabaseAdminClient } = require('./src/lib/supabase-admin.ts');

async function verifyUpdates() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Verifying database updates...');
  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('id, tag')
    .eq('tag', '#G9QVRYC2Y');
    
  if (memberError || !memberRows?.length) {
    console.error('Error fetching member:', memberError);
    return;
  }
  
  const memberId = memberRows[0].id;
  
  // Check Oct 13 week
  const { data: oct13Data, error: oct13Error } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-13T00:00:00Z')
    .lte('snapshot_date', '2025-10-13T23:59:59Z')
    .order('snapshot_date', { ascending: false })
    .limit(1);
    
  console.log('Oct 13 week data:', oct13Data);
  
  // Check Oct 20 week  
  const { data: oct20Data, error: oct20Error } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-20T00:00:00Z')
    .lte('snapshot_date', '2025-10-20T23:59:59Z')
    .order('snapshot_date', { ascending: false })
    .limit(1);
    
  console.log('Oct 20 week data:', oct20Data);
  
  // Check all recent snapshots
  const { data: allRecent, error: allError } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-01')
    .order('snapshot_date', { ascending: false });
    
  console.log('\nAll recent snapshots with ranked_trophies:');
  allRecent?.filter(s => s.ranked_trophies != null).forEach(s => {
    console.log(`${s.snapshot_date}: ${s.ranked_trophies} trophies`);
  });
}

verifyUpdates().catch(console.error);
