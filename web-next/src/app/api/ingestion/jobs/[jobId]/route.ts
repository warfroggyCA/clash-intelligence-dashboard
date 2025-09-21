import { NextResponse } from 'next/server';
import { getJobRecord } from '@/lib/ingestion/job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: { jobId: string } }) {
  const { jobId } = context.params;
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Job ID required' }, { status: 400 });
  }

  const record = await getJobRecord(jobId);
  if (!record) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: record });
}
