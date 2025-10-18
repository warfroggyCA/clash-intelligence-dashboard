import { NextRequest, NextResponse } from 'next/server';
import { runIngestionJob } from '@/lib/ingestion/run-ingestion';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron Jobs use GET requests, not POST
export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel's cron service
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Vercel cron jobs send a Bearer token in the Authorization header
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting daily ingestion job at', new Date().toISOString());
    
    const results = await runIngestionJob({ 
      clanTag: '#2PR8R8V8P'
    });
    
    console.log('[Cron] Daily ingestion completed successfully:', results);
    
    return NextResponse.json({ 
      success: true, 
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Daily ingestion FAILED:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}
