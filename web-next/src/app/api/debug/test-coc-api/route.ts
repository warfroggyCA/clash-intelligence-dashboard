import { NextRequest, NextResponse } from 'next/server';
import { getClanInfo } from '@/lib/coc';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to verify CoC API calls through Fixie.
 * This will make an actual API call and show detailed diagnostics.
 * 
 * Requires ADMIN_API_KEY authorization.
 */
export async function GET(req: NextRequest) {
  // Check authorization
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const testClanTag = '#2PR8R8V8P'; // Default test clan
  
  try {
    console.log(`[Test CoC API] Starting test API call for clan ${testClanTag}`);
    console.log(`[Test CoC API] Environment: ${process.env.NODE_ENV}, Vercel Env: ${process.env.VERCEL_ENV}`);
    console.log(`[Test CoC API] FIXIE_URL: ${process.env.FIXIE_URL ? 'SET (' + process.env.FIXIE_URL.length + ' chars)' : 'NOT SET'}`);
    console.log(`[Test CoC API] COC_API_TOKEN: ${process.env.COC_API_TOKEN ? 'SET (' + process.env.COC_API_TOKEN.length + ' chars)' : 'NOT SET'}`);
    console.log(`[Test CoC API] COC_DISABLE_PROXY: ${process.env.COC_DISABLE_PROXY}`);
    console.log(`[Test CoC API] COC_ALLOW_PROXY_FALLBACK: ${process.env.COC_ALLOW_PROXY_FALLBACK}`);
    
    const startTime = Date.now();
    const normalizedTag = normalizeTag(testClanTag);
    
    if (!normalizedTag) {
      return NextResponse.json({
        error: 'Invalid clan tag',
        testClanTag
      }, { status: 400 });
    }
    
    // Make the actual API call
    const clan = await getClanInfo(normalizedTag);
    const duration = Date.now() - startTime;
    
    console.log(`[Test CoC API] SUCCESS - Got clan data in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      diagnostics: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          isProduction: process.env.NODE_ENV === 'production' && (process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV),
          isDevelopment: process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development',
        },
        fixie: {
          urlConfigured: !!process.env.FIXIE_URL,
          urlLength: process.env.FIXIE_URL?.length || 0,
          disabled: process.env.COC_DISABLE_PROXY === 'true',
          allowFallback: process.env.COC_ALLOW_PROXY_FALLBACK !== 'false',
        },
        cocApi: {
          tokenConfigured: !!process.env.COC_API_TOKEN,
          tokenLength: process.env.COC_API_TOKEN?.length || 0,
          baseUrl: process.env.COC_API_BASE || 'https://api.clashofclans.com/v1',
        },
      },
      apiCall: {
        clanTag: testClanTag,
        normalizedTag,
        durationMs: duration,
        success: true,
        clanData: {
          name: clan?.name,
          tag: clan?.tag,
          memberCount: clan?.memberList?.length || 0,
        }
      },
      message: 'API call successful! Check server logs for detailed proxy usage information.'
    });
  } catch (error: any) {
    console.error(`[Test CoC API] FAILED:`, error);
    console.error(`[Test CoC API] Error message:`, error?.message);
    console.error(`[Test CoC API] Error status:`, error?.status);
    console.error(`[Test CoC API] Error stack:`, error?.stack);
    
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      errorDetails: {
        status: error?.status,
        proxied: error?.proxied,
        code: error?.code,
        message: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      diagnostics: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          isProduction: process.env.NODE_ENV === 'production' && (process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV),
          isDevelopment: process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development',
        },
        fixie: {
          urlConfigured: !!process.env.FIXIE_URL,
          urlLength: process.env.FIXIE_URL?.length || 0,
          disabled: process.env.COC_DISABLE_PROXY === 'true',
          allowFallback: process.env.COC_ALLOW_PROXY_FALLBACK !== 'false',
        },
        cocApi: {
          tokenConfigured: !!process.env.COC_API_TOKEN,
          tokenLength: process.env.COC_API_TOKEN?.length || 0,
          baseUrl: process.env.COC_API_BASE || 'https://api.clashofclans.com/v1',
        },
      },
      message: 'API call failed. Check server logs for detailed error information.'
    }, { status: error?.status || 500 });
  }
}
