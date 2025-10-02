// web-next/src/app/api/ai/batch-results/route.ts
// Deprecated endpoint - instruct callers to use /api/insights instead

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai/batch-results');
  return json({ success: false, error: 'This endpoint has moved to /api/insights' }, { status: 410 });
}
