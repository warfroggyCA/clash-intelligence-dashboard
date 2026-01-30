import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClanConfigByHost, DEFAULT_CLAN_CONFIG } from '@/lib/clan-config';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const config = getClanConfigByHost(host) ?? DEFAULT_CLAN_CONFIG;
  const requestHeaders = new Headers(request.headers);

  if (config) {
    requestHeaders.set('x-clan-slug', config.slug);
    requestHeaders.set('x-clan-display-name', config.displayName);
    requestHeaders.set('x-clan-tag', config.clanTag);
    requestHeaders.set('x-clan-marketing-only', config.marketingOnly ? 'true' : 'false');
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Avoid running middleware on Next.js internals/static assets.
// This prevents odd 404s / cache issues on /_next/static/* and improves perf.
export const config = {
  matcher: [
    // match all paths except _next (static/image), favicon, and other common assets
    '/((?!_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|site.webmanifest).*)',
  ],
};
