import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';

// POST /api/migrate-departures
// One-time migration to scan historical snapshots and detect departures
export async function POST(request: NextRequest) {
  try {
    const { days = 7 } = await request.json().catch(() => ({})); // Default to 7 days
    const clanTag = cfg.homeClanTag;
    
    if (!clanTag) {
      return NextResponse.json({ error: 'No home clan configured' }, { status: 400 });
    }

    console.log(`[Migration] Starting departure migration for ${clanTag} (last ${days} days)`);

    const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
    const safeTag = clanTag.replace('#', '').toLowerCase();
    
    // Get all snapshot files for this clan
    const files = await fs.readdir(snapshotsDir);
    const snapshotFiles = files
      .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (snapshotFiles.length < 2) {
      return NextResponse.json({ 
        success: true, 
        message: 'Not enough snapshots to detect departures',
        snapshotsFound: snapshotFiles.length 
      });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    console.log(`[Migration] Analyzing snapshots from last ${days} days (since ${cutoffDate.toISOString()})`);

    const departures = [];
    const processedSnapshots = [];
    
    // Process snapshots in chronological order (oldest first)
    for (let i = snapshotFiles.length - 1; i > 0; i--) {
      const currentFile = snapshotFiles[i];
      const previousFile = snapshotFiles[i - 1];
      
      try {
        // Load current and previous snapshots
        const currentData = await fs.readFile(path.join(snapshotsDir, currentFile), 'utf-8');
        const previousData = await fs.readFile(path.join(snapshotsDir, previousFile), 'utf-8');
        
        const currentSnapshot = JSON.parse(currentData);
        const previousSnapshot = JSON.parse(previousData);
        
        // Check if this snapshot is within our date range
        const snapshotDate = new Date(currentSnapshot.date);
        if (snapshotDate < cutoffDate) {
          continue;
        }
        
        console.log(`[Migration] Comparing ${previousFile} → ${currentFile} (${currentSnapshot.date})`);
        
        // Detect departures by comparing member lists
        const currentMembers = new Set(currentSnapshot.members?.map((m: any) => m.tag) || []);
        const previousMembers = new Set(previousSnapshot.members?.map((m: any) => m.tag) || []);
        
        // Find members who were in previous but not in current (departures)
        for (const memberTag of previousMembers) {
          if (!currentMembers.has(memberTag)) {
            // This member departed
            const departedMember = previousSnapshot.members?.find((m: any) => m.tag === memberTag);
            
            if (departedMember) {
              const departure = {
                memberTag: departedMember.tag,
                memberName: departedMember.name,
                departureDate: currentSnapshot.date,
                lastSeen: new Date().toISOString(),
                lastRole: departedMember.role,
                lastTownHall: departedMember.townHallLevel,
                lastTrophies: departedMember.trophies,
                addedBy: 'Migration (Historical Scan)',
                timestamp: new Date().toISOString()
              };
              
              // Check if we already have this departure
              const existingIndex = departures.findIndex(d => 
                d.memberTag === memberTag && 
                d.departureDate === currentSnapshot.date
              );
              
              if (existingIndex === -1) {
                departures.push(departure);
                console.log(`[Migration] Found departure: ${departedMember.name} (${memberTag}) on ${currentSnapshot.date}`);
              }
            }
          }
        }
        
        processedSnapshots.push({
          file: currentFile,
          date: currentSnapshot.date,
          memberCount: currentSnapshot.memberCount
        });
        
      } catch (error) {
        console.error(`[Migration] Error processing ${currentFile}:`, error);
      }
    }

    // Store all detected departures
    if (departures.length > 0) {
      const playerDBDir = path.join(process.cwd(), 'data', 'player-db');
      await fs.mkdir(playerDBDir, { recursive: true });
      
      const filePath = path.join(playerDBDir, 'departures.json');
      let existingDepartures = [];
      
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        existingDepartures = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet
      }
      
      // Merge with existing departures, avoiding duplicates
      const allDepartures = [...existingDepartures];
      for (const departure of departures) {
        const existingIndex = allDepartures.findIndex(d => 
          d.memberTag === departure.memberTag && 
          d.departureDate === departure.departureDate
        );
        
        if (existingIndex === -1) {
          allDepartures.push(departure);
        }
      }
      
      await fs.writeFile(filePath, JSON.stringify(allDepartures, null, 2));
      
      console.log(`[Migration] Stored ${departures.length} historical departures`);
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed successfully`,
      departuresFound: departures.length,
      snapshotsProcessed: processedSnapshots.length,
      dateRange: {
        from: processedSnapshots[0]?.date || 'N/A',
        to: processedSnapshots[processedSnapshots.length - 1]?.date || 'N/A'
      },
      departures: departures.map(d => ({
        memberName: d.memberName,
        memberTag: d.memberTag,
        departureDate: d.departureDate,
        lastRole: d.lastRole
      }))
    });

  } catch (error: any) {
    console.error('[Migration] Error during departure migration:', error);
    return NextResponse.json({ 
      error: error.message || 'Migration failed',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
