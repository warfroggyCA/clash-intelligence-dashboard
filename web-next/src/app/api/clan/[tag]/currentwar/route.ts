import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getClanCurrentWar } from '@/lib/coc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: { tag: string } }) {
  try {
    const rawTag = params?.tag;
    if (!rawTag) {
      return NextResponse.json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    const normalizedTag = normalizeTag(rawTag);
    if (!normalizedTag) {
      return NextResponse.json({ success: false, error: 'Invalid clan tag format' }, { status: 400 });
    }

    const currentWar = await getClanCurrentWar(normalizedTag);
    return NextResponse.json({ success: true, data: currentWar });
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch current war';
    const status = typeof error?.status === 'number' ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
