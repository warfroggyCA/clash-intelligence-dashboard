import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai-summaries');

  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!clanTag) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    const normalizedTag = normalizeTag(clanTag);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('ai_summaries')
      .select('id, clan_tag, date, summary, summary_type, created_at')
      .eq('clan_tag', normalizedTag)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[API] Error fetching AI summaries:', error);
      return json({ success: false, error: error.message }, { status: 500 });
    }

    return json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('[API] Error fetching AI summaries:', error);
    return json({ success: false, error: error?.message ?? 'Failed to fetch AI summaries' }, { status: 500 });
  }
}

