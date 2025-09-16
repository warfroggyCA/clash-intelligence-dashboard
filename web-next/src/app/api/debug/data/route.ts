import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/debug/data');
  try {
    const result: any = {
      storage: 'Supabase',
      snapshots: {
        count: 0,
        files: []
      },
      tenureLedger: {
        exists: false,
        size: 0,
        url: null
      }
    };
    
    // Check snapshots in Supabase
    try {
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('clan_snapshots')
        .select('clan_tag, snapshot_date, fetched_at, metadata, created_at')
        .order('snapshot_date', { ascending: false });

      if (!snapshotsError && snapshots) {
        result.snapshots.count = snapshots.length;
        result.snapshots.files = snapshots.map((snapshot: any) => ({
          clanTag: snapshot.clan_tag,
          date: snapshot.snapshot_date,
          memberCount: snapshot.metadata?.memberCount ?? null,
          fetchedAt: snapshot.fetched_at,
          createdAt: snapshot.created_at
        }));
      } else if (snapshotsError?.code !== 'PGRST116') {
        console.error('Error querying clan_snapshots from Supabase:', snapshotsError);
      }

      if (!result.snapshots.count) {
        const { data: legacySnapshots, error: legacyError } = await supabase
          .from('snapshots')
          .select('*')
          .order('created_at', { ascending: false });

        if (!legacyError && legacySnapshots) {
          result.snapshots.count = legacySnapshots.length;
          result.snapshots.files = legacySnapshots.map(snapshot => ({
            filename: snapshot.filename,
            url: snapshot.file_url,
            clanTag: snapshot.clan_tag,
            date: snapshot.date,
            memberCount: snapshot.member_count,
            createdAt: snapshot.created_at
          }));
        } else if (legacyError && legacyError.code !== 'PGRST116') {
          console.error('Error querying legacy snapshots from Supabase:', legacyError);
        }
      }
    } catch (e) {
      console.error('Error querying snapshots from Supabase:', e);
    }
    
    // Check tenure ledger in Supabase
    try {
      const { data: tenureData, error: tenureError } = await supabase
        .from('tenure_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!tenureError && tenureData && tenureData.length > 0) {
        const ledger = tenureData[0];
        result.tenureLedger.exists = true;
        result.tenureLedger.size = ledger.size;
        result.tenureLedger.url = ledger.file_url;
      }
    } catch (e) {
      console.error('Error checking tenure ledger from Supabase:', e);
    }
    
    return json({ success: true, data: result });
    
  } catch (error: any) {
    return json({ success: false, error: error.message, message: error.stack }, { status: 500 });
  }
}
