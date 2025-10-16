/**
 * Browser-based localStorage to Supabase Migration
 * 
 * Run this in your browser console on the player database page
 * to migrate all localStorage data to Supabase.
 */

async function migrateLocalStorageToSupabase() {
  console.log('🚀 Starting localStorage to Supabase Migration...');
  
  const CLAN_TAG = '#2PR8R8V8P';
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // Helper function to make API calls
  async function makeApiCall(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(endpoint, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`API Error: ${result.error || response.statusText}`);
      }
      
      return result;
    } catch (error) {
      console.error(`API call failed: ${error.message}`);
      throw error;
    }
  }
  
  // Helper function to check if data already exists
  async function checkIfExists(endpoint) {
    try {
      const result = await makeApiCall(endpoint);
      return result.data || [];
    } catch (error) {
      console.warn(`Could not check existing data: ${error.message}`);
      return [];
    }
  }
  
  // 1. Migrate Player Notes
  console.log('📝 Migrating Player Notes...');
  const noteKeys = Object.keys(localStorage).filter(key => key.startsWith('player_notes_'));
  
  for (const key of noteKeys) {
    const playerTag = key.replace('player_notes_', '');
    const notes = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (!Array.isArray(notes) || notes.length === 0) {
      continue;
    }
    
    for (const note of notes) {
      try {
        // Check if note already exists
        const existingNotes = await checkIfExists(
          `/api/player-notes?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}`
        );
        
        const noteExists = existingNotes.some(existing => 
          existing.note === note.note && 
          existing.created_at === note.timestamp
        );
        
        if (noteExists) {
          console.log(`  ⏭️  Skipping existing note for ${playerTag}`);
          skippedCount++;
          continue;
        }
        
        // Migrate note
        await makeApiCall('/api/player-notes', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          note: note.note,
          customFields: note.customFields || {},
          createdBy: note.createdBy || 'Migration Script',
          timestamp: note.timestamp
        });
        
        console.log(`  ✅ Migrated note for ${playerTag}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate note for ${playerTag}: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  // 2. Migrate Player Warnings
  console.log('⚠️  Migrating Player Warnings...');
  const warningKeys = Object.keys(localStorage).filter(key => key.startsWith('player_warning_'));
  
  for (const key of warningKeys) {
    const playerTag = key.replace('player_warning_', '');
    const warning = JSON.parse(localStorage.getItem(key) || '{}');
    
    if (!warning || !warning.timestamp || !warning.warningNote) {
      continue;
    }
    
    try {
      // Check if warning already exists
      const existingWarnings = await checkIfExists(
        `/api/player-warnings?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}`
      );
      
      const warningExists = existingWarnings.some(existing => 
        existing.warning_note === warning.warningNote && 
        existing.created_at === warning.timestamp
      );
      
      if (warningExists) {
        console.log(`  ⏭️  Skipping existing warning for ${playerTag}`);
        skippedCount++;
        continue;
      }
      
      // Migrate warning
      await makeApiCall('/api/player-warnings', 'POST', {
        clanTag: CLAN_TAG,
        playerTag: playerTag,
        warningNote: warning.warningNote,
        isActive: warning.isActive !== false,
        createdBy: warning.createdBy || 'Migration Script',
        timestamp: warning.timestamp
      });
      
      console.log(`  ✅ Migrated warning for ${playerTag}`);
      migratedCount++;
      
    } catch (error) {
      console.error(`  ❌ Failed to migrate warning for ${playerTag}: ${error.message}`);
      errorCount++;
    }
  }
  
  // 3. Migrate Tenure Actions
  console.log('👑 Migrating Tenure Actions...');
  const tenureKeys = Object.keys(localStorage).filter(key => key.startsWith('player_tenure_'));
  
  for (const key of tenureKeys) {
    const playerTag = key.replace('player_tenure_', '');
    const actions = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (!Array.isArray(actions) || actions.length === 0) {
      continue;
    }
    
    for (const action of actions) {
      try {
        // Check if action already exists
        const existingActions = await checkIfExists(
          `/api/player-actions?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}&type=tenure`
        );
        
        const actionExists = existingActions.some(existing => 
          existing.action === action.action && 
          existing.created_at === action.timestamp
        );
        
        if (actionExists) {
          console.log(`  ⏭️  Skipping existing tenure action for ${playerTag}`);
          skippedCount++;
          continue;
        }
        
        // Migrate tenure action
        await makeApiCall('/api/player-actions', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          actionType: 'tenure',
          action: action.action,
          reason: action.reason || '',
          grantedBy: action.grantedBy || 'Migration Script',
          timestamp: action.timestamp
        });
        
        console.log(`  ✅ Migrated tenure action for ${playerTag}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate tenure action for ${playerTag}: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  // 4. Migrate Departure Actions
  console.log('🚪 Migrating Departure Actions...');
  const departureKeys = Object.keys(localStorage).filter(key => key.startsWith('player_departure_'));
  
  for (const key of departureKeys) {
    const playerTag = key.replace('player_departure_', '');
    const actions = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (!Array.isArray(actions) || actions.length === 0) {
      continue;
    }
    
    for (const action of actions) {
      try {
        // Check if action already exists
        const existingActions = await checkIfExists(
          `/api/player-actions?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}&type=departure`
        );
        
        const actionExists = existingActions.some(existing => 
          existing.reason === action.reason && 
          existing.created_at === action.timestamp
        );
        
        if (actionExists) {
          console.log(`  ⏭️  Skipping existing departure action for ${playerTag}`);
          skippedCount++;
          continue;
        }
        
        // Migrate departure action
        await makeApiCall('/api/player-actions', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          actionType: 'departure',
          reason: action.reason || '',
          type: action.type || 'voluntary',
          recordedBy: action.recordedBy || 'Migration Script',
          timestamp: action.timestamp
        });
        
        console.log(`  ✅ Migrated departure action for ${playerTag}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate departure action for ${playerTag}: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  // 5. Create backup of localStorage data
  console.log('💾 Creating localStorage backup...');
  const backupData = {
    notes: {},
    warnings: {},
    tenureActions: {},
    departureActions: {},
    playerNames: {},
    migratedAt: new Date().toISOString()
  };
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('player_notes_')) {
      backupData.notes[key] = JSON.parse(localStorage.getItem(key) || '[]');
    } else if (key.startsWith('player_warning_')) {
      backupData.warnings[key] = JSON.parse(localStorage.getItem(key) || '{}');
    } else if (key.startsWith('player_tenure_')) {
      backupData.tenureActions[key] = JSON.parse(localStorage.getItem(key) || '[]');
    } else if (key.startsWith('player_departure_')) {
      backupData.departureActions[key] = JSON.parse(localStorage.getItem(key) || '[]');
    } else if (key.startsWith('player_name_')) {
      backupData.playerNames[key] = localStorage.getItem(key);
    }
  });
  
  // Download backup
  const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `localStorage-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Summary
  console.log('\n🎉 Migration Complete!');
  console.log(`✅ Migrated: ${migratedCount} items`);
  console.log(`⏭️  Skipped: ${skippedCount} items (already exist)`);
  console.log(`❌ Errors: ${errorCount} items`);
  console.log(`💾 Backup: Downloaded to localStorage-backup-*.json`);
  
  if (errorCount === 0) {
    console.log('\n✨ All data successfully migrated to Supabase!');
    console.log('You can now safely remove localStorage logic from the application.');
  } else {
    console.log('\n⚠️  Some items failed to migrate. Check the errors above.');
  }
  
  return {
    migrated: migratedCount,
    skipped: skippedCount,
    errors: errorCount,
    backup: backupData
  };
}

// Export for use
window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase;

console.log('Migration function loaded. Run migrateLocalStorageToSupabase() to start the migration.');

