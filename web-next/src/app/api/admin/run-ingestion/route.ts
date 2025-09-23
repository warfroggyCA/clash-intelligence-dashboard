import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runIngestionJob } from '@/lib/ingestion/run-ingestion';

const bodySchema = z.object({
  clanTag: z.string().optional(),
  jobId: z.string().optional(),
});

function isAuthorized(req: NextRequest): boolean {
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  if (!expectedKey) {
    return true;
  }
  const provided = req.headers.get('x-api-key');
  return provided === expectedKey;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const results = await runIngestionJob({ clanTag: parsed.data.clanTag, jobId: parsed.data.jobId });
    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('[admin/run-ingestion] error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

