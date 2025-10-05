import { NextRequest, NextResponse } from 'next/server';
import { runStagedIngestionJob } from '@/lib/ingestion/run-staged-ingestion';
import { cfg } from '@/lib/config';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  if (!expectedKey) {
    return true; // Allow if no key is set (development)
  }
  const provided = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return provided === expectedKey;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { clanTag, background = true } = body;
    
    const targetClanTag = clanTag || cfg.homeClanTag;
    if (!targetClanTag) {
      return NextResponse.json({ 
        success: false, 
        error: 'No clan tag provided and no default clan configured' 
      }, { status: 400 });
    }

    console.log(`[ManualTrigger] Starting ${background ? 'background' : 'foreground'} ingestion for ${targetClanTag}`);

    if (background) {
      // Start ingestion in background without waiting
      runStagedIngestionJob({
        clanTag: targetClanTag,
        runPostProcessing: true,
      }).then(result => {
        console.log(`[ManualTrigger] Background ingestion completed for ${targetClanTag}:`, result.success ? 'SUCCESS' : 'FAILED');
      }).catch(error => {
        console.error(`[ManualTrigger] Background ingestion failed for ${targetClanTag}:`, error);
      });

      return NextResponse.json({
        success: true,
        message: 'Ingestion started in background',
        clanTag: targetClanTag,
        timestamp: new Date().toISOString()
      });
    } else {
      // Run synchronously (for testing)
      const result = await runStagedIngestionJob({
        clanTag: targetClanTag,
        runPostProcessing: true,
      });

      return NextResponse.json({
        success: result.success,
        clanTag: result.clanTag,
        message: result.success ? 'Ingestion completed successfully' : 'Ingestion failed',
        ingestionResult: result.ingestionResult,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('[ManualTrigger] Failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Manual ingestion trigger endpoint',
    usage: {
      method: 'POST',
      body: {
        clanTag: 'string (optional)',
        background: 'boolean (default: true)'
      },
      headers: {
        'x-api-key': 'string (required)'
      }
    }
  });
}
