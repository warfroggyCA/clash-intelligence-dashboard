import { NextRequest, NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

function isInvalidIpPayload(text: string): boolean {
  return text.includes('accessDenied.invalidIp') || text.includes('invalidIp');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clanTag = normalizeTag(url.searchParams.get('clanTag') || cfg.homeClanTag || '');

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag not configured' }, { status: 500 });
    }

    // We intentionally do a very small live probe here.
    // Default: direct (no Fixie). If direct is blocked by IP allowlist and FIXIE_URL is set,
    // we retry via the existing CoC client (which will now auto-fallback).
    const { getClanInfo } = await import('@/lib/coc');

    try {
      await getClanInfo(clanTag, { bypassCache: true });
      return NextResponse.json({
        success: true,
        data: {
          clanTag,
          status: 'ok',
        },
      });
    } catch (error: any) {
      const msg = String(error?.message || error);
      const status = (error as any)?.status ?? null;
      const invalidIp = isInvalidIpPayload(msg);

      return NextResponse.json({
        success: false,
        error: msg,
        data: {
          clanTag,
          status: invalidIp ? 'invalid_ip' : 'error',
          httpStatus: status,
        },
      }, { status: 200 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
