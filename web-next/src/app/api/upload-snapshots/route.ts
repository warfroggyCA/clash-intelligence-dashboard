import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { snapshots, tenureLedger } = await request.json();
    
    // Ensure directories exist
    await mkdir('/tmp/data', { recursive: true });
    await mkdir('/tmp/data/snapshots', { recursive: true });
    
    // Upload snapshots
    if (snapshots) {
      for (const [filename, data] of Object.entries(snapshots)) {
        const filePath = join('/tmp/data/snapshots', filename);
        await writeFile(filePath, JSON.stringify(data, null, 2));
      }
    }
    
    // Upload tenure ledger
    if (tenureLedger) {
      const ledgerPath = '/tmp/data/tenure_ledger.jsonl';
      await writeFile(ledgerPath, tenureLedger);
    }
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Snapshots uploaded successfully',
      uploaded: {
        snapshots: snapshots ? Object.keys(snapshots).length : 0,
        hasTenureLedger: !!tenureLedger
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}

