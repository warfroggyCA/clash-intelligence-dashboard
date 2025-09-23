import { NextRequest, NextResponse } from 'next/server';
import { runIngestionJob } from '@/lib/ingestion/run-ingestion';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel's cron service
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting daily ingestion job');
    
    const results = await runIngestionJob({ 
      clanTag: '#2PR8R8V8P',
      source: 'vercel-cron'
    });
    
    console.log('[Cron] Daily ingestion completed:', results);
    
    return NextResponse.json({ 
      success: true, 
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Daily ingestion failed:', error);
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
