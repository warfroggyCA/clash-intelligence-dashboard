// web-next/src/app/api/player-resolver/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), cfg.dataRoot);
    const resolutionFile = path.join(dataDir, 'player-name-resolution.json');
    
    // Check if resolution file exists
    try {
      await fsp.access(resolutionFile);
    } catch {
      return NextResponse.json({ 
        error: "No resolution data available",
        resolved: 0 
      }, { status: 404 });
    }
    
    // Read and return resolution data
    const resolutionData = await fsp.readFile(resolutionFile, 'utf-8');
    const data = JSON.parse(resolutionData);
    
    return NextResponse.json({
      success: true,
      ...data
    });
    
  } catch (error: any) {
    console.error('[PlayerResolver API] Error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to get resolution data" },
      { status: 500 }
    );
  }
}
