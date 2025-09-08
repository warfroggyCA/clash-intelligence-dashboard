// web-next/src/app/api/snapshots/create/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createDailySnapshot, detectChanges, saveChangeSummary, getLatestSnapshot } from "@/lib/snapshots";
import { generateChangeSummary } from "@/lib/ai-summarizer";

export async function POST(req: Request) {
  try {
    const { clanTag } = await req.json();
    
    if (!clanTag) {
      return NextResponse.json({ error: "clanTag is required" }, { status: 400 });
    }

    // Create today's snapshot
    const currentSnapshot = await createDailySnapshot(clanTag);
    
    // Get previous snapshot for comparison
    const previousSnapshot = await getLatestSnapshot(clanTag);
    
    let changeSummary = null;
    
    if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
      // Detect changes
      const changes = detectChanges(previousSnapshot, currentSnapshot);
      
      if (changes.length > 0) {
        // Generate AI summary
        const summary = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
        
        changeSummary = {
          date: currentSnapshot.date,
          clanTag,
          changes,
          summary,
          unread: true,
          actioned: false,
          createdAt: new Date().toISOString(),
        };
        
        // Save change summary
        await saveChangeSummary(changeSummary);
      }
    }

    return NextResponse.json({
      success: true,
      snapshot: currentSnapshot,
      changes: changeSummary,
    });
  } catch (error: any) {
    console.error('Snapshot creation error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
