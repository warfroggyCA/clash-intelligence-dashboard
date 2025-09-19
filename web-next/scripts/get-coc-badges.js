#!/usr/bin/env node

/**
 * Get authentic Clash of Clans league badge images
 * 
 * This script creates proper CoC league badge images by using
 * the official CoC API or reliable sources for league badge data.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Create a simple script to generate proper league badge images
// Since direct downloads aren't working, we'll create a guide for manual replacement

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'clash', 'Leagues');

// League badge information with proper CoC styling
const leagueInfo = {
  'Bronze': {
    color: '#CD7F32',
    trophyRange: '0-399',
    description: 'Bronze League - Starting league for new players'
  },
  'Silver': {
    color: '#C0C0C0', 
    trophyRange: '400-799',
    description: 'Silver League - Second tier league'
  },
  'Gold': {
    color: '#FFD700',
    trophyRange: '800-1399', 
    description: 'Gold League - Mid-tier competitive league'
  },
  'Crystal': {
    color: '#B9F2FF',
    trophyRange: '1400-1999',
    description: 'Crystal League - High-tier competitive league'
  },
  'Master': {
    color: '#800080',
    trophyRange: '2000-2999',
    description: 'Master League - Elite competitive league'
  },
  'Champion': {
    color: '#FF4500',
    trophyRange: '3000-3999', 
    description: 'Champion League - Top-tier competitive league'
  },
  'Titan': {
    color: '#FF6347',
    trophyRange: '4000-4999',
    description: 'Titan League - Near-legendary league'
  },
  'Legend': {
    color: '#FFD700',
    trophyRange: '5000+',
    description: 'Legend League - Highest achievable league'
  }
};

// Create a guide file for manual image replacement
const guideContent = `# Clash of Clans League Badge Images Guide

## Current Status
The league images in this directory are generic trophy placeholders. 
To get authentic Clash of Clans league badges, follow these steps:

## Manual Download Instructions

### Option 1: Official CoC Wiki
1. Visit: https://clashofclans.fandom.com/wiki/Clan_Badge
2. Right-click on each league badge image
3. Save as PNG with the correct filename:
   - Bronze.png
   - Silver.png  
   - Gold.png
   - Crystal.png
   - Master.png
   - Champion.png
   - Titan.png
   - Legend.png

### Option 2: Alternative Sources
- Clash of Clans Official Website
- Clash of Clans Wiki (Fandom)
- Clash of Clans Reddit community resources

### Option 3: Create Custom Badges
If you can't find official images, you can create custom league badges that match the CoC style:

## League Information
${Object.entries(leagueInfo).map(([league, info]) => 
  `### ${league} League
- Color: ${info.color}
- Trophy Range: ${info.trophyRange}
- Description: ${info.description}`
).join('\n\n')}

## File Requirements
- Format: PNG
- Size: 64x64 pixels minimum (400x400 recommended)
- Background: Transparent
- Style: Match Clash of Clans visual design

## After Replacing Images
1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Restart the development server
3. Check that league badges display correctly

The LeagueBadge component will automatically use the new images once they're properly named and placed in this directory.
`;

// Write the guide
fs.writeFileSync(path.join(outputDir, 'README.md'), guideContent);

console.log('📋 Created league badge replacement guide at:');
console.log(`   ${path.join(outputDir, 'README.md')}`);
console.log('\n🏆 To get authentic CoC league badges:');
console.log('1. Open the README.md file in the Leagues directory');
console.log('2. Follow the manual download instructions');
console.log('3. Replace the generic images with authentic CoC badges');
console.log('4. Clear browser cache and restart server');

// Also create a simple HTML preview to see current images
const htmlPreview = `<!DOCTYPE html>
<html>
<head>
    <title>League Badge Preview</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .badge-container { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
        .badge-item { text-align: center; }
        .badge-item img { width: 64px; height: 64px; border: 2px solid #ccc; }
        .badge-item p { margin: 5px 0; font-size: 12px; }
    </style>
</head>
<body>
    <h1>Current League Badge Images</h1>
    <p>These are the current league images. Replace them with authentic CoC badges.</p>
    
    <div class="badge-container">
        ${Object.keys(leagueInfo).map(league => `
            <div class="badge-item">
                <img src="${league}.png" alt="${league} League" onerror="this.style.display='none'">
                <p>${league}</p>
                <p>${leagueInfo[league].trophyRange} trophies</p>
            </div>
        `).join('')}
    </div>
    
    <p><strong>Note:</strong> If images don't display, they need to be replaced with proper CoC league badges.</p>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'preview.html'), htmlPreview);
console.log(`\n🔍 Created preview page at: ${path.join(outputDir, 'preview.html')}`);
console.log('   Open this file in your browser to see current league images');
