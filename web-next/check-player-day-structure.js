const { getSupabaseAdminClient } = require('./src/lib/supabase-admin.ts');

async function checkStructure() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Checking player_day structure for warfroggy...');
  const { data, error } = await supabase
    .from('player_day')
    .select('*')
    .eq('player_tag', '#G9QVRYC2Y')
    .gte('date', '2025-10-13')
    .lte('date', '2025-10-20')
    .order('date')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Sample player_day record structure:');
  console.log(JSON.stringify(data?.[0], null, 2));
}

checkStructure().catch(console.error);
