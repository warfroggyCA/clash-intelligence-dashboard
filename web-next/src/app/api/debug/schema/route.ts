import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ApiResponse } from '@/types';
import { createApiContext } from '@/lib/api/route-helpers';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/debug/schema');
  try {
    const supabase = getSupabaseAdminClient();
    
    // Check what columns exist in member_snapshot_stats
    const { data, error } = await supabase
      .from('member_snapshot_stats')
      .select('*')
      .limit(1);

    if (error) {
      return json({ success: false, error: error.message }, { status: 500 });
    }

    // Get column information
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('get_table_columns', { table_name: 'member_snapshot_stats' });

    return json({ 
      success: true, 
      data: { 
        sampleRow: data?.[0] || null,
        columns: columnInfo || 'Column info not available',
        error: columnError?.message || null
      } 
    });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
