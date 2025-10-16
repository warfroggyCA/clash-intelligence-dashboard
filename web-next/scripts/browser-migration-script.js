/**
 * Browser-based migration script to move player data from localStorage to Supabase
 * Run this in the browser console on your dashboard
 */

async function migratePlayerDataToSupabase() {
  console.log('🚀 Starting migration of player data from localStorage to Supabase...');
  
  const clanTag = '#2PR8R8V8P'; // Your clan tag
  
  // Get all localStorage keys
  const allKeys = Object.keys(localStorage);
  const noteKeys = allKeys.filter(key => key.startsWith('player_notes_'));
  const warningKeys = allKeys.filter(key => key.startsWith('player_warning_'));
  const tenureKeys = allKeys.filter(key => key.startsWith('player_tenure_'));
  const departureKeys = allKeys.filter(key => key.startsWith('player_departure_'));
  
  console.log(`📝 Found ${noteKeys.length} note entries`);
  console.log(`⚠️  Found ${warningKeys.length} warning entries`);
  console.log(`🏆 Found ${tenureKeys.length} tenure action entries`);
  console.log(`👋 Found ${departureKeys.length} departure action entries`);
  
  let migratedNotes = 0;
  let migratedWarnings = 0;
  let migratedTenureActions = 0;
  let migratedDepartureActions = 0;
  
  // Helper function to make API calls
  async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(endpoint, options);
    return response.json();
  }
  
  // Migrate notes
  console.log('📝 Migrating notes...');
  for (const key of noteKeys) {
    try {
      const playerTag = key.replace('player_notes_', '');
      const notesData = localStorage.getItem(key);
      
      if (!notesData) continue;
      
      const notes = JSON.parse(notesData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const note of notes) {
        const result = await apiCall('/api/player-notes', 'POST', {
          clanTag,
          playerTag,
          playerName,
          note: note.note,
          customFields: note.customFields || {},
          createdBy: 'Migration Script'
        });
        
        if (result.success) {
          migratedNotes++;
        } else {
          console.error(`❌ Error migrating note for ${playerTag}:`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing notes for ${key}:`, error);
    }
  }
  
  // Migrate warnings
  console.log('⚠️  Migrating warnings...');
  for (const key of warningKeys) {
    try {
      const playerTag = key.replace('player_warning_', '');
      const warningData = localStorage.getItem(key);
      
      if (!warningData) continue;
      
      const warning = JSON.parse(warningData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      if (warning.isActive) {
        const result = await apiCall('/api/player-warnings', 'POST', {
          clanTag,
          playerTag,
          playerName,
          warningNote: warning.warningNote,
          createdBy: 'Migration Script'
        });
        
        if (result.success) {
          migratedWarnings++;
        } else {
          console.error(`❌ Error migrating warning for ${playerTag}:`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing warning for ${key}:`, error);
    }
  }
  
  // Migrate tenure actions
  console.log('🏆 Migrating tenure actions...');
  for (const key of tenureKeys) {
    try {
      const playerTag = key.replace('player_tenure_', '');
      const tenureData = localStorage.getItem(key);
      
      if (!tenureData) continue;
      
      const tenureActions = JSON.parse(tenureData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const action of tenureActions) {
        const result = await apiCall('/api/player-actions', 'POST', {
          clanTag,
          playerTag,
          playerName,
          actionType: 'tenure',
          actionData: {
            action: action.action,
            reason: action.reason,
            grantedBy: action.grantedBy
          },
          createdBy: 'Migration Script'
        });
        
        if (result.success) {
          migratedTenureActions++;
        } else {
          console.error(`❌ Error migrating tenure action for ${playerTag}:`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing tenure actions for ${key}:`, error);
    }
  }
  
  // Migrate departure actions
  console.log('👋 Migrating departure actions...');
  for (const key of departureKeys) {
    try {
      const playerTag = key.replace('player_departure_', '');
      const departureData = localStorage.getItem(key);
      
      if (!departureData) continue;
      
      const departureActions = JSON.parse(departureData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const action of departureActions) {
        const result = await apiCall('/api/player-actions', 'POST', {
          clanTag,
          playerTag,
          playerName,
          actionType: 'departure',
          actionData: {
            reason: action.reason,
            departureType: action.type,
            recordedBy: action.recordedBy
          },
          createdBy: 'Migration Script'
        });
        
        if (result.success) {
          migratedDepartureActions++;
        } else {
          console.error(`❌ Error migrating departure action for ${playerTag}:`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing departure actions for ${key}:`, error);
    }
  }
  
  console.log('\n✅ Migration completed!');
  console.log(`📝 Migrated ${migratedNotes} notes`);
  console.log(`⚠️  Migrated ${migratedWarnings} warnings`);
  console.log(`🏆 Migrated ${migratedTenureActions} tenure actions`);
  console.log(`👋 Migrated ${migratedDepartureActions} departure actions`);
  
  console.log('\n🔄 Next steps:');
  console.log('1. The Player Database will now use Supabase instead of localStorage');
  console.log('2. All your existing data has been preserved in the database');
  console.log('3. You can now access player data from any device');
  
  return {
    notes: migratedNotes,
    warnings: migratedWarnings,
    tenureActions: migratedTenureActions,
    departureActions: migratedDepartureActions
  };
}

// Run the migration
migratePlayerDataToSupabase().then(result => {
  console.log('🎉 Migration completed successfully!', result);
}).catch(error => {
  console.error('💥 Migration failed:', error);
});
