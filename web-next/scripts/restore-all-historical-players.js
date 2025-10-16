// Script to restore ALL historical players from backup files
// Run this in the browser console on the Player Database page

console.log('🔄 Starting restoration of ALL historical players...');

// Function to add a player to localStorage
function addPlayerToLocalStorage(playerTag, playerName, notes = [], warnings = [], tenureActions = [], departureActions = []) {
  // Add player name
  localStorage.setItem(`player_name_${playerTag}`, playerName);
  
  // Add notes if any
  if (notes.length > 0) {
    localStorage.setItem(`player_notes_${playerTag}`, JSON.stringify(notes));
  }
  
  // Add warnings if any
  if (warnings.length > 0) {
    warnings.forEach(warning => {
      localStorage.setItem(`player_warning_${playerTag}`, JSON.stringify(warning));
    });
  }
  
  // Add tenure actions if any
  if (tenureActions.length > 0) {
    localStorage.setItem(`player_tenure_${playerTag}`, JSON.stringify(tenureActions));
  }
  
  // Add departure actions if any
  if (departureActions.length > 0) {
    localStorage.setItem(`player_departure_${playerTag}`, JSON.stringify(departureActions));
  }
  
  console.log(`✅ Added ${playerName} (${playerTag}) to localStorage`);
}

// Historical data from backup files
const historicalPlayers = [
  // OLESCHAK - from tenure ledger and changes
  {
    tag: '#20QPUUYVJ',
    name: 'OLESCHAK',
    notes: [
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
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  // Players from tenure ledger who are not in current roster
  {
    tag: '#Q902PY02',
    name: 'Unknown Player (Q902PY02)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#QCRVR2CPU',
    name: 'Unknown Player (QCRVR2CPU)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#YVY8V08Y8',
    name: 'Unknown Player (YVY8V08Y8)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#PC2LRQ0C0',
    name: 'Unknown Player (PC2LRQ0C0)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#2QVLYC000',
    name: 'Unknown Player (2QVLYC000)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#QC28JY9PG',
    name: 'Unknown Player (QC28JY9PG)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  {
    tag: '#LCJ8CPY9R',
    name: 'Unknown Player (LCJ8CPY9R)',
    notes: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        note: 'Had tenure granted on 2025-09-06',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [
      {
        timestamp: '2025-09-06T19:42:51.488Z',
        action: 'granted',
        reason: 'Initial tenure grant',
        grantedBy: 'System'
      }
    ],
    departureActions: []
  },
  
  // Players from changes files who left
  {
    tag: '#UNKNOWN1',
    name: '~{NoMad}~',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN2',
    name: 'Big Papa',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN3',
    name: 'Rafin Osman',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN4',
    name: 'Sasta Hacker',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN5',
    name: 'king',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN6',
    name: 'pranav. pro',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN7',
    name: 'Fronton Zakolee',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN8',
    name: 'Ralex',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN9',
    name: 'P4nda/cake',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN10',
    name: 'SURYA Brock',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN11',
    name: 'WinTer SolDier',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN12',
    name: 'Akash',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN13',
    name: 'Muawiyah',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN14',
    name: 'BlackPillow',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN15',
    name: 'leo',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN16',
    name: 'Boxer',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN17',
    name: 'e❤️jonah',
    notes: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-10T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  },
  
  {
    tag: '#UNKNOWN18',
    name: 'Gambit',
    notes: [
      {
        timestamp: '2025-09-09T00:00:00.000Z',
        note: 'Left the clan',
        customFields: {}
      }
    ],
    warnings: [],
    tenureActions: [],
    departureActions: [
      {
        timestamp: '2025-09-09T00:00:00.000Z',
        reason: 'Voluntary departure',
        type: 'voluntary',
        recordedBy: 'System'
      }
    ]
  }
];

// Restore all historical players
console.log(`📊 Found ${historicalPlayers.length} historical players to restore`);

historicalPlayers.forEach(player => {
  addPlayerToLocalStorage(
    player.tag,
    player.name,
    player.notes,
    player.warnings,
    player.tenureActions,
    player.departureActions
  );
});

console.log('🎉 ALL historical players have been restored to localStorage!');
console.log('🔄 Please refresh the Player Database page to see all players.');

// Show summary
const totalPlayers = historicalPlayers.length;
const playersWithNotes = historicalPlayers.filter(p => p.notes.length > 0).length;
const playersWithTenure = historicalPlayers.filter(p => p.tenureActions.length > 0).length;
const playersWithDepartures = historicalPlayers.filter(p => p.departureActions.length > 0).length;

console.log('\n📈 RESTORATION SUMMARY:');
console.log(`Total Players Restored: ${totalPlayers}`);
console.log(`Players with Notes: ${playersWithNotes}`);
console.log(`Players with Tenure Actions: ${playersWithTenure}`);
console.log(`Players with Departure Records: ${playersWithDepartures}`);
console.log('\n✨ Your historical player data has been fully restored!');
