const fs = require('fs');
const path = require('path');

async function uploadData() {
  try {
    // Read snapshots
    const snapshotsDir = '../out/snapshots';
    const snapshots = {};
    
    if (fs.existsSync(snapshotsDir)) {
      const files = fs.readdirSync(snapshotsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(snapshotsDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          snapshots[file] = data;
        }
      }
    }
    
    // Read tenure ledger
    const tenureLedgerPath = '../out/tenure_ledger.jsonl';
    let tenureLedger = null;
    if (fs.existsSync(tenureLedgerPath)) {
      tenureLedger = fs.readFileSync(tenureLedgerPath, 'utf8');
    }
    
          // Upload to Vercel
          const response = await fetch('https://clash-intelligence-nhhx1t8xn-dougs-projects-e9ca299b.vercel.app/api/upload-snapshots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snapshots,
        tenureLedger
      })
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('Upload result:', result);
    } else {
      console.error('Upload failed:', responseText);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

uploadData();
