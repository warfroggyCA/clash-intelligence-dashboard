import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/lib/config';
import { runStagedIngestionJob, RunStagedIngestionJobOptions } from '@/lib/ingestion/run-staged-ingestion';

const requestSchema = z.object({
  clanTag: z.string().optional(),
  jobId: z.string().optional(),
  skipPhases: z.array(z.string()).optional(),
  runPostProcessing: z.boolean().optional(),
});

function isAuthorized(req: NextRequest): boolean {
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  if (!expectedKey) {
    return true;
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
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const { clanTag, jobId, skipPhases, runPostProcessing } = parsed.data;

    // Use default clan if none provided
    const targetClanTag = clanTag || cfg.homeClanTag;
    if (!targetClanTag) {
      return NextResponse.json({ 
        success: false, 
        error: 'No clan tag provided and no default clan configured' 
      }, { status: 400 });
    }

    console.log(`[AdminAPI] Starting staged ingestion for ${targetClanTag}`);

    const options: RunStagedIngestionJobOptions = {
      clanTag: targetClanTag,
      jobId,
      skipPhases,
      runPostProcessing,
    };

    const result = await runStagedIngestionJob(options);

    if (result.success) {
      return NextResponse.json({
        success: true,
        clanTag: result.clanTag,
        ingestionResult: result.ingestionResult,
        changeSummary: result.changeSummary,
        gameChatMessages: result.gameChatMessages,
        playersResolved: result.playersResolved,
        resolutionErrors: result.resolutionErrors,
        insightsGenerated: result.insightsGenerated,
      });
    } else {
      return NextResponse.json({
        success: false,
        clanTag: result.clanTag,
        error: result.error,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[AdminAPI] Staged ingestion failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const clanTag = searchParams.get('clanTag') || cfg.homeClanTag;
  
  if (!clanTag) {
    return NextResponse.json({ 
      success: false, 
      error: 'No clan tag provided' 
    }, { status: 400 });
  }

  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[AdminAPI] Starting staged ingestion for ${clanTag} (GET)`);

    const result = await runStagedIngestionJob({
      clanTag,
      runPostProcessing: true,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        clanTag: result.clanTag,
        message: 'Staged ingestion completed successfully',
        ingestionResult: result.ingestionResult,
      });
    } else {
      return NextResponse.json({
        success: false,
        clanTag: result.clanTag,
        error: result.error,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[AdminAPI] Staged ingestion failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
