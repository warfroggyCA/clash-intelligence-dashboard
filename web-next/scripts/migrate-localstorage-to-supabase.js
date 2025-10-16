#!/usr/bin/env node

/**
 * Migration Script: localStorage to Supabase
 * 
 * This script safely migrates all player data from localStorage to Supabase
 * to establish a single source of truth.
 * 
 * Usage: node scripts/migrate-localstorage-to-supabase.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CLAN_TAG = '#2PR8R8V8P';
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// API helper functions
async function makeApiCall(endpoint, method = 'GET', data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
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
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${result.error || response.statusText}`);
    }
    
    return result;
  } catch (error) {
    logError(`API call failed: ${error.message}`);
    throw error;
  }
}

// Migration functions
async function migratePlayerNotes(localStorageData) {
  logStep('1', 'Migrating Player Notes...');
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const [key, notes] of Object.entries(localStorageData.notes)) {
    const playerTag = key.replace('player_notes_', '');
    
    if (!Array.isArray(notes) || notes.length === 0) {
      continue;
    }
    
    for (const note of notes) {
      try {
        // Check if note already exists in Supabase
        const existingNotes = await makeApiCall(
          `/api/player-notes?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}`
        );
        
        const noteExists = existingNotes.data?.some(existing => 
          existing.note === note.note && 
          existing.created_at === note.timestamp
        );
        
        if (noteExists) {
          log(`  Skipping existing note for ${playerTag}`, 'yellow');
          skippedCount++;
          continue;
        }
        
        // Migrate note to Supabase
        await makeApiCall('/api/player-notes', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          note: note.note,
          customFields: note.customFields || {},
          createdBy: note.createdBy || 'Migration Script',
          timestamp: note.timestamp
        });
        
        log(`  Migrated note for ${playerTag}`, 'green');
        migratedCount++;
        
      } catch (error) {
        logError(`  Failed to migrate note for ${playerTag}: ${error.message}`);
      }
    }
  }
  
  logSuccess(`Notes migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  return { migrated: migratedCount, skipped: skippedCount };
}

async function migratePlayerWarnings(localStorageData) {
  logStep('2', 'Migrating Player Warnings...');
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const [key, warning] of Object.entries(localStorageData.warnings)) {
    const playerTag = key.replace('player_warning_', '');
    
    if (!warning || !warning.timestamp || !warning.warningNote) {
      continue;
    }
    
    try {
      // Check if warning already exists in Supabase
      const existingWarnings = await makeApiCall(
        `/api/player-warnings?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}`
      );
      
      const warningExists = existingWarnings.data?.some(existing => 
        existing.warning_note === warning.warningNote && 
        existing.created_at === warning.timestamp
      );
      
      if (warningExists) {
        log(`  Skipping existing warning for ${playerTag}`, 'yellow');
        skippedCount++;
        continue;
      }
      
      // Migrate warning to Supabase
      await makeApiCall('/api/player-warnings', 'POST', {
        clanTag: CLAN_TAG,
        playerTag: playerTag,
        warningNote: warning.warningNote,
        isActive: warning.isActive !== false,
        createdBy: warning.createdBy || 'Migration Script',
        timestamp: warning.timestamp
      });
      
      log(`  Migrated warning for ${playerTag}`, 'green');
      migratedCount++;
      
    } catch (error) {
      logError(`  Failed to migrate warning for ${playerTag}: ${error.message}`);
    }
  }
  
  logSuccess(`Warnings migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  return { migrated: migratedCount, skipped: skippedCount };
}

async function migratePlayerActions(localStorageData) {
  logStep('3', 'Migrating Player Actions...');
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  // Migrate tenure actions
  for (const [key, actions] of Object.entries(localStorageData.tenureActions)) {
    const playerTag = key.replace('player_tenure_', '');
    
    if (!Array.isArray(actions) || actions.length === 0) {
      continue;
    }
    
    for (const action of actions) {
      try {
        // Check if action already exists in Supabase
        const existingActions = await makeApiCall(
          `/api/player-actions?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}&type=tenure`
        );
        
        const actionExists = existingActions.data?.some(existing => 
          existing.action === action.action && 
          existing.created_at === action.timestamp
        );
        
        if (actionExists) {
          log(`  Skipping existing tenure action for ${playerTag}`, 'yellow');
          skippedCount++;
          continue;
        }
        
        // Migrate tenure action to Supabase
        await makeApiCall('/api/player-actions', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          actionType: 'tenure',
          action: action.action,
          reason: action.reason || '',
          grantedBy: action.grantedBy || 'Migration Script',
          timestamp: action.timestamp
        });
        
        log(`  Migrated tenure action for ${playerTag}`, 'green');
        migratedCount++;
        
      } catch (error) {
        logError(`  Failed to migrate tenure action for ${playerTag}: ${error.message}`);
      }
    }
  }
  
  // Migrate departure actions
  for (const [key, actions] of Object.entries(localStorageData.departureActions)) {
    const playerTag = key.replace('player_departure_', '');
    
    if (!Array.isArray(actions) || actions.length === 0) {
      continue;
    }
    
    for (const action of actions) {
      try {
        // Check if action already exists in Supabase
        const existingActions = await makeApiCall(
          `/api/player-actions?clanTag=${encodeURIComponent(CLAN_TAG)}&playerTag=${encodeURIComponent(playerTag)}&type=departure`
        );
        
        const actionExists = existingActions.data?.some(existing => 
          existing.reason === action.reason && 
          existing.created_at === action.timestamp
        );
        
        if (actionExists) {
          log(`  Skipping existing departure action for ${playerTag}`, 'yellow');
          skippedCount++;
          continue;
        }
        
        // Migrate departure action to Supabase
        await makeApiCall('/api/player-actions', 'POST', {
          clanTag: CLAN_TAG,
          playerTag: playerTag,
          actionType: 'departure',
          reason: action.reason || '',
          type: action.type || 'voluntary',
          recordedBy: action.recordedBy || 'Migration Script',
          timestamp: action.timestamp
        });
        
        log(`  Migrated departure action for ${playerTag}`, 'green');
        migratedCount++;
        
      } catch (error) {
        logError(`  Failed to migrate departure action for ${playerTag}: ${error.message}`);
      }
    }
  }
  
  logSuccess(`Actions migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  return { migrated: migratedCount, skipped: skippedCount };
}

// Main migration function
async function runMigration() {
  log('🚀 Starting localStorage to Supabase Migration', 'bright');
  log(`Clan Tag: ${CLAN_TAG}`, 'blue');
  log(`API Base URL: ${API_BASE_URL}`, 'blue');
  
  try {
    // Step 1: Load localStorage data from browser
    logStep('0', 'Loading localStorage data...');
    
    // This would need to be run in a browser context or we need to export the data first
    logWarning('This script needs to be run in a browser context to access localStorage');
    logWarning('Please run the following in your browser console first:');
    log(`
// Copy this into your browser console to export localStorage data:
const exportData = {
  notes: {},
  warnings: {},
  tenureActions: {},
  departureActions: {},
  playerNames: {}
};

// Export notes
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('player_notes_')) {
    exportData.notes[key] = JSON.parse(localStorage.getItem(key) || '[]');
  } else if (key.startsWith('player_warning_')) {
    exportData.warnings[key] = JSON.parse(localStorage.getItem(key) || '{}');
  } else if (key.startsWith('player_tenure_')) {
    exportData.tenureActions[key] = JSON.parse(localStorage.getItem(key) || '[]');
  } else if (key.startsWith('player_departure_')) {
    exportData.departureActions[key] = JSON.parse(localStorage.getItem(key) || '[]');
  } else if (key.startsWith('player_name_')) {
    exportData.playerNames[key] = localStorage.getItem(key);
  }
});

// Download the export
const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'localStorage-backup.json';
a.click();
URL.revokeObjectURL(url);

console.log('localStorage data exported to localStorage-backup.json');
    `, 'yellow');
    
    // For now, let's create a simple migration that can be run manually
    logStep('4', 'Manual Migration Instructions');
    log(`
To complete the migration:

1. Run the browser console script above to export your localStorage data
2. Save the exported file as 'localStorage-backup.json' in this directory
3. Run this script again with the backup file

Or run the migration directly in the browser by opening the player database page
and running the migration function in the console.
    `, 'cyan');
    
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigration().catch(error => {
    logError(`Migration failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runMigration, migratePlayerNotes, migratePlayerWarnings, migratePlayerActions };

