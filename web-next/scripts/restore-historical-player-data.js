// Script to restore historical player data from backup files
// This will populate localStorage with the historical data we found

console.log('Starting historical player data restoration...');

// OLESCHAK's data from the backup files
const oleschakData = {
  tag: '#20QPUUYVJ',
  name: 'OLESCHAK',
  townHallLevel: 12,
  role: 'member',
  departureDate: '2025-09-10',
  roleChangeDate: '2025-09-09',
  tenureBase: 100, // From tenure ledger
  tenureAsOf: '2025-09-06'
};

// Create notes for OLESCHAK based on the historical events
const oleschakNotes = [
  {
    timestamp: '2025-09-06T19:42:51.488Z',
    note: 'Tenure granted - 100 days base tenure',
    customFields: {}
  },
  {
    timestamp: '2025-09-09T00:00:00.000Z',
    note: 'Role changed from admin to member',
    customFields: {}
  },
  {
    timestamp: '2025-09-10T00:00:00.000Z',
    note: 'Left the clan',
    customFields: {}
  }
];

// Create tenure actions
const oleschakTenureActions = [
  {
    timestamp: '2025-09-06T19:42:51.488Z',
    action: 'granted',
    reason: 'Initial tenure grant',
    grantedBy: 'System'
  }
];

// Create departure action
const oleschakDepartureAction = [
  {
    timestamp: '2025-09-10T00:00:00.000Z',
    reason: 'Voluntary departure',
    recordedBy: 'System',
    type: 'voluntary'
  }
];

// Store the data in localStorage
try {
  // Store player name
  localStorage.setItem('player_name_#20QPUUYVJ', oleschakData.name);
  
  // Store notes
  localStorage.setItem('player_notes_#20QPUUYVJ', JSON.stringify(oleschakNotes));
  
  // Store tenure actions
  localStorage.setItem('player_tenure_#20QPUUYVJ', JSON.stringify(oleschakTenureActions));
  
  // Store departure action
  localStorage.setItem('player_departure_#20QPUUYVJ', JSON.stringify(oleschakDepartureAction));
  
  console.log('✅ Successfully restored OLESCHAK data to localStorage');
  console.log('Data restored:');
  console.log('- Name:', oleschakData.name);
  console.log('- Notes:', oleschakNotes.length);
  console.log('- Tenure actions:', oleschakTenureActions.length);
  console.log('- Departure actions:', oleschakDepartureAction.length);
  
  // Let's also add some other players who left around the same time
  const otherDepartedPlayers = [
    {
      tag: '#Q8VCCJVJ9',
      name: 'pranav. pro',
      departureDate: '2025-09-10',
      reason: 'Voluntary departure'
    },
    {
      tag: '#G0Y8UCU9Y', 
      name: 'SURYA Brock',
      departureDate: '2025-09-10',
      reason: 'Voluntary departure'
    },
    {
      tag: '#QCRVR2CPU',
      name: 'bob',
      departureDate: '2025-09-10', 
      reason: 'Voluntary departure'
    }
  ];
  
  otherDepartedPlayers.forEach(player => {
    // Store basic player info
    localStorage.setItem(`player_name_${player.tag}`, player.name);
    
    // Store departure note
    const departureNote = [{
      timestamp: `${player.departureDate}T00:00:00.000Z`,
      note: `Left the clan - ${player.reason}`,
      customFields: {}
    }];
    localStorage.setItem(`player_notes_${player.tag}`, JSON.stringify(departureNote));
    
    // Store departure action
    const departureAction = [{
      timestamp: `${player.departureDate}T00:00:00.000Z`,
      reason: player.reason,
      recordedBy: 'System',
      type: 'voluntary'
    }];
    localStorage.setItem(`player_departure_${player.tag}`, JSON.stringify(departureAction));
  });
  
  console.log('✅ Also restored data for other departed players');
  console.log('Total players restored:', otherDepartedPlayers.length + 1);
  
} catch (error) {
  console.error('❌ Error restoring data:', error);
}

console.log('Historical data restoration complete!');
console.log('Refresh the Player Database page to see the restored data.');
