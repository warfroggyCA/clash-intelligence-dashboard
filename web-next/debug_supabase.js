const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Debug Supabase Connection');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuery() {
  try {
    console.log('\n📊 Querying clan_snapshots table...');
    
    const { data, error } = await supabase
      .from('clan_snapshots')
      .select('clan_tag, snapshot_date, fetched_at, player_details')
      .eq('clan_tag', '2pr8r8v8p')
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log('✅ Query successful');
    console.log('Records returned:', data?.length || 0);
    
    if (data && data.length > 0) {
      const record = data[0];
      console.log('\n📋 First record:');
      console.log('- clan_tag:', record.clan_tag);
      console.log('- snapshot_date:', record.snapshot_date);
      console.log('- fetched_at:', record.fetched_at);
      console.log('- player_details type:', typeof record.player_details);
      console.log('- player_details is null:', record.player_details === null);
      console.log('- player_details is undefined:', record.player_details === undefined);
      
      if (record.player_details) {
        const keys = Object.keys(record.player_details);
        console.log('- player_details keys count:', keys.length);
        console.log('- first 5 keys:', keys.slice(0, 5));
        
        // Check if our target player exists
        const targetKey = '#UU9GJ9QQ';
        const hasTarget = targetKey in record.player_details;
        console.log(`- contains "${targetKey}":`, hasTarget);
        
        if (hasTarget) {
          console.log(`- "${targetKey}" data:`, JSON.stringify(record.player_details[targetKey], null, 2));
        }
      } else {
        console.log('❌ player_details is null/undefined');
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugQuery();