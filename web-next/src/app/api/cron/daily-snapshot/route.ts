// web-next/src/app/api/cron/daily-snapshot/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createDailySnapshot, detectChanges, saveChangeSummary, getLatestSnapshot } from "@/lib/snapshots";
import { generateChangeSummary, generateGameChatMessages } from "@/lib/ai-summarizer";
import { cfg } from "@/lib/config";
import { addDeparture } from "@/lib/departures";
import { promises as fsp } from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    // Verify this is a legitimate cron request (you might want to add authentication)
    const authHeader = req.headers.get('authorization');
    const expectedAuth = process.env.CRON_SECRET;
    
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = [];
    
    // Get the home clan tag from config
    const clanTag = cfg.homeClanTag;
    
    if (!clanTag) {
      return NextResponse.json({ error: "No home clan configured" }, { status: 400 });
    }

    console.log(`[CRON] Starting daily snapshot for ${clanTag} at ${new Date().toISOString()}`);

    try {
      // Create today's snapshot
      const currentSnapshot = await createDailySnapshot(clanTag);
      console.log(`[CRON] Created snapshot for ${clanTag} with ${currentSnapshot.memberCount} members`);
      
      // Get previous snapshot for comparison (not the one we just created)
      const snapshotsDir = path.join(process.cwd(), cfg.dataRoot, 'snapshots');
      const safeTag = clanTag.replace('#', '').toLowerCase();
      
      let previousSnapshot = null;
      try {
        const files = await fsp.readdir(snapshotsDir);
        const snapshotFiles = files
          .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
          .sort()
          .reverse();
        
        // Get the second most recent snapshot (skip the one we just created)
        if (snapshotFiles.length > 1) {
          const previousFile = snapshotFiles[1];
          const data = await fsp.readFile(path.join(snapshotsDir, previousFile), 'utf-8');
          previousSnapshot = JSON.parse(data);
        }
      } catch (error) {
        console.error('Failed to load previous snapshot:', error);
      }
      
      let changeSummary = null;
      
      if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
        // Detect changes
        const changes = detectChanges(previousSnapshot, currentSnapshot);
        console.log(`[CRON] Detected ${changes.length} changes for ${clanTag}`);
        
        if (changes.length > 0) {
          // Record departures automatically
          const departures = changes.filter(c => c.type === 'left_member');
          for (const departure of departures) {
            await addDeparture(clanTag, {
              memberTag: departure.member.tag,
              memberName: departure.member.name,
              departureDate: currentSnapshot.date,
              lastSeen: new Date().toISOString(),
              lastRole: departure.member.role,
              lastTownHall: departure.member.townHallLevel,
              lastTrophies: departure.member.trophies,
            });
            console.log(`[CRON] Recorded departure for ${departure.member.name}`);
          }
          
          // Generate AI summary and game chat messages
          const summary = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
          const gameChatMessages = generateGameChatMessages(changes);
          
          changeSummary = {
            date: currentSnapshot.date,
            clanTag,
            changes,
            summary,
            gameChatMessages,
            unread: true,
            actioned: false,
            createdAt: new Date().toISOString(),
          };
          
          // Save change summary
          await saveChangeSummary(changeSummary);
          console.log(`[CRON] Saved change summary for ${clanTag}`);
        }
      }

      results.push({
        clanTag,
        success: true,
        memberCount: currentSnapshot.memberCount,
        changesDetected: changeSummary?.changes.length || 0,
        summary: changeSummary?.summary,
        gameChatMessages: changeSummary?.gameChatMessages || [],
      });

    } catch (error: any) {
      console.error(`[CRON] Error processing ${clanTag}:`, error);
      results.push({
        clanTag,
        success: false,
        error: error.message,
      });
    }

    console.log(`[CRON] Daily snapshot completed at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[CRON] Daily snapshot error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to create daily snapshot" },
      { status: 500 }
    );
  }
}
