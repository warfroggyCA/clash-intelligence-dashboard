const { getSupabaseAdminClient } = require('./src/lib/supabase-admin.ts');

function getWeekKey(dateString) {
  const base = new Date(dateString + 'T00:00:00Z');
  const day = base.getUTCDay();
  const diff = base.getUTCDate() - day + (day === 0 ? -6 : 1);
  base.setUTCDate(diff);
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

async function analyzeWeeklyFinals() {
  const supabase = getSupabaseAdminClient();
  
  console.log('Analyzing weekly finals for warfroggy...');
  const { data: playerDayData, error: playerDayError } = await supabase
    .from('player_day')
    .select('player_tag, date, trophies')
    .eq('player_tag', '#G9QVRYC2Y')
    .gte('date', '2025-10-01')
    .order('date');
    
  if (playerDayError) {
    console.error('Error fetching player_day:', playerDayError);
    return;
  }
  
  // Group by week
  const weeklyData = new Map();
  for (const row of playerDayData) {
    const weekKey = getWeekKey(row.date);
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, []);
    }
    weeklyData.get(weekKey).push({
      date: row.date,
      trophies: row.trophies
    });
  }
  
  console.log('\nWeekly analysis:');
  for (const [weekKey, entries] of weeklyData) {
    const maxTrophies = Math.max(...entries.map(e => e.trophies));
    const finalEntry = entries.find(e => e.trophies === maxTrophies);
    console.log(`Week ${weekKey}: Max ${maxTrophies} trophies on ${finalEntry.date}`);
  }
  
  // Check what the backfill script would find
  console.log('\nWhat backfill script would find:');
  const weeklyByMember = new Map();
  for (const row of playerDayData) {
    const weekKey = getWeekKey(row.date);
    const ranked = Number(row.trophies ?? 0);
    if (!Number.isFinite(ranked) || ranked <= 0) continue;
    
    if (!weeklyByMember.has('warfroggy')) {
      weeklyByMember.set('warfroggy', new Map());
    }
    const weekMap = weeklyByMember.get('warfroggy');
    const current = weekMap.get(weekKey) ?? 0;
    if (ranked > current) {
      weekMap.set(weekKey, ranked);
    }
  }
  
  for (const [weekKey, trophies] of weeklyByMember.get('warfroggy') || []) {
    console.log(`Week ${weekKey}: ${trophies} trophies`);
  }
}

analyzeWeeklyFinals().catch(console.error);
