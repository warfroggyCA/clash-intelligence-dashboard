const { getSupabaseAdminClient } = require('./src/lib/supabase-admin.ts');

async function checkData() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Checking October player_day data for warfroggy...');
  const { data: playerDayData, error: playerDayError } = await supabase
    .from('player_day')
    .select('player_tag, date, trophies')
    .eq('player_tag', '#G9QVRYC2Y')
    .gte('date', '2025-10-01')
    .order('date');
    
  if (playerDayError) {
    console.error('Error fetching player_day:', playerDayError);
    return;
  }
  
  console.log('October player_day data:');
  console.log(JSON.stringify(playerDayData, null, 2));
  
  console.log('\nChecking member_snapshot_stats for October...');
  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('id, tag')
    .eq('tag', '#G9QVRYC2Y');
    
  if (memberError || !memberRows?.length) {
    console.error('Error fetching member:', memberError);
    return;
  }
  
  const memberId = memberRows[0].id;
  const { data: snapshotData, error: snapshotError } = await supabase
    .from('member_snapshot_stats')
    .select('snapshot_id, snapshot_date, ranked_trophies, trophies')
    .eq('member_id', memberId)
    .gte('snapshot_date', '2025-10-01')
    .order('snapshot_date');
    
  if (snapshotError) {
    console.error('Error fetching member_snapshot_stats:', snapshotError);
    return;
  }
  
  console.log('October member_snapshot_stats data:');
  console.log(JSON.stringify(snapshotData, null, 2));
}

checkData().catch(console.error);
