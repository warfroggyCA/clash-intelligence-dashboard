import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { createApiContext } from '@/lib/api/route-helpers';
import { requireLeader } from '@/lib/api/role-check';
import { runStagedIngestionJob } from '@/lib/ingestion/run-staged-ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TrackedClansConfig {
  clans: string[];
}

const CONFIG_PATH = join(process.cwd(), 'scripts', 'tracked-clans.json');

async function readTrackedClans(): Promise<string[]> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config: TrackedClansConfig = JSON.parse(content);
    return config.clans || [];
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

async function writeTrackedClans(clans: string[]): Promise<void> {
  const config: TrackedClansConfig = { clans };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
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
    return json({ success: true, data: { clans } });
  } catch (error: any) {
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

    const clans = await readTrackedClans();
    
    // Check if already tracked
    if (clans.includes(normalizedTag)) {
      return json({ success: false, error: 'Clan is already being tracked' }, { status: 400 });
    }

    // Add to list
    clans.push(normalizedTag);
    await writeTrackedClans(clans);

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
    const clans = await readTrackedClans();
    
    // Remove from list
    const filteredClans = clans.filter(tag => normalizeTag(tag) !== normalizedTag);
    
    if (filteredClans.length === clans.length) {
      return json({ success: false, error: 'Clan not found in tracked list' }, { status: 404 });
    }

    await writeTrackedClans(filteredClans);

    return json({ success: true, data: { clans: filteredClans } });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Failed to remove tracked clan' }, { status: 500 });
  }
}

