import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api-context';

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/admin/apply-migration');
  
  try {
    const body = await request.json().catch(() => ({}));
    const { migration } = body;
    
    if (migration !== 'add_war_stats_to_member_snapshots') {
      return json({ success: false, error: 'Invalid migration name' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    
    // Apply the migration by running the SQL directly
    const { error } = await supabase
      .from('member_snapshot_stats')
      .select('war_stars')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      // Column doesn't exist, let's add it
      console.log('Adding war stats columns to member_snapshot_stats table');
      
      // We can't run DDL through the client, so we'll return instructions
      return json({ 
        success: false, 
        error: 'Migration requires manual SQL execution',
        instructions: 'Run this SQL in Supabase dashboard:',
        sql: `
ALTER TABLE public.member_snapshot_stats 
ADD COLUMN IF NOT EXISTS war_stars int,
ADD COLUMN IF NOT EXISTS attack_wins int,
ADD COLUMN IF NOT EXISTS defense_wins int;
        `
      }, { status: 400 });
    }
    
    if (error) {
      console.error('Migration check failed', { error });
      return json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log('Migration already applied - columns exist', { migration });
    return json({ success: true, message: 'Migration already applied - columns exist' });
    
  } catch (error: any) {
    console.error('Migration error', { error: error.message });
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
