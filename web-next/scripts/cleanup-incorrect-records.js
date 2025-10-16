#!/usr/bin/env node

/**
 * Script to clean up incorrect Supabase records that were created with today's timestamp
 * for players who actually departed on September 9, 2025
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupIncorrectRecords() {
  console.log('🧹 Starting cleanup of incorrect Supabase records...');
  
  try {
    // Get all players who departed on September 9, 2025 (based on localStorage data)
    const departedPlayers = [
      '#P20VPVL08', // Muawiyah
      '#LCJ8CPY9R', // Gambit
      '#PC2LRQ0C0', // Big Papa
      '#QYC29RU90', // Fronton Zakolee
      '#QCQQJCJGY', // Boxer
      '#YVY8V08Y8', // ~{NoMad}~
      '#G0Y8UCU9Y', // SURYA Brock
      '#P0RPC2LQU', // WinTer SolDier
      '#LRLUU9PRJ', // Akash
      '#LLRGPPPUJ', // leo
      '#Q8VCCJVJ9', // pranav. pro
      '#GP0YG2999', // king
      '#LYP9QC80R', // e❤️jonah
      '#2QVLYC000', // Rafin Osman
      '#Q8C02CYU2', // BlackPillow
      '#G2R2GG928', // Ralex
      '#QC28JY9PG', // Sasta Hacker
      '#Q902PY02',  // Unknown Player
      '#QCRVR2CPU', // bob
      '#TEST123',   // Test Player
      '#TEST456',   // Test Player 2
      '#TEST789'    // Test Player 3
    ];

    const today = new Date().toISOString().split('T')[0]; // 2025-10-16
    console.log(`📅 Looking for records created on ${today} for departed players...`);

    // Clean up incorrect notes
    console.log('\n📝 Cleaning up incorrect notes...');
    for (const playerTag of departedPlayers) {
      const { data: notes, error: notesError } = await supabase
        .from('player_notes')
        .select('*')
        .eq('player_tag', playerTag)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      if (notesError) {
        console.error(`❌ Error fetching notes for ${playerTag}:`, notesError);
        continue;
      }

      if (notes && notes.length > 0) {
        console.log(`  🗑️  Found ${notes.length} incorrect notes for ${playerTag}:`);
        notes.forEach(note => {
          console.log(`    - ${note.note} (${note.created_by})`);
        });

        // Delete the incorrect notes
        const { error: deleteError } = await supabase
          .from('player_notes')
          .delete()
          .eq('player_tag', playerTag)
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59`);

        if (deleteError) {
          console.error(`❌ Error deleting notes for ${playerTag}:`, deleteError);
        } else {
          console.log(`  ✅ Deleted ${notes.length} incorrect notes for ${playerTag}`);
        }
      }
    }

    // Clean up incorrect departure actions
    console.log('\n🎬 Cleaning up incorrect departure actions...');
    for (const playerTag of departedPlayers) {
      const { data: departureActions, error: departureError } = await supabase
        .from('player_departure_actions')
        .select('*')
        .eq('player_tag', playerTag)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      if (departureError) {
        console.error(`❌ Error fetching departure actions for ${playerTag}:`, departureError);
        continue;
      }

      if (departureActions && departureActions.length > 0) {
        console.log(`  🗑️  Found ${departureActions.length} incorrect departure actions for ${playerTag}:`);
        departureActions.forEach(action => {
          console.log(`    - departure: ${action.reason} (${action.created_by})`);
        });

        // Delete the incorrect departure actions
        const { error: deleteError } = await supabase
          .from('player_departure_actions')
          .delete()
          .eq('player_tag', playerTag)
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59`);

        if (deleteError) {
          console.error(`❌ Error deleting departure actions for ${playerTag}:`, deleteError);
        } else {
          console.log(`  ✅ Deleted ${departureActions.length} incorrect departure actions for ${playerTag}`);
        }
      }
    }

    // Clean up incorrect tenure actions
    console.log('\n🎬 Cleaning up incorrect tenure actions...');
    for (const playerTag of departedPlayers) {
      const { data: tenureActions, error: tenureError } = await supabase
        .from('player_tenure_actions')
        .select('*')
        .eq('player_tag', playerTag)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      if (tenureError) {
        console.error(`❌ Error fetching tenure actions for ${playerTag}:`, tenureError);
        continue;
      }

      if (tenureActions && tenureActions.length > 0) {
        console.log(`  🗑️  Found ${tenureActions.length} incorrect tenure actions for ${playerTag}:`);
        tenureActions.forEach(action => {
          console.log(`    - tenure: ${action.action} - ${action.reason} (${action.created_by})`);
        });

        // Delete the incorrect tenure actions
        const { error: deleteError } = await supabase
          .from('player_tenure_actions')
          .delete()
          .eq('player_tag', playerTag)
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59`);

        if (deleteError) {
          console.error(`❌ Error deleting tenure actions for ${playerTag}:`, deleteError);
        } else {
          console.log(`  ✅ Deleted ${tenureActions.length} incorrect tenure actions for ${playerTag}`);
        }
      }
    }

    console.log('\n🎉 Cleanup completed successfully!');
    console.log('💡 The incorrect records have been removed from Supabase.');
    console.log('🔄 You can now remove the filter logic from the frontend code.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupIncorrectRecords();
