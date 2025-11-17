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

export const config = {
  matcher: '/:path*',
};
