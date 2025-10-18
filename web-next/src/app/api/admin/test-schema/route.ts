import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';

export async function GET(request: NextRequest) {
  const { json, logger } = createApiContext(request, '/api/admin/test-schema');
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Test if war stats columns exist by trying to select them
    const { data, error } = await supabase
      .from('member_snapshot_stats')
      .select('war_stars, attack_wins, defense_wins')
      .limit(1);
    
    if (error) {
      logger.error('Schema test failed', { error });
      return json({ 
        success: false, 
        error: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }
    
    logger.info('Schema test successful', { data });
    return json({ 
      success: true, 
      message: 'War stats columns exist',
      sampleData: data
    });
    
  } catch (error: any) {
    logger.error('Schema test error', { error: error.message });
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
