// Test script to check if Player Database API endpoints are working
// Run this in the browser console on the production site

(async () => {
  console.log('🧪 Testing Player Database API endpoints...');
  
  const clanTag = '#2PR8R8V8P';
  const testPlayerTag = '#TEST123';
  const testPlayerName = 'Test Player';
  
  // Test 1: Check if we can fetch existing notes
  console.log('\n1️⃣ Testing GET /api/player-notes...');
  try {
    const notesResponse = await fetch(`/api/player-notes?clanTag=${encodeURIComponent(clanTag)}`);
    const notesData = await notesResponse.json();
    console.log('Notes Response Status:', notesResponse.status);
    console.log('Notes Response Data:', notesData);
  } catch (error) {
    console.error('❌ Error fetching notes:', error);
  }
  
  // Test 2: Check if we can fetch existing warnings
  console.log('\n2️⃣ Testing GET /api/player-warnings...');
  try {
    const warningsResponse = await fetch(`/api/player-warnings?clanTag=${encodeURIComponent(clanTag)}`);
    const warningsData = await warningsResponse.json();
    console.log('Warnings Response Status:', warningsResponse.status);
    console.log('Warnings Response Data:', warningsData);
  } catch (error) {
    console.error('❌ Error fetching warnings:', error);
  }
  
  // Test 3: Try to create a test note
  console.log('\n3️⃣ Testing POST /api/player-notes...');
  try {
    const noteResponse = await fetch('/api/player-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clanTag,
        playerTag: testPlayerTag,
        playerName: testPlayerName,
        note: 'Test note from API diagnostic script',
        createdBy: 'API Test'
      }),
    });
    const noteData = await noteResponse.json();
    console.log('Note Response Status:', noteResponse.status);
    console.log('Note Response Data:', noteData);
  } catch (error) {
    console.error('❌ Error creating note:', error);
  }
  
  // Test 4: Try to create a test warning
  console.log('\n4️⃣ Testing POST /api/player-warnings...');
  try {
    const warningResponse = await fetch('/api/player-warnings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clanTag,
        playerTag: testPlayerTag,
        playerName: testPlayerName,
        warningNote: 'Test warning from API diagnostic script',
        createdBy: 'API Test'
      }),
    });
    const warningData = await warningResponse.json();
    console.log('Warning Response Status:', warningResponse.status);
    console.log('Warning Response Data:', warningData);
  } catch (error) {
    console.error('❌ Error creating warning:', error);
  }
  
  // Test 5: Check environment variables
  console.log('\n5️⃣ Checking environment variables...');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  
  console.log('\n🏁 API diagnostic complete!');
})();
