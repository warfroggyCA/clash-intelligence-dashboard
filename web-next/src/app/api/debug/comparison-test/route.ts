import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    headers: {},
    env: {},
    tests: {}
  };

  // Check headers
  diagnostics.headers = {
    host: request.headers.get('host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
  };

  // Check environment variables
  diagnostics.env = {
    DEFAULT_CLAN_TAG: process.env.DEFAULT_CLAN_TAG ? '✅ Set' : '❌ Missing',
    ADMIN_API_KEY: process.env.ADMIN_API_KEY ? '✅ Set' : '❌ Missing',
    NODE_ENV: process.env.NODE_ENV,
  };

  // Test roster API call
  try {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const clanTag = process.env.DEFAULT_CLAN_TAG || '#2PR8R8V8P';
    
    diagnostics.tests.rosterUrl = `${baseUrl}/api/v2/roster?clanTag=${encodeURIComponent(clanTag)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const startTime = Date.now();
    const rosterResponse = await fetch(`${baseUrl}/api/v2/roster?clanTag=${encodeURIComponent(clanTag)}`, {
      headers: {
        'x-api-key': process.env.ADMIN_API_KEY || '',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    
    const elapsed = Date.now() - startTime;
    
    diagnostics.tests.rosterFetch = {
      status: rosterResponse.status,
      ok: rosterResponse.ok,
      statusText: rosterResponse.statusText,
      elapsed: `${elapsed}ms`,
    };

    if (rosterResponse.ok) {
      const data = await rosterResponse.json();
      diagnostics.tests.rosterData = {
        success: data.success,
        memberCount: data.data?.members?.length || 0,
        hasData: !!data.data,
      };
    } else {
      const errorText = await rosterResponse.text();
      diagnostics.tests.rosterError = errorText.substring(0, 500);
    }
  } catch (error: any) {
    diagnostics.tests.rosterFetchError = {
      name: error.name,
      message: error.message,
    };
  }

  return NextResponse.json(diagnostics, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
