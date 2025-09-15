// web-next/src/app/api/player-resolver/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';
import type { ApiResponse } from '@/types';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const ip = (request.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await rateLimitAllow(`player-resolver:${ip}`, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Too many requests' } satisfies ApiResponse), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        }
      });
    }
    const dataDir = path.join(process.cwd(), cfg.dataRoot);
    const resolutionFile = path.join(dataDir, 'player-name-resolution.json');
    
    // Check if resolution file exists
    try {
      await fsp.access(resolutionFile);
    } catch {
      return NextResponse.json<ApiResponse>({ success: false, error: "No resolution data available" }, { status: 404 });
    }
    
    // Read and return resolution data
    const resolutionData = await fsp.readFile(resolutionFile, 'utf-8');
    const data = JSON.parse(resolutionData);
    
    return NextResponse.json<ApiResponse>({ success: true, data }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    
  } catch (error: any) {
    console.error('[PlayerResolver API] Error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Failed to get resolution data" }, { status: 500 });
  }
}
