import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { getCurrentRosterData } from '@/lib/roster-current';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';
// Snapshot data updates on cron; keep cache modest.
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/roster/snapshot');

  try {
    const { searchParams } = new URL(request.url);
    const clanTagRaw = searchParams.get('clanTag') || cfg.homeClanTag;
    const clanTag = normalizeTag(clanTagRaw ?? '') || clanTagRaw || '';

    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }

    const roster = await getCurrentRosterData(clanTag);
    if (!roster) {
      return json({ success: false, error: 'No roster snapshot found' }, { status: 404 });
    }

    return json({ success: true, data: roster });
  } catch (error: any) {
    console.error('[api/roster/snapshot] error', error);
    return json({ success: false, error: error?.message || 'Failed to load roster snapshot' }, { status: 500 });
  }
}
