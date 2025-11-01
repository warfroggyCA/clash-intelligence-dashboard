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
    // Only allow clanTag override with admin key
    let clanTag = cfg.homeClanTag;
    
    // CRITICAL SAFEGUARD: Prevent accidental use of wrong clan tag
    if (!clanTag || clanTag === '#G9QVRYC2Y') {
      console.error(`[IngestionRun] INVALID CLAN TAG DETECTED: ${clanTag}. Forcing to #2PR8R8V8P`);
      clanTag = '#2PR8R8V8P';
    }
    
    if (payload.clanTag && typeof payload.clanTag === 'string') {
      const adminKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
      const provided = req.headers.get('x-api-key');
      if (adminKey && provided === adminKey) {
        clanTag = payload.clanTag;
        console.log(`[IngestionRun] Using override clan tag: ${clanTag}`);
      }
    }

    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'No clan tag configured' }, { status: 400 });
    }
    
    console.log(`[IngestionRun] Enqueuing ingestion for clan tag: ${clanTag}`);

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
