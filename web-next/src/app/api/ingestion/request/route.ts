import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { enqueueIngestionJob } from '@/lib/ingestion/queue';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { requireLeadership } from '@/lib/api/role-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  clanTag?: string;
};

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ingestion/request');

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const clanTagCandidate = body?.clanTag || cfg.homeClanTag || '';
    const clanTag = normalizeTag(clanTagCandidate) || clanTagCandidate;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }

    // Leadership-only: explicit action that may consume Clash API quota.
    await requireLeadership(request, { clanTag });

    const jobId = await enqueueIngestionJob(clanTag);
    return json({ success: true, data: { jobId } });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) return error;
    }

    console.error('[api/ingestion/request] error', error);
    return json({ success: false, error: error?.message || 'Failed to request ingestion' }, { status: 500 });
  }
}
