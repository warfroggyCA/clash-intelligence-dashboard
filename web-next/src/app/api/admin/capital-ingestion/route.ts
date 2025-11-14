// Admin endpoint to manually trigger capital raid ingestion
// Requires ADMIN_API_KEY or INGESTION_TRIGGER_KEY

import { NextRequest, NextResponse } from 'next/server';
import { ingestCapitalData } from '@/lib/ingestion/capital-ingestion';
import { requireLeadership } from '@/lib/api/role-check';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const expectedKey = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  const provided = req.headers.get('x-api-key');
  
  if (!expectedKey) return false;
  return provided === expectedKey;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clanTag, seasonLimit = 10 } = body;
    const targetClanTag = normalizeTag(clanTag || cfg.homeClanTag || '');

    if (!targetClanTag) {
      return NextResponse.json({ 
        success: false, 
        error: 'No clan tag provided and no default clan configured' 
      }, { status: 400 });
    }

    const hasApiKey = isAuthorized(req);
    if (!hasApiKey) {
      await requireLeadership(req, { clanTag: targetClanTag });
    }

    console.log(`[AdminAPI] Starting capital ingestion for ${targetClanTag} (limit: ${seasonLimit})`);

    const result = await ingestCapitalData({
      clanTag: targetClanTag,
      seasonLimit: typeof seasonLimit === 'number' ? seasonLimit : 10,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        clan_tag: result.clanTag,
        seasons_ingested: result.seasonsIngested,
        weekends_ingested: result.weekendsIngested,
        participants_ingested: result.participantsIngested,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        success: false,
        clan_tag: result.clanTag,
        seasons_ingested: result.seasonsIngested,
        weekends_ingested: result.weekendsIngested,
        participants_ingested: result.participantsIngested,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

  } catch (error: any) {
    // Handle 401/403 errors from requireLeadership
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }

    console.error('[AdminAPI] Capital ingestion failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Manual capital raid ingestion trigger endpoint',
    usage: {
      method: 'POST',
      body: {
        clanTag: 'string (optional) - defaults to home clan',
        seasonLimit: 'number (optional, default: 10) - number of raid seasons to fetch'
      },
      authentication: {
        option1: 'x-api-key header with ADMIN_API_KEY or INGESTION_TRIGGER_KEY',
        option2: 'Leadership authentication (via requireLeadership)'
      }
    },
    example: {
      curl: `curl -X POST http://localhost:5050/api/admin/capital-ingestion \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_ADMIN_KEY" \\
  -d '{"seasonLimit": 10}'`
    }
  });
}

