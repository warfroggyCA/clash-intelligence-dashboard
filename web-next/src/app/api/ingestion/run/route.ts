import { NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { enqueueIngestionJob } from '@/lib/ingestion/queue';
import { getJobRecord } from '@/lib/ingestion/job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TriggerPayload {
  clanTag?: string;
  awaitResult?: boolean;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => ({}))) as TriggerPayload;
    const clanTag = payload.clanTag || cfg.homeClanTag;

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'No clan tag configured' }, { status: 400 });
    }

    const jobId = await enqueueIngestionJob(clanTag);

    if (payload.awaitResult) {
      let record = await getJobRecord(jobId);
      while (record && record.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        record = await getJobRecord(jobId);
      }
      return NextResponse.json({ success: true, data: { jobId, record } });
    }

    return NextResponse.json({ success: true, data: { jobId } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to trigger ingestion' },
      { status: 500 }
    );
  }
}
