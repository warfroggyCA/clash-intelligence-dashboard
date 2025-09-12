import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/snapshots/list?clanTag=#TAG
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    
    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }
    
    const safeTag = clanTag.replace('#', '').toLowerCase();
    
    try {
      // Query snapshots from Supabase database
      const { data: snapshots, error } = await supabase
        .from('snapshots')
        .select('*')
        .eq('clan_tag', safeTag)
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Database query error:', error);
        return NextResponse.json({
          success: true,
          snapshots: []
        });
      }
      
      // Transform data for response and deduplicate by date
      const formattedSnapshots = snapshots?.map(snapshot => ({
        date: snapshot.date,
        memberCount: snapshot.member_count,
        clanName: snapshot.clan_name,
        timestamp: snapshot.timestamp,
        url: snapshot.file_url,
        filename: snapshot.filename
      })) || [];
      
      // Deduplicate by date using Map to ensure we keep the most recent for each date
      const dateMap = new Map();
      formattedSnapshots.forEach(snapshot => {
        if (!dateMap.has(snapshot.date)) {
          dateMap.set(snapshot.date, snapshot);
        }
      });
      const uniqueSnapshots = Array.from(dateMap.values());
      
      
      return NextResponse.json(uniqueSnapshots);
    } catch (error) {
      console.error('Error querying snapshots:', error);
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('Error listing snapshots:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
