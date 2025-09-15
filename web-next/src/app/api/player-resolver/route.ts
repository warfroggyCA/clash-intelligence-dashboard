// web-next/src/app/api/player-resolver/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from '@/lib/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { cached } from '@/lib/cache';

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/player-resolver');
  try {
    const ip = (request.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await rateLimitAllow(`player-resolver:${ip}`, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 60),
        }
      });
    }
    const dataDir = path.join(process.cwd(), cfg.dataRoot);
    const resolutionFile = path.join(dataDir, 'player-name-resolution.json');

    const raw = await cached(['player-resolver','file'], async () => {
      if (cfg.useLocalData) {
        try {
          await fsp.access(resolutionFile);
          return await fsp.readFile(resolutionFile, 'utf-8');
        } catch {
          // fall through
        }
      }

      if (cfg.useSupabase) {
        try {
          const supabase = getSupabaseAdminClient();
          const { data, error } = await supabase.storage
            .from('player-db')
            .download('player-name-resolution.json');
          if (!error && data) {
            return await data.text();
          }
        } catch (error) {
          console.error('[PlayerResolver API] Failed to read Supabase resolution file:', error);
        }
      }

      throw new Error('No resolution data available');
    }, 10).catch(() => null);

    if (!raw) {
      return json({ success: false, error: "No resolution data available" }, { status: 404 });
    }

    const data = JSON.parse(raw);

    return json({ success: true, data }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    
  } catch (error: any) {
    console.error('[PlayerResolver API] Error:', error);
    return json({ success: false, error: error.message || "Failed to get resolution data" }, { status: 500 });
  }
}
