// web-next/src/app/api/roster/route.ts
// DEPRECATED: This endpoint has been replaced by /api/v2/roster
// This file redirects to the new endpoint to prevent breaking changes

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  
  // Build the redirect URL to v2/roster with all existing parameters
  const v2Url = new URL('/api/v2/roster', url.origin);
  
  // Copy all query parameters to the new URL
  searchParams.forEach((value, key) => {
    v2Url.searchParams.set(key, value);
  });
  
  // Return a 301 redirect with deprecation headers
  return NextResponse.redirect(v2Url, {
    status: 301,
    headers: {
      'X-Deprecated-Endpoint': 'true',
      'X-New-Endpoint': '/api/v2/roster',
      'X-Deprecation-Date': '2025-01-25',
      'X-Deprecation-Reason': 'Legacy endpoint replaced by Supabase-backed v2 API',
    }
  });
}

// Also handle POST requests if they exist
export async function POST(req: NextRequest) {
  return GET(req);
}