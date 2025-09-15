import { NextResponse } from 'next/server';

// Simple middleware to protect leadership/admin APIs using a shared token.
// If process.env.LEADERSHIP_TOKEN is set, requests must include header 'x-leadership-token' with the same value.
// Otherwise, middleware is a no-op.

export function middleware(request: Request) {
  const token = process.env.LEADERSHIP_TOKEN;
  if (!token) return NextResponse.next();

  const url = new URL(request.url);
  const protectedPrefixes = [
    '/api/snapshots/create',
    '/api/ai-coaching',
    '/api/ai-summary',
    '/api/discord',
    '/api/tenure',
    '/api/sync',
    '/api/cron',
    '/api/upload-snapshots',
    '/api/migrate-departures',
  ];
  const needsAuth = protectedPrefixes.some((p) => url.pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const provided = (request.headers as any).get?.('x-leadership-token') || '';
  if (provided !== token) {
    return new NextResponse(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/snapshots/create',
    '/api/ai-coaching/:path*',
    '/api/ai-summary/:path*',
    '/api/discord/:path*',
    '/api/tenure/:path*',
    '/api/sync/:path*',
    '/api/cron/:path*',
    '/api/upload-snapshots',
    '/api/migrate-departures',
  ],
};
