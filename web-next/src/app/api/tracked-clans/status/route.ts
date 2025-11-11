import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readTrackedClans(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tracked_clans')
    .select('clan_tag')
    .eq('is_active', true)
    .order('added_at', { ascending: true });
  
  if (error) {
    console.error('[TrackedClansStatus] Failed to read from Supabase:', error);
    return [];
  }
  
  return (data || []).map(row => row.clan_tag);
}

interface ClanIngestionStatus {
  clanTag: string;
  clanName?: string;
  hasData: boolean;
  lastJobStatus?: 'pending' | 'running' | 'completed' | 'failed';
  lastJobAt?: string;
  lastSnapshotAt?: string;
  isStale: boolean;
  memberCount?: number;
}

// GET /api/tracked-clans/status - Get ingestion status for all tracked clans
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/tracked-clans/status');

  try {
    const trackedClans = await readTrackedClans();
    const supabase = getSupabaseServerClient();

    // Get status for each tracked clan
    const statuses: ClanIngestionStatus[] = await Promise.all(
      trackedClans.map(async (clanTag) => {
        const normalizedTag = normalizeTag(clanTag);

        // Get clan name from clans table
        const { data: clanRow } = await supabase
          .from('clans')
          .select('name')
          .eq('tag', normalizedTag)
          .maybeSingle();

        // Get latest ingestion job
        const { data: latestJob } = await supabase
          .from('ingestion_jobs')
          .select('status, created_at, updated_at')
          .eq('clan_tag', normalizedTag)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get latest snapshot
        const { data: latestSnapshot } = await supabase
          .from('clan_snapshots')
          .select('created_at, member_count')
          .eq('clan_tag', normalizedTag)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastJobAt = latestJob?.updated_at || latestJob?.created_at || null;
        const lastSnapshotAt = latestSnapshot?.created_at || null;
        const hasData = Boolean(latestSnapshot);

        // Determine if stale (more than 6 hours since last update)
        const now = Date.now();
        const lastUpdateMs = lastJobAt ? new Date(lastJobAt).getTime() : null;
        const staleThresholdMs = 6 * 60 * 60 * 1000; // 6 hours
        const isStale = lastUpdateMs ? now - lastUpdateMs > staleThresholdMs : true;

        return {
          clanTag: normalizedTag,
          clanName: clanRow?.name || undefined,
          hasData,
          lastJobStatus: latestJob?.status as 'pending' | 'running' | 'completed' | 'failed' | undefined,
          lastJobAt: lastJobAt || undefined,
          lastSnapshotAt: lastSnapshotAt || undefined,
          isStale,
          memberCount: latestSnapshot?.member_count || undefined,
        };
      })
    );

    return json({ success: true, data: { statuses } });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Failed to fetch clan statuses' }, { status: 500 });
  }
}

