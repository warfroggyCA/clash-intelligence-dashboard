import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { createApiContext } from '@/lib/api/route-helpers';
import { requireLeader, getCurrentUserIdentifier } from '@/lib/api/role-check';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { runStagedIngestionJob } from '@/lib/ingestion/run-staged-ingestion';
import { cfg } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizedHomeClanTag = normalizeTag(cfg.homeClanTag || '');

function isHomeClan(tag: string | null | undefined): boolean {
  if (!normalizedHomeClanTag) return false;
  return normalizeTag(tag || '') === normalizedHomeClanTag;
}

async function readTrackedClans(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tracked_clans')
    .select('clan_tag')
    .eq('is_active', true)
    .order('added_at', { ascending: true });
  
  if (error) {
    console.error('[TrackedClans] Failed to read from Supabase:', error);
    return [];
  }
  
  return (data || []).map(row => row.clan_tag);
}

async function addTrackedClan(clanTag: string, addedBy: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tracked_clans')
    .insert({
      clan_tag: clanTag,
      added_by: addedBy,
      is_active: true,
    });
  
  if (error) {
    // If it's a unique constraint violation, that's okay (already exists)
    if (error.code === '23505') {
      // Check if it's inactive, and if so, reactivate it
      const { data: existing } = await supabase
        .from('tracked_clans')
        .select('is_active')
        .eq('clan_tag', clanTag)
        .maybeSingle();
      
      if (existing && !existing.is_active) {
        await supabase
          .from('tracked_clans')
          .update({ is_active: true, added_by: addedBy, updated_at: new Date().toISOString() })
          .eq('clan_tag', clanTag);
      }
      return;
    }
    throw error;
  }
}

async function removeTrackedClan(clanTag: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tracked_clans')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('clan_tag', clanTag);
  
  if (error) {
    throw error;
  }
}

async function isClanTracked(clanTag: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('tracked_clans')
    .select('id')
    .eq('clan_tag', clanTag)
    .eq('is_active', true)
    .maybeSingle();
  
  return !!data;
}

// GET /api/tracked-clans - Get list of tracked clans
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/tracked-clans');
  
  try {
    await requireLeader(request);
  } catch (error: any) {
    // requireLeader throws a NextResponse for 403, so we need to catch and return it
    if (error instanceof NextResponse) {
      return error;
    }
    return json({ success: false, error: 'Forbidden: Leader access required' }, { status: 403 });
  }

  try {
    const clans = await readTrackedClans();
    let filtered = clans;
    if (normalizedHomeClanTag) {
      const hasHome = clans.some((tag) => normalizeTag(tag) === normalizedHomeClanTag);
      if (hasHome) {
        try {
          await removeTrackedClan(normalizedHomeClanTag);
        } catch (error) {
          console.warn('[TrackedClans GET] Failed to deactivate home clan entry:', error);
        }
      }
      filtered = clans.filter((tag) => normalizeTag(tag) !== normalizedHomeClanTag);
    }
    return json({ success: true, data: { clans: filtered } });
  } catch (error: any) {
    console.error('[TrackedClans GET] Error:', error);
    return json({ success: false, error: error.message || 'Failed to read tracked clans' }, { status: 500 });
  }
}

// POST /api/tracked-clans - Add a clan to tracked list
export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/tracked-clans');
  
  try {
    await requireLeader(request);
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }
    return json({ success: false, error: 'Forbidden: Leader access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { clanTag } = body;
    
    if (!clanTag) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    const normalizedTag = normalizeTag(clanTag);
    if (!isValidTag(normalizedTag)) {
      return json({ success: false, error: 'Invalid clan tag format' }, { status: 400 });
    }

    if (isHomeClan(normalizedTag)) {
      return json(
        { success: false, error: 'Home clan is ingested automatically. Track only additional clans.' },
        { status: 400 },
      );
    }

    // Check if already tracked
    if (await isClanTracked(normalizedTag)) {
      return json({ success: false, error: 'Clan is already being tracked' }, { status: 400 });
    }

    // Get current user identifier for audit trail
    const addedBy = await getCurrentUserIdentifier(request);

    // Add to database
    await addTrackedClan(normalizedTag, addedBy);
    
    // Get updated list
    const clans = await readTrackedClans();

    // Trigger immediate ingestion in the background to establish baseline data
    runStagedIngestionJob({
      clanTag: normalizedTag,
      runPostProcessing: true,
    }).then(result => {
      console.log(`[TrackedClans] Background ingestion completed for ${normalizedTag}:`, result.success ? 'SUCCESS' : 'FAILED');
    }).catch(error => {
      console.error(`[TrackedClans] Background ingestion failed for ${normalizedTag}:`, error);
    });

    return json({ 
      success: true, 
      data: { 
        clans,
        message: 'Clan added and ingestion started in background'
      } 
    });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Failed to add tracked clan' }, { status: 500 });
  }
}

// DELETE /api/tracked-clans?clanTag=#TAG - Remove a clan from tracked list
export async function DELETE(request: NextRequest) {
  const { json } = createApiContext(request, '/api/tracked-clans');
  
  try {
    await requireLeader(request);
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }
    return json({ success: false, error: 'Forbidden: Leader access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag');
    
    if (!clanTagParam) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    const normalizedTag = normalizeTag(clanTagParam);
    
    // Check if clan is tracked
    if (!(await isClanTracked(normalizedTag))) {
      return json({ success: false, error: 'Clan not found in tracked list' }, { status: 404 });
    }

    // Remove (soft delete) from database
    await removeTrackedClan(normalizedTag);
    
    // Get updated list
    const clans = await readTrackedClans();

    return json({ success: true, data: { clans } });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Failed to remove tracked clan' }, { status: 500 });
  }
}
