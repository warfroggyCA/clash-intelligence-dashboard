import { NextRequest, NextResponse } from 'next/server';
import { fetchFullClanSnapshot } from '@/lib/full-snapshot';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint that mimics EXACTLY what Direct Ingestion does.
 * This will help identify which specific API call is failing.
 */
export async function GET(req: NextRequest) {
  // Check authorization
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const testClanTag = '#2PR8R8V8P';
  
  try {
    console.log(`[Test FullSnapshot] Starting EXACT Direct Ingestion simulation for ${testClanTag}`);
    console.log(`[Test FullSnapshot] Environment: ${process.env.NODE_ENV}, Vercel Env: ${process.env.VERCEL_ENV}`);
    console.log(`[Test FullSnapshot] FIXIE_URL: ${process.env.FIXIE_URL ? 'SET' : 'NOT SET'}`);
    
    const startTime = Date.now();
    const normalizedTag = normalizeTag(testClanTag);
    
    if (!normalizedTag) {
      return NextResponse.json({
        error: 'Invalid clan tag',
        testClanTag
      }, { status: 400 });
    }
    
    // Make the EXACT same call that Direct Ingestion makes
    console.log(`[Test FullSnapshot] Calling fetchFullClanSnapshot with same options as Direct Ingestion`);
    const snapshot = await fetchFullClanSnapshot(normalizedTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
      includePlayerDetails: true, // This is what Direct Ingestion uses
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`[Test FullSnapshot] SUCCESS - Got full snapshot in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      diagnostics: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          isProduction: process.env.NODE_ENV === 'production' && (process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV),
        },
        fixie: {
          urlConfigured: !!process.env.FIXIE_URL,
          disabled: process.env.COC_DISABLE_PROXY === 'true',
        },
      },
      snapshot: {
        clanTag: snapshot.clanTag,
        memberCount: snapshot.memberSummaries.length,
        warLogEntries: snapshot.warLog?.length || 0,
        playerDetailsCount: Object.keys(snapshot.playerDetails || {}).length,
        durationMs: duration,
        success: true,
      },
      message: 'Full snapshot fetch successful! Check server logs for detailed API call information.'
    });
  } catch (error: any) {
    console.error(`[Test FullSnapshot] FAILED:`, error);
    console.error(`[Test FullSnapshot] Error message:`, error?.message);
    console.error(`[Test FullSnapshot] Error stack:`, error?.stack);
    
    const { sanitizeErrorForApi } = await import('@/lib/security/error-sanitizer');
    const sanitized = sanitizeErrorForApi(error);
    
    // Try to extract which phase failed (using sanitized message)
    const errorMessage = sanitized.message;
    let failedPhase = 'unknown';
    
    if (errorMessage.includes('clan info')) failedPhase = 'clan info';
    else if (errorMessage.includes('clan members')) failedPhase = 'clan members';
    else if (errorMessage.includes('war log')) failedPhase = 'war log';
    else if (errorMessage.includes('current war')) failedPhase = 'current war';
    else if (errorMessage.includes('capital raid')) failedPhase = 'capital raid seasons';
    else if (errorMessage.includes('player')) failedPhase = 'player details';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      failedPhase,
      errorDetails: {
        message: sanitized.message,
        status: error?.status,
        proxied: error?.proxied,
      },
      diagnostics: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          isProduction: process.env.NODE_ENV === 'production' && (process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV),
        },
        fixie: {
          urlConfigured: !!process.env.FIXIE_URL,
          disabled: process.env.COC_DISABLE_PROXY === 'true',
        },
      },
      message: 'Full snapshot fetch failed. Check server logs for detailed error information.'
    }, { status: error?.status || 500 });
  }
}


