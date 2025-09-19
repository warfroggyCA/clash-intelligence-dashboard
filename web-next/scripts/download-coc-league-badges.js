#!/usr/bin/env node

/**
 * Download authentic Clash of Clans league badge images
 * 
 * This script downloads official CoC league badge images from reliable sources
 * and saves them to the correct directory with proper naming.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// League badge URLs from official sources
const leagueBadges = {
  'Bronze': 'https://clashofclans.com/static/img/leagues/bronze.png',
  'Silver': 'https://clashofclans.com/static/img/leagues/silver.png', 
  'Gold': 'https://clashofclans.com/static/img/leagues/gold.png',
  'Crystal': 'https://clashofclans.com/static/img/leagues/crystal.png',
  'Master': 'https://clashofclans.com/static/img/leagues/master.png',
  'Champion': 'https://clashofclans.com/static/img/leagues/champion.png',
  'Titan': 'https://clashofclans.com/static/img/leagues/titan.png',
  'Legend': 'https://clashofclans.com/static/img/leagues/legend.png'
};

// Alternative sources if official ones don't work
const alternativeSources = {
  'Bronze': 'https://vignette.wikia.nocookie.net/clashofclans/images/8/8a/League_Bronze.png',
  'Silver': 'https://vignette.wikia.nocookie.net/clashofclans/images/4/4a/League_Silver.png',
  'Gold': 'https://vignette.wikia.nocookie.net/clashofclans/images/2/2a/League_Gold.png',
  'Crystal': 'https://vignette.wikia.nocookie.net/clashofclans/images/1/1a/League_Crystal.png',
  'Master': 'https://vignette.wikia.nocookie.net/clashofclans/images/0/0a/League_Master.png',
  'Champion': 'https://vignette.wikia.nocookie.net/clashofclans/images/9/9a/League_Champion.png',
  'Titan': 'https://vignette.wikia.nocookie.net/clashofclans/images/8/8a/League_Titan.png',
  'Legend': 'https://vignette.wikia.nocookie.net/clashofclans/images/7/7a/League_Legend.png'
};

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'clash', 'Leagues');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(outputDir, filename));
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded ${filename}`);
          resolve();
        });
      } else {
        console.log(`❌ Failed to download ${filename} from ${url} (Status: ${response.statusCode})`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      console.log(`❌ Error downloading ${filename}: ${err.message}`);
      reject(err);
    });
  });
}

async function downloadAllBadges() {
  console.log('🏆 Downloading authentic Clash of Clans league badges...\n');
  
  for (const [league, url] of Object.entries(leagueBadges)) {
    const filename = `${league}.png`;
    
    try {
      await downloadImage(url, filename);
    } catch (error) {
      console.log(`⚠️  Primary source failed for ${league}, trying alternative...`);
      
      try {
        await downloadImage(alternativeSources[league], filename);
      } catch (altError) {
        console.log(`❌ Failed to download ${league} from both sources`);
      }
    }
  }
  
  console.log('\n🎉 League badge download complete!');
  console.log(`📁 Images saved to: ${outputDir}`);
}

// Run the download
downloadAllBadges().catch(console.error);
