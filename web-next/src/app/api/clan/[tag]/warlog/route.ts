import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getClanWarLog } from '@/lib/coc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const { tag: rawTag } = await params;
    if (!rawTag) {
      return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    if (limitParam && (!Number.isFinite(limit) || limit! < 1)) {
      return NextResponse.json({ success: false, error: 'limit must be a positive number' }, { status: 400 });
    }

    const normalizedTag = normalizeTag(rawTag);
    if (!normalizedTag) {
      return NextResponse.json({ success: false, error: 'Invalid clan tag format' }, { status: 400 });
    }

    const wars = await getClanWarLog(normalizedTag, limit);
    return NextResponse.json({ success: true, data: wars ?? [] });
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch clan war log';
    const status = typeof error?.status === 'number' ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
