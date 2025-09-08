import { NextRequest, NextResponse } from 'next/server';
import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';

// GET /api/snapshots/list?clanTag=#TAG
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    
    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }
    
    const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
    const safeTag = clanTag.replace('#', '').toLowerCase();
    
    try {
      const files = await fsp.readdir(snapshotsDir);
      const snapshotFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      const snapshots = [];
      
      for (const file of snapshotFiles) {
        try {
          const filePath = path.join(snapshotsDir, file);
          const data = await fsp.readFile(filePath, 'utf-8');
          const snapshot = JSON.parse(data);
          
          snapshots.push({
            date: snapshot.date,
            memberCount: snapshot.memberCount || snapshot.members?.length || 0,
            clanName: snapshot.clanName,
            timestamp: snapshot.timestamp
          });
        } catch (error) {
          console.error(`Error reading snapshot file ${file}:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        snapshots
      });
    } catch (error) {
      // Directory doesn't exist yet
      return NextResponse.json({
        success: true,
        snapshots: []
      });
    }
  } catch (error: any) {
    console.error('Error listing snapshots:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
