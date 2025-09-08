// web-next/src/app/api/snapshots/changes/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAllChangeSummaries, loadChangeSummary } from "@/lib/snapshots";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clanTag = url.searchParams.get('clanTag');
    const date = url.searchParams.get('date');
    
    if (!clanTag) {
      return NextResponse.json({ error: "clanTag is required" }, { status: 400 });
    }

    if (date) {
      // Get specific date's changes
      const changeSummary = await loadChangeSummary(clanTag, date);
      return NextResponse.json({
        success: true,
        changes: changeSummary,
      });
    } else {
      // Get all changes for the clan
      const allChanges = await getAllChangeSummaries(clanTag);
      return NextResponse.json({
        success: true,
        changes: allChanges,
      });
    }
  } catch (error: any) {
    console.error('Error fetching changes:', error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch changes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Handle saving AI summaries
    if (body.action === 'save' && body.changeSummary) {
      const { saveChangeSummary } = await import('@/lib/snapshots');
      await saveChangeSummary(body.changeSummary);
      
      return NextResponse.json({
        success: true,
        message: "AI summary saved successfully"
      });
    }
    
    // Handle existing read/actioned actions
    const { clanTag, date, action } = body;
    
    if (!clanTag || !date || !action) {
      return NextResponse.json({ error: "clanTag, date, and action are required" }, { status: 400 });
    }

    if (!['read', 'actioned'].includes(action)) {
      return NextResponse.json({ error: "Action must be 'read' or 'actioned'" }, { status: 400 });
    }

    // Load the change summary
    const changeSummary = await loadChangeSummary(clanTag, date);
    
    if (!changeSummary) {
      return NextResponse.json({ error: "Change summary not found" }, { status: 404 });
    }

    // Update the status
    if (action === 'read') {
      changeSummary.unread = false;
    } else if (action === 'actioned') {
      changeSummary.actioned = true;
      changeSummary.unread = false;
    }

    // Save the updated summary
    const { saveChangeSummary } = await import('@/lib/snapshots');
    await saveChangeSummary(changeSummary);

    return NextResponse.json({
      success: true,
      changes: changeSummary,
    });
  } catch (error: any) {
    console.error('Error updating changes:', error);
    return NextResponse.json(
      { error: error.message || "Failed to update changes" },
      { status: 500 }
    );
  }
}
