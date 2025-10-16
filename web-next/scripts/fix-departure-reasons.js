// Script to fix departure reasons to distinguish between kicks and voluntary departures
// Run this in your browser console on the Player Database page

(async () => {
  console.log('🔧 Starting departure reason fix...');

  const clanTag = '#2PR8R8V8P';

  // Helper function to update localStorage
  const updateLocalStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error updating ${key}:`, e);
      return false;
    }
  };

  // Helper function to get localStorage data
  const getLocalStorage = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`Error reading ${key}:`, e);
      return null;
    }
  };

  // Get all player notes
  const allKeys = Object.keys(localStorage);
  const playerNoteKeys = allKeys.filter(key => key.startsWith('player_notes_'));
  
  let fixedCount = 0;
  const fixes = [];

  console.log(`📋 Found ${playerNoteKeys.length} players with notes`);

  for (const noteKey of playerNoteKeys) {
    const playerTag = noteKey.replace('player_notes_', '');
    const notes = getLocalStorage(noteKey);
    
    if (!notes || !Array.isArray(notes)) continue;

    let playerFixed = false;
    const updatedNotes = notes.map(note => {
      // Look for departure notes that need fixing
      if (note.note && note.note.includes('Member departed') && note.customFields) {
        const currentReason = note.customFields['Departure Reason'];
        
        // Fix common patterns
        if (currentReason === 'Inactive') {
          // If it says "Inactive", it was likely a kick for inactivity
          const updatedNote = {
            ...note,
            note: note.note.replace('Reason: Inactive', 'Reason: Kicked for inactivity'),
            customFields: {
              ...note.customFields,
              'Departure Reason': 'Kicked for inactivity'
            }
          };
          
          fixes.push({
            playerTag,
            oldReason: 'Inactive',
            newReason: 'Kicked for inactivity',
            note: note.note
          });
          
          playerFixed = true;
          return updatedNote;
        }
        
        // Add more patterns as needed
        if (currentReason === 'Not specified' || currentReason === 'Unknown') {
          // Default to "Left voluntarily" for unspecified cases
          const updatedNote = {
            ...note,
            note: note.note.replace('No reason provided', 'Left voluntarily'),
            customFields: {
              ...note.customFields,
              'Departure Reason': 'Left voluntarily'
            }
          };
          
          fixes.push({
            playerTag,
            oldReason: currentReason,
            newReason: 'Left voluntarily',
            note: note.note
          });
          
          playerFixed = true;
          return updatedNote;
        }
      }
      
      return note;
    });

    if (playerFixed) {
      updateLocalStorage(noteKey, updatedNotes);
      fixedCount++;
    }
  }

  console.log(`✅ Fixed ${fixedCount} players`);
  console.log('📝 Changes made:', fixes);

  // Also update the departure actions in localStorage
  const departureKeys = allKeys.filter(key => key.startsWith('player_departure_'));
  
  for (const depKey of departureKeys) {
    const playerTag = depKey.replace('player_departure_', '');
    const departures = getLocalStorage(depKey);
    
    if (!departures || !Array.isArray(departures)) continue;

    const updatedDepartures = departures.map(dep => {
      if (dep.reason === 'Inactive') {
        return { ...dep, reason: 'Kicked for inactivity' };
      }
      if (dep.reason === 'Not specified' || dep.reason === 'Unknown') {
        return { ...dep, reason: 'Left voluntarily' };
      }
      return dep;
    });

    updateLocalStorage(depKey, updatedDepartures);
  }

  console.log('🎉 Departure reason fix complete!');
  console.log('💡 Refresh the Player Database page to see the changes');
  
  return {
    playersFixed: fixedCount,
    changes: fixes
  };
})();
