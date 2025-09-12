const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://blzugbsexkrreytesngw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsenVnYnNleGtycmV5dGVzbmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTIzOTAsImV4cCI6MjA3MzEyODM5MH0.to4SqVjWNRNEhI3QPs_dWqnyFx8jf51N6vedAw_PRLY';

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function migrateFullSnapshots() {
  const snapshotsDir = path.join(__dirname, '..', 'out', 'snapshots');
  
  try {
    const files = fs.readdirSync(snapshotsDir);
    const snapshotFiles = files.filter(f => f.startsWith('2pr8r8v8p') && f.endsWith('.json'));
    
    console.log(`Found ${snapshotFiles.length} snapshot files to migrate with full data`);
    
    for (const file of snapshotFiles) {
      const filePath = path.join(snapshotsDir, file);
      const snapshotData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Extract date from filename (2pr8r8v8p_2025-09-11.json)
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      
      const date = dateMatch[1];
      const timestamp = new Date(date + 'T00:00:00Z').toISOString();
      
      // Store the full snapshot data as JSON in Supabase
      const supabaseData = {
        clan_tag: '2pr8r8v8p',
        filename: file,
        date: date,
        member_count: snapshotData.members?.length || 0,
        clan_name: snapshotData.clanName || 'Unknown',
        timestamp: timestamp,
        file_url: `data:application/json;base64,${Buffer.from(JSON.stringify(snapshotData)).toString('base64')}`, // Store full data as base64
        created_at: timestamp
      };
      
      console.log(`Migrating ${file} (${date}) with ${supabaseData.member_count} members and full data`);
      
      // Insert into Supabase
      const { error } = await supabase
        .from('snapshots')
        .upsert(supabaseData, { onConflict: 'filename' });
      
      if (error) {
        console.error(`Error inserting ${file}:`, error);
      } else {
        console.log(`✅ Successfully migrated ${file} with full data`);
      }
    }
    
    console.log('Full snapshot migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateFullSnapshots();
